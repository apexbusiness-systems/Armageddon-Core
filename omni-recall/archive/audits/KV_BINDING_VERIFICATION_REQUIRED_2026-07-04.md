# KV Binding Verification Required — 2026-07-04

**Last reviewed**: 2026-07-04

Status: BLOCKED — cannot be resolved until Cloudflare credentials are made
available to the shell as environment variables without printing or committing
secret values. Verification attempt on 2026-07-04 used `npx wrangler --version`,
`npx wrangler kv namespace --help`, and `npx wrangler kv namespace list`;
Wrangler 4.86.0 reported that `CLOUDFLARE_API_TOKEN` is required in this
non-interactive environment before namespace state can be listed.

Do not paste token values into commands, logs, commits, PR text, or Markdown. In
a secure operator shell, export the account id and API token from the secret
manager, then run this against the Cloudflare account that owns
armageddon-core:

    export CLOUDFLARE_ACCOUNT_ID=<from-secret-manager>
    export CLOUDFLARE_API_TOKEN=<from-secret-manager>
    npx wrangler kv namespace list

Then check the Cloudflare Dashboard or API: Workers & Pages -> armageddon-core ->
Settings -> Bindings. The namespace-list command only proves namespace
existence; the dashboard/API binding view is required to prove the Worker is
bound to `RATE_LIMIT_KV`.

Record the answer below, then re-run this contract's Work Package 2:

- [ ] RATE_LIMIT_KV shows id 92d18e3aa55a4769b4485ffb3616f034, confirmed BOUND -> execute Branch A (Section 4.2)
- [ ] RATE_LIMIT_KV is NOT bound / namespace not found / belongs elsewhere -> execute Branch B (Section 4.3)
