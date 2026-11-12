import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("every pasted multi-operation testnet block stops after the first failed command", async () => {
  const book = await readFile(new URL("../../../docs/testnet-demo-runbook.md", import.meta.url), "utf8");
  const blocks = [...book.matchAll(/```sh\n([\s\S]*?)```/g)].map((match) => match[1]!).filter((block) => (block.match(/^\s*pnpm demo:(?:prepare|run):testnet /gm) ?? []).length > 1);
  expect(blocks.length).toBeGreaterThanOrEqual(4);
  const directory = await mkdtemp(path.join(tmpdir(), "agenttrust-operator-blocks-"));
  try {
    for (const [index, block] of blocks.entries()) {
      const file = path.join(directory, String(index));
      const script = `pnpm() { print -r -- "$*" >> "$CALL_LOG"; return 2; }\n${block}`;
      const result = spawnSync("/bin/zsh", ["-c", script], { cwd: directory, env: { PATH: "/usr/bin:/bin", CALL_LOG: file, AGENTTRUST_DEMO_DIR: directory } });
      expect((await readFile(file, "utf8")).trim().split("\n"), `block ${index} continued`).toHaveLength(1);
      expect(result.status).toBe(2);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
