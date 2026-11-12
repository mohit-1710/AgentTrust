import { cp, mkdir } from "node:fs/promises";
// The compiled conformance handler uses these exact committed public bytes.
await mkdir(new URL("../dist/fixtures/invoice-audit/", import.meta.url), { recursive: true });
await cp(new URL("../fixtures/invoice-audit/v1/", import.meta.url), new URL("../dist/fixtures/invoice-audit/v1/", import.meta.url), { recursive: true });
