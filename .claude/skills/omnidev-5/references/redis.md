# Redis (self-hosted / ElastiCache / Redis Cloud)

## Contents
- Data structures at a glance
- Persistence
- Eviction & memory
- Patterns (cache, lock, rate limit, pub/sub)
- Pitfalls
- Verify

This file covers Redis-the-database on a server you (or a managed service) run with a persistent TCP connection. For Upstash's serverless/REST take on Redis, see `upstash.md`. For Render's managed offering, see `render.md#key-value`.

## Data structures at a glance

| Type | Use for | Key commands |
|---|---|---|
| String | Simple cache value, counters | `SET`/`GET`, `INCR`, `SETEX key ttl val` |
| Hash | Object with fields (avoid one giant JSON string if you need partial reads/writes) | `HSET`, `HGET`, `HGETALL` |
| List | Queue/stack, recent-items feed | `LPUSH`/`RPUSH`, `LRANGE`, `BLPOP` (blocking pop) |
| Set | Unique membership, tag sets | `SADD`, `SISMEMBER`, `SINTER` |
| Sorted Set | Leaderboards, time-ordered windows | `ZADD`, `ZRANGE`/`ZRANGEBYSCORE`, `ZINCRBY` |
| Stream | Event log / lightweight message queue with consumer groups | `XADD`, `XREADGROUP`, `XACK` |

## Persistence

- **RDB**: point-in-time snapshot at configured intervals. Fast restarts, but can lose the last few minutes of writes on a crash.
- **AOF**: append-only log of writes, replayed on restart. Configurable fsync policy (`always`/`everysec`/`no`) trades durability for throughput — `everysec` is the common default middle ground.
- Most production setups run both (RDB for fast full restores, AOF for tighter durability) — check `redis.conf` (`save` directives, `appendonly yes`) rather than assuming defaults match intent.
- Persistence is not a backup strategy on its own — snapshot files should be copied off-instance on a schedule.

## Eviction & memory

When `maxmemory` is hit, `maxmemory-policy` decides what happens:

- `noeviction` (default): writes start erroring — fine only if you've sized memory with headroom and want a hard signal rather than silent data loss.
- `allkeys-lru` / `volatile-lru`: evict least-recently-used, across all keys or only keys with a TTL set.
- `volatile-ttl`: evict keys closest to expiring first.

Pick based on whether Redis is your source of truth (favor `noeviction` + capacity planning) or a cache (`allkeys-lru` is usually right).

## Patterns

**Cache-aside**: read from cache, on miss read from DB and populate cache with a TTL. Always set a TTL on cache entries — an un-expiring cache is a slow memory leak and a staleness bug waiting to happen.

**Distributed lock (single instance)**: `SET lock:resource token NX PX 30000`, release only if the value matches your token (compare-and-delete via a small Lua script, not a plain `DEL`, to avoid deleting a lock you don't own after your own TTL expired and someone else acquired it):

```
SET lock:job:123 "<uuid>" NX PX 30000
-- release --
EVAL "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" 1 lock:job:123 "<uuid>"
```

For locks that must survive single-node failure, use the Redlock algorithm across multiple independent instances — a single-instance lock is not safe against that instance failing over.

**Rate limiting**: sliding-window counter via `INCR` + `EXPIRE` (simple, slightly bursty at window edges) or a sorted-set sliding log (`ZADD` timestamp, `ZREMRANGEBYSCORE` to trim, `ZCARD` to count) for precise sliding windows.

**Pub/Sub**: fire-and-forget, no persistence or replay — a subscriber that's briefly disconnected loses messages published during the gap. If delivery guarantees matter, use Streams with consumer groups instead.

## Pitfalls

- **`KEYS *` in production**: blocks the single-threaded event loop while it scans the whole keyspace. Use `SCAN` (cursor-based, non-blocking) for any production key enumeration.
- **Hot key**: one key taking disproportionate traffic (e.g. a global counter) becomes a bottleneck even though overall load is fine — shard it (`counter:{shard}`) if it shows up in slow-log or latency spikes.
- **TTL race on cache-aside**: two requests miss cache simultaneously, both hit the DB, both write cache — usually harmless, but for expensive recomputation use a lock or request-coalescing to avoid a thundering herd on expiry.
- **Cluster vs Sentinel**: Sentinel gives you HA (automatic failover) for a single logical dataset; Cluster additionally shards data across nodes for horizontal scale. Don't reach for Cluster's added complexity (hash slots, multi-key command restrictions across slots) unless you actually need to scale past one node's memory/throughput.

## Verify

```bash
redis-cli PING                       # expect PONG
redis-cli INFO persistence | grep aof_enabled
redis-cli CONFIG GET maxmemory-policy
```
