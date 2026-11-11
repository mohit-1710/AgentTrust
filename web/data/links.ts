const DOCS_URL = "https://docs.agenttrust.tech";
const GITHUB_REPO_URL = "https://github.com/agenttrust-labs/agenttrust";

function docsPath(path: string): string {
  return `${DOCS_URL}${path}`;
}

export const PUBLIC_LINKS = {
  docs: DOCS_URL,
  docsAtomicSettlement: docsPath("/sdk/atomic-tx-invariant"),
  docsArchitecture: docsPath("/getting-started/architecture-overview"),
  docsChangelog: docsPath("/reference/changelog"),
  docsFormalVerification: docsPath("/reference/formal-verification"),
  docsFacilitatorAdapters: docsPath("/integration-guides/facilitator-adapters"),
  docsGatePayment: docsPath("/sdk/gate-payment"),
  docsMountTrustGate: docsPath("/sdk/mount-trustgate"),
  docsPayShAdapter: docsPath("/integration-guides/pay-sh-adapter"),
  docsPolicyVault: docsPath("/programs/policy-vault"),
  docsProgramIds: docsPath("/reference/devnet-program-ids"),
  docsQuickstart: docsPath("/getting-started/quickstart"),
  docsSdk: docsPath("/sdk"),
  docsTrustGate: docsPath("/programs/trustgate"),
  docsValidationRegistry: docsPath("/programs/validation-registry"),
  docsX402: docsPath("/integration-guides/x402-facilitator"),
  github: GITHUB_REPO_URL,
  githubIssues: `${GITHUB_REPO_URL}/issues`,
  githubLicense: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
  npm: "https://www.npmjs.com/package/@agenttrust-sdk/trustgate",
  privacy: "/privacy",
  site: "https://agenttrust.tech",
  terms: "/terms",
  blog: "/blog",
  blogFeed: "/blog/feed.xml",
} as const;

export const SOCIAL_LINKS = {
  discord: "https://discord.com/users/1185234614386700431",
  x: "https://x.com/agenttrustlabs",
} as const;
