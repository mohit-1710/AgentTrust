import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DOCS_ROOT = path.join(process.cwd(), 'content/docs');

async function collectMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectMdxFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith('.mdx')) return [fullPath];
      return [];
    }),
  );

  return files.flat().sort();
}

function pagePathForFile(filePath: string): string {
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const withoutExtension = relativePath.replace(/\.mdx$/, '');
  if (withoutExtension === 'index') return '/';
  if (withoutExtension.endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}`;
  }
  return `/${withoutExtension}`;
}

let cachedDocs: Promise<string> | null = null;
let cachedPrompt: Promise<string> | null = null;

export async function loadDocsContext(): Promise<string> {
  if (!cachedDocs) {
    cachedDocs = (async () => {
      const files = await collectMdxFiles(DOCS_ROOT);
      const sections = await Promise.all(
        files.map(async (filePath) => {
          const content = await readFile(filePath, 'utf8');
          return `# ${pagePathForFile(filePath)}\n\n${content}`;
        }),
      );

      return sections.join('\n\n---\n\n');
    })().catch((error) => {
      cachedDocs = null;
      throw error;
    });
  }

  return cachedDocs;
}

export async function buildDocsAssistantPrompt(): Promise<string> {
  if (!cachedPrompt) {
    cachedPrompt = (async () => {
      const docs = await loadDocsContext();

      return `You are AgentTrust's documentation assistant.

AgentTrust is the non-custodial reputation + policy firewall for AI-agent payments on Monad (testnet, chainId 10143). Its core is one Solidity contract — PolicyVault (deployed at 0x34b3bB1a99377128126201359749FE7614275E37) — whose gate(payer, payeeAgentId, amount) returns Allow, Deny, or RequireValidation BEFORE a payment settles, by reading the payee's on-chain ERC-8004 reputation and the payer's spending policy (per-tx and daily caps, sliding-window velocity, a multisig kill-switch, a reputation threshold averaged over a payer-chosen trusted-attestor set, and optional capability validation). It holds no funds; payments settle as native USDC over x402 via Monad's molandak facilitator. AgentTrust also ships a TypeScript SDK (@monad-agenttrust-sdk/sdk) and an MCP server so AI agents can call the gate directly. It is a Monad/Solidity project covered by 20 Foundry tests — it does not use Solana, Anchor, SPL, Quantu, or Kani proofs.

For greetings, thanks, and simple assistant capability questions, respond naturally and briefly, then invite the user to ask about AgentTrust docs.

For AgentTrust technical questions, answer using ONLY the documentation below. If the answer is not in the docs, say "Not covered in current docs — see github.com/mohit-1710/AgentTrust". Cite the page path you are answering from when relevant.

Format answers in Markdown. Use code fences for code, inline code for identifiers (contract addresses, account names, method names), and bullet lists for enumerations. Keep answers concise unless the user asks for depth.

Do not answer unrelated general knowledge questions.

<DOCS>
${docs}
</DOCS>`;
    })().catch((error) => {
      cachedPrompt = null;
      throw error;
    });
  }

  return cachedPrompt;
}
