import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { auditCsv, type AuditReport } from "./audit.js";
import { checkAuditOutput } from "./check-output.js";

export const FIXTURE_IDS = ["mixed-validity", "quoted-multiline", "rejected-values", "header-only"] as const;
export type FixtureId = typeof FIXTURE_IDS[number];
export interface ConformanceFixture {
  fixture_id: FixtureId;
  csv_utf8: string;
  golden: AuditReport;
  csv_sha256: string;
  golden_sha256: string;
}
export interface ConformanceSuite { version: 1; hash: string; fixtures: ConformanceFixture[] }
export interface ConformanceResponse { fixture_id: FixtureId; conformance_suite_hash: string; report: AuditReport }
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("base64");
const fixtureRoot = new URL("../../../fixtures/invoice-audit/v1/", import.meta.url);

/** All paths are fixed public repository fixtures; no request data reaches filesystem paths. */
export function loadConformanceSuite(): ConformanceSuite {
  const bytes = readFileSync(new URL("suite.json", fixtureRoot));
  const manifest = JSON.parse(bytes.toString("utf8")) as {
    schema_version: number; capability: string; conformance_suite_version: number; claim: string;
    fixtures: { fixture_id: string; csv_sha256: string; golden_sha256: string }[];
  };
  if (manifest.schema_version !== 1 || manifest.capability !== "invoice.audit.v1" ||
      manifest.conformance_suite_version !== 1 || manifest.claim !== "controlled_fixture_conformance_only" ||
      manifest.fixtures.length !== FIXTURE_IDS.length) throw new Error("INVALID_SUITE_MANIFEST");
  const fixtures = FIXTURE_IDS.map((fixture_id, index) => {
    const entry = manifest.fixtures[index]!;
    const csv = readFileSync(new URL(`${fixture_id}.csv`, fixtureRoot));
    const goldenBytes = readFileSync(new URL(`${fixture_id}.json`, fixtureRoot));
    if (entry.fixture_id !== fixture_id || sha256(csv) !== entry.csv_sha256 || sha256(goldenBytes) !== entry.golden_sha256) {
      throw new Error("FIXTURE_COMMITMENT_MISMATCH");
    }
    const csv_utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(csv);
    const golden = JSON.parse(goldenBytes.toString("utf8")) as AuditReport;
    if (!checkAuditOutput(csv_utf8, golden).ok) throw new Error("INVALID_GOLDEN");
    return { fixture_id, csv_utf8, golden, csv_sha256: entry.csv_sha256, golden_sha256: entry.golden_sha256 };
  });
  return {
    version: 1,
    hash: createHash("sha256").update("AGENTTRUST_INVOICE_AUDIT_SUITE_V1\0", "ascii").update(bytes).digest("base64"),
    fixtures,
  };
}

/** Public conformance route: only named committed fixtures, never caller CSV or paid content. */
export function handleConformance(body: unknown): ConformanceResponse {
  if (body === null || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("fixture_id" in body) ||
      !FIXTURE_IDS.some((id) => body.fixture_id === id)) throw new TypeError("INVALID_FIXTURE_REQUEST");
  const suite = loadConformanceSuite();
  const fixture = suite.fixtures.find((entry) => entry.fixture_id === body.fixture_id)!;
  return { fixture_id: fixture.fixture_id, conformance_suite_hash: suite.hash, report: auditCsv(fixture.csv_utf8) };
}
