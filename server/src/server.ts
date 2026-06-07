import express, { type Request, type Response } from "express";
import { getAddress, type Address } from "viem";
import { HTTPFacilitatorClient } from "@x402/core/http";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type {
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,
} from "@x402/core/types";
import { config } from "./config.js";
import { GateDecision, runGate, readReputation } from "./chain.js";
import { privateKeyToAccount } from "viem/accounts";

// ---------------------------------------------------------------------------
// Resolve the payTo address (USDC recipient = the resource server's wallet).
// ---------------------------------------------------------------------------
function resolvePayTo(): Address {
  if (config.payToOverride) return getAddress(config.payToOverride);
  if (config.privateKey) {
    try {
      return privateKeyToAccount(config.privateKey).address;
    } catch {
      /* fall through */
    }
  }
  // Last-resort placeholder so the server still boots for the 402 demo.
  console.warn(
    "[server] No PAY_TO / PRIVATE_KEY set — using a placeholder payTo. " +
      "Set PAY_TO to your USDC recipient for real settlement.",
  );
  return getAddress("0x000000000000000000000000000000000000dEaD");
}

const PAY_TO = resolvePayTo();

// Remote facilitator (molandak) — implements verify() and settle() over HTTP.
const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl });

const RESOURCE_PATH = "/protected/report";

// ---------------------------------------------------------------------------
// Build the x402 PaymentRequirements for our protected resource.
// exact scheme, eip155:10143, USDC, our payTo, small price.
// ---------------------------------------------------------------------------
function buildRequirements(): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.network,
    asset: getAddress(config.usdc),
    amount: config.priceAtomic, // atomic units (USDC has 6 decimals)
    payTo: PAY_TO,
    maxTimeoutSeconds: 120,
    // EIP-712 token metadata for transferWithAuthorization (EIP-3009).
    // name/version VERIFIED against the USDC token contract on Monad testnet.
    extra: { name: "USDC", version: "2" },
  };
}

function buildPaymentRequired(req: Request, errorMsg?: string): PaymentRequired {
  const resourceUrl = `${req.protocol}://${req.get("host")}${RESOURCE_PATH}`;
  return {
    x402Version: 2,
    ...(errorMsg ? { error: errorMsg } : {}),
    resource: {
      url: resourceUrl,
      description: "AgentTrust-gated market intelligence report (demo resource)",
      mimeType: "application/json",
      serviceName: "AgentTrust x402 Gate",
    },
    accepts: [buildRequirements()],
  };
}

// Send a 402 with the x402 PaymentRequirements (header + JSON body).
function send402(req: Request, res: Response, errorMsg?: string) {
  const paymentRequired = buildPaymentRequired(req, errorMsg);
  res
    .status(402)
    .set("X-PAYMENT-REQUIRED", encodePaymentRequiredHeader(paymentRequired))
    .json(paymentRequired);
}

// Best-effort extraction of the payer (EIP-3009 authorization.from) from the
// decoded payload. The facilitator's verify response is the source of truth,
// but we need the payer BEFORE settlement to run the gate.
function payerFromPayload(payload: PaymentPayload): Address | null {
  const p = payload.payload as Record<string, unknown> | undefined;
  const auth = p?.["authorization"] as Record<string, unknown> | undefined;
  const from = auth?.["from"] ?? p?.["from"];
  if (typeof from === "string" && from.startsWith("0x")) {
    try {
      return getAddress(from);
    } catch {
      return null;
    }
  }
  return null;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    network: config.network,
    facilitator: config.facilitatorUrl,
    policyVaultConfigured: Boolean(config.policyVaultAddress),
    payTo: PAY_TO,
  });
});

// Convenience: expose the requirements without paying (useful for the demo).
app.get("/requirements", (req, res) => {
  res.json(buildPaymentRequired(req));
});

