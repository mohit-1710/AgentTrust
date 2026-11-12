# Resume a legacy bootstrap with the current testnet RPC

The former `https://rpc.testnet.near.org` endpoint returned a deprecation/rate-limit error during rehearsal preparation. NEAR's [official RPC provider list](https://docs.near.org/api/rpc/providers) lists `https://test.rpc.fastnear.com`. Fresh templates and bootstrap bundles now use that fixed endpoint. This is an explicit offline migration for an existing legacy bootstrap, not automatic RPC failover or a new payment attempt.

Stop all processes using the bundle first. This narrow migration is permitted only before T18 or buyer work: `attempts`, `buyer-jobs`, `buyer-scripted.json`, `buyer-near-ai.json` and `buyer-local-model.json` must all be absent, including empty files/directories or symlinks. Existing bootstrap faucet/child claims and evidence are preserved. Do not delete payment/job records to satisfy this prerequisite.

From the accepted repository root, with `AGENTTRUST_DEMO_DIR` still naming the original private directory:

```sh
(
  set -eu
  . scripts/env.sh
  pnpm build:services
  pnpm demo:bootstrap:testnet --migrate-rpc-fastnear --directory "$AGENTTRUST_DEMO_DIR"
)
```

The helper validates the full original bundle offline and atomically publishes the private immutable `rpc-migration-fastnear.json` intent, bound to the original manifest bytes and original demo hash. Only then does it atomically replace the `rpc_url` field in `demo.json`, `provider-a.json`, `provider-b.json` and `mcp.json`. It never rewrites `bootstrap.json`, secrets, existing claims/evidence, IDs, paths, expiry or prices. Existing provider TLS paths are preserved, and later valid TLS-path edits remain supported. No network request, account creation, signing or model call occurs.

If interrupted, keep the same directory and marker. Ordinary bundle loading and direct T18 config reads refuse a partial set. The direct read guard uses public files only, preserving keyless observations. Resume the same fixed transition explicitly:

```sh
pnpm demo:bootstrap:testnet --resume-rpc-fastnear --directory "$AGENTTRUST_DEMO_DIR"
```

Resume accepts only the validated original/new RPC forms and rejects unrelated changes. If interruption happened before the intent was published, the first command can be run again because no public config changed. Never hand-edit an intent or replace IDs. A resumed completed migration is a local no-op; it does not resend a bootstrap operation.

After success, keep using the original operation claims. Observe any previously claimed faucet/child step with its existing `observe-` command; do not rerun completed steps. Continue only at a step with no claim after resolving the preceding operations. The bootstrap reads through the active demo RPC and new evidence records that endpoint plus the migration hash; old evidence retains its original bytes. Migration success is not fresh chain verification or a native/model gate pass. Follow the [operator route](testnet-operator.md) only after the original bootstrap state is resolved.
