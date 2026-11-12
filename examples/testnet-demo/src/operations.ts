import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { validateTransactionLocator } from "../../../packages/near-sdk/src/attempts.js";
import type { TransactionLocator } from "../../../packages/near-sdk/src/views.js";
import { sha256, type DemoConfig } from "./config.js";
import { ensure } from "./capture.js";

/** A single direct transaction per named operation, across captures and process crashes.
 * A lost response is observed, never retried under a new nonce. Ordinary files, no database.
 */
export class OperationJournal {
  private readonly file: string;
  constructor(private readonly config: DemoConfig, readonly operation: string, private readonly actor: string) {
    const key = sha256(JSON.stringify([config.network, config.core_account, actor, operation]));
    this.file = path.join(config.attempts_directory, `operation-${key}.json`);
  }
  private async ready(): Promise<void> {
    await mkdir(this.config.attempts_directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    const stat = await lstat(this.config.attempts_directory);
    ensure(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700 && (!process.getuid || stat.uid === process.getuid()), "UNSAFE_OPERATION_DIRECTORY");
    await this.sync(path.dirname(this.config.attempts_directory));
  }
  private async sync(directory = this.config.attempts_directory): Promise<void> {
    const file = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await file.sync(); } finally { await file.close(); }
  }
  async existing(): Promise<TransactionLocator | null> {
    await this.ready();
    let file;
    try { file = await open(this.file, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    try {
      const stat = await file.stat();
      ensure(stat.isFile() && stat.size <= 1024 && (stat.mode & 0o777) === 0o600 && (!process.getuid || stat.uid === process.getuid()), "UNSAFE_OPERATION_FILE");
      const value: unknown = JSON.parse(await file.readFile("utf8"));
      validateTransactionLocator(value, this.actor);
      await file.sync(); await this.sync();
      return value;
    } finally { await file.close(); }
  }
  async claim(transaction: TransactionLocator): Promise<void> {
    validateTransactionLocator(transaction, this.actor);
    await this.ready();
    // Exclusive creation also prevents two concurrent processes from both sending.
    const file = await open(this.file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(JSON.stringify(transaction) + "\n"); await file.sync(); }
    finally { await file.close(); }
    await this.sync();
  }
}