// ---------------------------------------------------------------------------
// The protected resource: 402 -> gate -> verify -> settle -> resource.
// ---------------------------------------------------------------------------
app.get(RESOURCE_PATH, async (req: Request, res: Response) => {
  const paymentHeader =
    (req.get("X-PAYMENT") as string | undefined) ??
    (req.get("x-payment") as string | undefined);

  // No payment yet -> reply 402 with requirements.
  if (!paymentHeader) {
    return send402(req, res);
  }

  // Demo inputs for the gate. payeeAgentId identifies the merchant/agent being
  // paid; payer can be overridden via header for testing, otherwise derived
  // from the signed authorization.
  const payeeAgentId = BigInt(
    (req.get("X-PAYEE-AGENT-ID") as string | undefined) ??
      (req.query["payeeAgentId"] as string | undefined) ??
      "1",
  );

  // 1) Decode the X-PAYMENT header into a PaymentPayload.
  let payment: PaymentPayload;
  try {
    payment = decodePaymentSignatureHeader(paymentHeader);
  } catch (err) {
    return send402(req, res, `Malformed X-PAYMENT header: ${(err as Error).message}`);
  }

  const requirements = buildRequirements();

  // Determine payer + amount for the gate.
  const headerPayer = req.get("X-PAYER") as string | undefined;
  let payer = payerFromPayload(payment);
  if (headerPayer && headerPayer.startsWith("0x")) {
    try {
      payer = getAddress(headerPayer);
    } catch {
      /* ignore */
    }
  }
  if (!payer) {
    return send402(req, res, "Could not determine payer from payment payload");
  }

  // Amount the client is authorizing (atomic USDC units). Prefer the value in
  // the signed payload's accepted requirements; fall back to our price.
  const acceptedAmount =
    payment.accepted?.amount ?? requirements.amount ?? config.priceAtomic;
  const amount = BigInt(acceptedAmount);

  // 2) Run the AgentTrust PolicyVault gate.
  let gate;
  try {
    gate = await runGate(payer, payeeAgentId, amount);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "gate_call_failed", message: (err as Error).message });
  }

  console.log(
    `[gate] payer=${payer} payeeAgentId=${payeeAgentId} amount=${amount} -> ` +
      `decision=${GateDecision[gate.decision]} reason="${gate.reason}"` +
      (gate.stubbed ? " (stubbed)" : ""),
  );

  // Optional read-only reputation enrichment (best-effort; never blocks).
  const reputation = await readReputation(payeeAgentId, [payer]);

  // 3) Enforce the decision. Only ALLOW proceeds to verify+settle.
  if (gate.decision === GateDecision.DENY) {
    return res.status(403).json({
      error: "policy_denied",
      decision: "DENY",
      reason: gate.reason,
      payeeAgentId: payeeAgentId.toString(),
      payer,
      reputation: serializeRep(reputation),
    });
  }
  if (gate.decision === GateDecision.REQUIRE_VALIDATION) {
    return res.status(402).json({
      error: "validation_required",
      decision: "REQUIRE_VALIDATION",
      reason: gate.reason,
      payeeAgentId: payeeAgentId.toString(),
      payer,
      reputation: serializeRep(reputation),
    });
  }

  // decision === ALLOW -> verify with facilitator.
  let verifyResp;
  try {
    verifyResp = await facilitator.verify(payment, requirements);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "facilitator_verify_failed", message: (err as Error).message });
  }

  if (!verifyResp.isValid) {
    return res.status(402).json({
      error: "payment_invalid",
      invalidReason: verifyResp.invalidReason,
      invalidMessage: verifyResp.invalidMessage,
    });
  }

  // 4) Gate ALLOW + verify OK -> settle.
  let settleResp;
  try {
    settleResp = await facilitator.settle(payment, requirements);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "facilitator_settle_failed", message: (err as Error).message });
  }

  if (!settleResp.success) {
    return res.status(402).json({
      error: "settlement_failed",
      errorReason: settleResp.errorReason,
      errorMessage: settleResp.errorMessage,
    });
  }

  // Attach the settlement response header (x402 convention) and serve resource.
  res.set("X-PAYMENT-RESPONSE", encodePaymentResponseHeader(settleResp));

  return res.status(200).json({
    resource: {
      title: "Market Intelligence Report (demo)",
      generatedAt: new Date().toISOString(),
      body: "ALLOW from AgentTrust PolicyVault -> USDC settled via x402.",
    },
    payment: {
      decision: "ALLOW",
      reason: gate.reason,
      gateStubbed: gate.stubbed,
      transaction: settleResp.transaction,
      explorer: settleResp.transaction
        ? `https://testnet.monadexplorer.com/tx/${settleResp.transaction}`
        : undefined,
      network: settleResp.network,
      payer: settleResp.payer ?? payer,
      amount: settleResp.amount ?? amount.toString(),
    },
    reputation: serializeRep(reputation),
  });
});

function serializeRep(
  rep: { count: bigint; summaryValue: bigint; decimals: number } | null,
) {
  if (!rep) return null;
  return {
    count: rep.count.toString(),
    summaryValue: rep.summaryValue.toString(),
    decimals: rep.decimals,
  };
}

app.listen(config.port, "0.0.0.0", () => {
  console.log(`AgentTrust x402 gate listening on http://0.0.0.0:${config.port}`);
  console.log(`  network:       ${config.network}`);
  console.log(`  facilitator:   ${config.facilitatorUrl}`);
  console.log(`  USDC:          ${config.usdc}`);
  console.log(`  payTo:         ${PAY_TO}`);
  console.log(
    `  PolicyVault:   ${
      config.policyVaultAddress || "(unset — gate STUBBED to ALLOW)"
    }`,
  );
  console.log(`  resource:      GET ${RESOURCE_PATH}`);
});
