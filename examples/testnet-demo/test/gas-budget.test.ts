import { expect, it } from "vitest";
import { CALL_GAS } from "../../../packages/near-sdk/src/client.js";
import { limits } from "../src/config.js";

it("the finite worker allowance covers the observed protocol88 admission cost for the configured call gas", () => {
  // Recorded testnet protocol88 floor and r1 NotEnoughAllowance diagnostic; no RPC is queried.
  const minGasPurchasePriceYocto = 1_000_000_000n;
  const observed150TAdmissionCostYocto = 150_925_442_492_864_500_000_000n;
  const observedFeeMarginYocto = observed150TAdmissionCostYocto - 150_000_000_000_000n * minGasPurchasePriceYocto;
  const requiredAllowance = CALL_GAS * minGasPurchasePriceYocto + observedFeeMarginYocto;
  const allowance = BigInt(limits.key_allowance);
  expect(allowance).toBeGreaterThanOrEqual(requiredAllowance);
  expect(allowance).toBeLessThanOrEqual(500_000_000_000_000_000_000_000n); // Keep the explicit finite 0.5 NEAR authority bound.
});
