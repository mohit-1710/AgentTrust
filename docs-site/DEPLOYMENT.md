# Deployment

Target: `docs.agenttrust.tech`

## Vercel

1. Import `agenttrust-labs/agenttrust` into Vercel.
2. Set Root Directory to `docs-site`.
3. Keep Framework Preset as `Next.js`.
4. Set the build command to:

```bash
pnpm build
```

5. Set the install command to:

```bash
pnpm install --frozen-lockfile
```

6. Add environment variable:

```bash
OPENAI_API_KEY=<Mohit's key>
```

7. Add production domain:

```text
docs.agenttrust.tech
```

## DNS

In GoDaddy, add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `docs` | `cname.vercel-dns.com` | `600` |

Remove any conflicting `A`, `AAAA`, or CNAME records for `docs`.

## Cutover check

After DNS propagates:

1. Confirm Vercel shows the domain as valid.
2. Confirm HTTPS is active.
3. Open `/`.
4. Open the search dialog.
5. Ask one Ask-AI question and confirm the response streams.
6. Check Vercel function logs for `/api/ask`.

Vercel usually provisions SSL within 5-10 minutes after the DNS record resolves.
