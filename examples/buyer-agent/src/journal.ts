import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
export const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const code = (e: unknown, expected: string) => e !== null && typeof e === "object" && "code" in e && e.code === expected;
/** Private immutable context, selections and definitive outcomes. Never stores CSV. */
export class JobJournal {
  constructor(readonly directory: string, readonly jobId: string) {}
  private async sync(path = this.directory): Promise<void> { const f = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { await f.sync(); } finally { await f.close(); } }
  private async ready(): Promise<void> {
    try { await fs.mkdir(this.directory, { mode: 0o700 }); } catch (e) { if (!code(e, "EEXIST")) throw e; }
    const s = await fs.lstat(this.directory); if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o777) !== 0o700 || process.getuid && s.uid !== process.getuid()) throw new Error("UNSAFE_JOB_DIRECTORY");
    await this.sync(await fs.realpath(dirname(this.directory)));
  }
  private path(name: string): string { if (!/^[a-z0-9-]+$/.test(name)) throw new Error("INVALID_JOB_RECORD"); return join(this.directory, `${digest(this.jobId)}.${name}.json`); }
  async read(name: string): Promise<unknown | null> {
    await this.ready(); let f: fs.FileHandle;
    try { f = await fs.open(this.path(name), constants.O_RDONLY | constants.O_NOFOLLOW); } catch (e) { if (code(e, "ENOENT")) return null; throw e; }
    try {
      const s = await f.stat(); if (!s.isFile() || s.size > 8 * 1024 * 1024 || (s.mode & 0o777) !== 0o600 || process.getuid && s.uid !== process.getuid()) throw new Error("INVALID_JOB_RECORD");
      const bytes = await f.readFile(); if (bytes.length > 8 * 1024 * 1024) throw new Error("INVALID_JOB_RECORD");
      await f.sync(); await this.sync(); return JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
    } finally { await f.close(); }
  }
  async publish(name: string, value: unknown): Promise<unknown> {
    await this.ready(); const path = this.path(name), temporary = join(this.directory, `.publish-${randomUUID()}.tmp`);
    const bytes = Buffer.from(JSON.stringify(value) + "\n"); if (bytes.length > 8 * 1024 * 1024) throw new Error("INVALID_JOB_RECORD");
    try {
      const f = await fs.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await f.writeFile(bytes); await f.sync(); } finally { await f.close(); }
      try { await fs.link(temporary, path); } catch (e) { if (!code(e, "EEXIST")) throw e; }
      await this.sync(); return await this.read(name);
    } finally { await fs.unlink(temporary).catch((e: unknown) => { if (!code(e, "ENOENT")) throw e; }); }
  }
}
