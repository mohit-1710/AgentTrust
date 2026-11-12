// Public surface URLs are explicit deployment configuration. Defaults are local development.
function surfaceOrigin(value: string | undefined, fallback: string): string {
  const origin = value || fallback;
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password ||
      !(url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Use a canonical HTTPS surface origin, or local HTTP during development.");
  }
  return origin;
}
const DOCS_URL = surfaceOrigin(process.env.NEXT_PUBLIC_DOCS_URL, "http://localhost:3001");
const GITHUB_REPO_URL = "https://github.com/mohit-1710/AgentTrust";
function docsPath(path: string): string { return `${DOCS_URL}${path}`; }

export const PUBLIC_LINKS = {
  docs: DOCS_URL,
  docsSettlement: docsPath("/verification/atomic-tx-invariant"),
  docsArchitecture: docsPath("/architecture"),
  docsChangelog: docsPath("/reference/changelog"),
  docsVerification: docsPath("/verification"),
  docsHttp402: docsPath("/integration-guides/x402-facilitator"),
  docsGatePayment: docsPath("/sdk/gate-payment"),
  docsAuditExample: docsPath("/integration-guides/capability-namespaces"),
  docsPolicyVault: docsPath("/programs/policy-vault"),
  docsDeployment: docsPath("/reference/devnet-program-ids"),
  docsQuickstart: docsPath("/getting-started/quickstart"),
  docsSdk: docsPath("/sdk"),
  docsTrustGate: docsPath("/programs/trustgate"),
  docsValidationRegistry: docsPath("/programs/validation-registry"),
  github: GITHUB_REPO_URL,
  githubIssues: `${GITHUB_REPO_URL}/issues`,
  githubLicense: `${GITHUB_REPO_URL}/blob/main/LICENSE`,
  sdkSource: `${GITHUB_REPO_URL}/tree/main/packages/near-sdk`,
  privacy: "/privacy",
  site: surfaceOrigin(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  terms: "/terms",
  blog: "/blog",
  blogFeed: "/blog/feed.xml",
} as const;

export const SOCIAL_LINKS = { x: "https://x.com/0xmohit_" } as const;
