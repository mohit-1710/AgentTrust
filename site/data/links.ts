const DOCS_URL = "https://monadagenttrustdocs-site.vercel.app";
const GITHUB_REPO_URL = "https://github.com/mohit-1710/AgentTrust";

function docsPath(path: string): string {
  return `${DOCS_URL}${path}`;
}

export const PUBLIC_LINKS = {
  docs: DOCS_URL,
  docsSettlement: docsPath("/sdk/settlement"),
  docsArchitecture: docsPath("/getting-started/architecture-overview"),
  docsChangelog: docsPath("/reference/changelog"),
  docsTesting: docsPath("/reference/testing"),
  docsFacilitatorAdapters: docsPath("/integration-guides/facilitator-adapters"),
  docsGatePayment: docsPath("/sdk/gate-payment"),
  docsMcp: docsPath("/sdk/mcp-server"),
  docsX402Adapter: docsPath("/integration-guides/x402-adapter"),
  docsPolicyVault: docsPath("/contracts/policy-vault"),
  docsContractAddresses: docsPath("/reference/testnet-contract-addresses"),
  docsQuickstart: docsPath("/getting-started/quickstart"),
  docsSdk: docsPath("/sdk"),
  docsReputation: docsPath("/contracts/reputation"),
  docsValidationRegistry: docsPath("/contracts/validation-registry"),
  docsX402: docsPath("/integration-guides/x402-facilitator"),
  github: GITHUB_REPO_URL,
  githubIssues: `${GITHUB_REPO_URL}/issues`,
  githubLicense: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
  npm: "https://www.npmjs.com/package/@monad-agenttrust-sdk/sdk",
  privacy: "/privacy",
  site: "https://monadagenttrustsite.vercel.app",
  demo: "https://monadagenttrustweb.vercel.app/#demo",
  terms: "/terms",
  blog: "/blog",
  blogFeed: "/blog/feed.xml",
} as const;

export const SOCIAL_LINKS = {
  discord: "https://discord.com/users/1185234614386700431",
  x: "https://x.com/agenttrustlabs",
} as const;
