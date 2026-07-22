# Upstash

## Contents
- What Upstash actually is
- Redis: REST vs TCP
- Other products (QStash, Vector, Workflow, Search, Realtime, Box)
- Edge/serverless patterns
- Pitfalls
- Verify

## What Upstash actually is

Upstash is a serverless data platform, not just "hosted Redis." Current product lineup: **Redis** (Redis-protocol-compatible KV store), **QStash** (HTTP message queue/scheduler), **Workflow** (durable workflows built on QStash), **Vector** (vector DB for embeddings/RAG), **Search** (full-text search on top of Redis), **Realtime** (pub/sub channels), and **Box** (sandboxed compute for running code/agents). Confirm which of these the task actually needs — it's common to reach for Redis Pub/Sub when QStash or Realtime is the better fit, or to hand-roll a queue when QStash already does retries/DLQ/scheduling.

Pricing and free-tier limits change — don't quote specific numbers from memory; check the current pricing page before it's a factor in a technical decision.

## Redis: REST vs TCP

Upstash Redis is reachable two ways:

- **REST/HTTP API** — the differentiator. Works from environments that can't hold a persistent TCP connection (Cloudflare Workers, most edge runtimes, browser-adjacent contexts). Every command is an HTTP request; each has connection/HTTP overhead (roughly 1–5ms) that plain TCP doesn't.
- **Native Redis protocol** — standard `redis-cli`/client libraries work as with any Redis, for traditional server environments where a persistent connection is fine and lower per-command latency matters.

Use REST for edge/serverless; use the native protocol for long-running servers where you'd otherwise use plain Redis clients anyway.

```javascript
import { Redis } from '@upstash/redis'
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
await redis.set('key', 'value', { ex: 3600 })   // TTL in seconds via options object, not SETEX string syntax
const val = await redis.get('key')
```

Not every Redis module/command is supported over REST — check command compatibility for anything beyond core data-structure commands (e.g. some Streams or scripting edge cases) before assuming parity with self-hosted Redis.

## Other products (quick reference)

- **QStash**: `client.publishJSON({ url, body })` — POST-and-forget with automatic retries and dead-letter handling; use for background jobs from a serverless function that can't run a persistent worker.
- **Vector**: `index.upsert([{ id, vector, metadata }])` / `index.query({ vector, topK })` — serverless vector search; pairs with `data:` embedding upsert if you want Upstash to embed for you rather than bringing your own vectors.
- **Workflow**: durable multi-step functions on top of QStash — survives serverless function timeouts by checkpointing steps.
- **Realtime**: pub/sub channels built on Upstash Redis, HTTP-native — the edge-compatible alternative to raw Redis Pub/Sub.
- **Ratelimit** (`@upstash/ratelimit`): prebuilt sliding-window/token-bucket limiter on top of Upstash Redis — prefer this over hand-rolling the pattern in `redis.md` when already on Upstash.

## Edge/serverless patterns

```javascript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
})
const { success } = await ratelimit.limit(identifier)
if (!success) return new Response("Rate limited", { status: 429 })
```

For request-scoped code (Workers, Edge Functions), reuse the client across invocations where the runtime allows module-level state — creating a new REST client per-request is cheap (it's just config, no connection to open) but still avoid redundant work in a hot path.

## Pitfalls

- **Treating Upstash as a drop-in for self-hosted Redis without checking command support** — most core commands work identically, but don't assume 100% module parity (see `redis.md` for what "full Redis" includes).
- **Ignoring the REST latency floor**: fine for typical web request patterns, but a tight loop of hundreds of sequential Upstash REST calls will be visibly slower than the same loop against local/native Redis — batch with pipelining (`redis.pipeline()`) instead of looping single commands.
- **Confusing Upstash Redis with Render Key Value**: both are Redis-protocol-compatible managed services but different vendors, different consoles, different env vars — don't mix credentials or assume one's CLI/dashboard applies to the other.

## Verify

```bash
curl "$UPSTASH_REDIS_REST_URL/ping" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
# expect: {"result":"PONG"}
```
