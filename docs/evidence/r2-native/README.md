# r2 native testnet proof extract

These [selected public RPC fields](public-rpc-extract.json) come from five direct AgentTrust r2 transactions captured on 12 November 2026. The source commit was `315503c59eb5b515768d4c7c176983180ff15576`. The deployed production core was `core.agenttrust-73cf3674cd1978d09120a484.testnet`, with on-chain code hash `HWp3imxWMrJgKQ7zAA2muWZYcXozELiWikUnLV6DwHxS`. The extract records the exact transaction and receipt IDs, contract return, final payment views, service-account balances and SHA-256 hashes of the retained source artifacts.

| Direct call | Transaction | Return and final payment view | Service payout in that call |
| --- | --- | --- | --- |
| Missing credential | `FqN8uJV14CYu6CQxQcY947zPktanjk2Z4Q8QBuEMvymN` | `MISSING`; payment absent before and after | None |
| Eligible purchase | `8n9Dvkt9Wz46QpDajsQi4D5nDuaTY6vfndJjnfmpr1LV` | Returns `pending`; final view `settled` | One `0.002 NEAR` transfer to B |
| Exact retry | `C1nbaeEMkLbRX1Mi3LWC8q6oRyvFjsTeAzvHCCX68oGt` | Returns `duplicate:true` and `settled`; payment view bytes unchanged | None |
| Revoked credential | `GE8A2m21EsxqczmJeJuDWf8egNLrPmyDjjUGazAmz5zE` | `REVOKED`; payment absent before and after | None |
| Changed identity | `5b3chx8L71rbPp9vVzcDVwcofd24KqQ4kjiN8ziDB3Vf` | `IDENTITY_CHANGED`; payment absent before and after | None |

Each transaction response reached `FINAL`. The rejected calls returned a contract rejection decision inside a successful NEAR transaction; they did not create a payment or service transfer. The purchase receipt chain includes the core-to-B transfer and the private self-callback. The retry has no second service transfer. The full [r2 evidence review](../../testnet-r2-evidence.md) binds the synthetic audit report, restricted worker key, credential setup, scripted MCP buyer and other setup transactions.

To inspect one transaction independently, query the public testnet RPC. Replace the hash with another transaction from the table to inspect a different case; the sender remains the owner account:

```sh
curl --fail --silent --show-error https://test.rpc.fastnear.com \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":"r2-purchase","method":"EXPERIMENTAL_tx_status","params":{"tx_hash":"8n9Dvkt9Wz46QpDajsQi4D5nDuaTY6vfndJjnfmpr1LV","sender_account_id":"owner.agenttrust-73cf3674cd1978d09120a484.testnet","wait_until":"FINAL"}}'
```

The JSON is an allowlisted projection of dated RPC replies, not a new live observation or a full raw capture. Original, hash-addressed responses remain in the ignored local evidence directory. Public RPC may change availability or return a later view of state; the recorded before/after balances and payment-view hashes are historical observations, not light-client proofs. This extract does not establish the actual-model run, two complete rehearsals or the still-open native refund-gap case.
