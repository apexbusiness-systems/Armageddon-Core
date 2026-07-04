# Local Worker Credentials Required — 2026-07-04

**Last updated**: 2026-07-04

**Status**: BLOCKED — cloud-connected local worker needs these values, only
retrievable by whoever holds Cloudflare dashboard access for armageddon-core.

**Docker inventory note**: This Codex environment cannot complete the Docker
Desktop pre-flight inventory because the `docker` CLI is not installed in this
shell. Run the inventory commands from the Windows Docker Desktop host before
starting either compose stack, and leave unrelated containers untouched.

Open: Cloudflare Dashboard -> Workers & Pages -> armageddon-core -> Settings
-> Variables and secrets. These values are write-only (cannot be re-read from
the dashboard) -- if you don't have them recorded elsewhere, you'll need to
rotate them (generate new values, update BOTH Cloudflare and .env.moat).

Fill in .env.moat directly (never paste these into a chat/agent prompt) with:
- [ ] TEMPORAL_ADDRESS   (your Temporal Cloud cluster address, e.g. <namespace>.<account>.tmprl.cloud:7233)
- [ ] TEMPORAL_NAMESPACE (your Temporal Cloud namespace)
- [ ] TEMPORAL_API_KEY   (same value as Cloudflare's TEMPORAL_API_KEY secret)
- [ ] SUPABASE_SERVICE_ROLE_KEY (same value as Cloudflare's SUPABASE_SERVICE_ROLE_... secret)
- [ ] ARMAGEDDON_ATTESTATION_SEED (the EXACT same hex value already set in
      Cloudflare -- not a new one. If signer and publisher ever use different
      seeds, third-party signature verification breaks silently.)

Before running Docker Compose, also add this non-secret healthcheck alignment
to .env.moat:

```bash
WORKER_HEALTH_PORT=8081
```

Once .env.moat is filled in, re-run the local Docker Desktop worker deployment
contract from Section 0 (inventory), then Section 3 (Branch A).
