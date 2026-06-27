# APEX-DATA-ARCHITECT — Deep Reference Guide
## Extended Domain Mastery · Loaded On-Demand

---

## §FORENSICS — Full Diagnostic Matrix

| Symptom | First Check | Root Cause | Fix |
|---------|-------------|------------|-----|
| Query suddenly slow | `pg_stat_statements` top by `total_time` | Stale stats / plan regression | `ANALYZE table; SET enable_seqscan=off` to test |
| Deadlock | `pg_locks` + `pg_stat_activity` | Lock order inversion | Reorder ops · add advisory locks |
| Replication lag spike | `pg_stat_replication.write_lag` | Long txn on primary / slot bloat | Kill idle txns · drop stale slots |
| Data drift between envs | Row count + checksum comparison | Schema migration skipped in env | Flyway repair · force migration |
| Duplicate rows | COUNT(*) vs COUNT(DISTINCT pk) | Missing unique constraint / idempotency bug | Add constraint · replay dedup |
| Missing rows post-ETL | DLQ inspection | Transform exception silently dropped | Fix handler · replay DLQ |
| Wrong aggregation | Compare raw vs aggregated | Fanout join (many-to-many without dedup) | Use DISTINCT or pre-aggregate |
| Cassandra hotspot | nodetool tpstats · token distribution | Partition key with low cardinality | Redesign partition key · add bucket suffix |
| MongoDB slow query | `db.collection.explain("executionStats")` | Missing index / COLLSCAN | Create compound index matching query pattern |
| Kafka consumer lag | consumer group describe | Consumer too slow / rebalance loop | Scale consumers · tune `max.poll.records` |
| Redis memory bloat | `memory doctor` · `OBJECT ENCODING key` | Large keys / no TTL / unoptimized types | Set TTL · use HASH over many STRING keys |
| BigQuery slot exhaustion | INFORMATION_SCHEMA.JOBS | Long-running query holding slots | Partition pruning · BI Engine reservation |
| Snowflake spillage | Query profile → spilling to disk | warehouse too small / skewed join | Increase WH size · pre-sort join keys |
| dbt test failure | `dbt test --select model` | Source data changed / model logic bug | Inspect source · add dbt source freshness |

---

## §QUERY-PATTERNS — Anti-Pattern Catalog

### PostgreSQL Anti-Patterns with Fixes

```sql
-- ❌ ANTI: Implicit cast kills index
SELECT * FROM orders WHERE order_date = '2024-01-01';  -- order_date is TIMESTAMPTZ

-- ✅ FIX: Explicit cast or range
SELECT * FROM orders 
WHERE order_date >= '2024-01-01'::timestamptz 
  AND order_date <  '2024-01-02'::timestamptz;

-- ❌ ANTI: Function on indexed column
SELECT * FROM users WHERE LOWER(email) = 'jdoe@example.com';

-- ✅ FIX: Functional index + query to match
CREATE INDEX idx_users_email_lower ON users (LOWER(email));
SELECT * FROM users WHERE LOWER(email) = 'jdoe@example.com';

-- ❌ ANTI: NOT IN with NULLs (returns empty set if any NULL in subquery)
SELECT * FROM orders WHERE user_id NOT IN (SELECT id FROM deleted_users);

-- ✅ FIX: NOT EXISTS
SELECT * FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM deleted_users d WHERE d.id = o.user_id);

-- ❌ ANTI: OFFSET pagination at scale
SELECT * FROM events ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- ✅ FIX: Keyset (cursor) pagination
SELECT * FROM events 
WHERE created_at < $last_cursor_ts 
ORDER BY created_at DESC LIMIT 20;

-- ❌ ANTI: COUNT(*) on large table
SELECT COUNT(*) FROM events;  -- full seq scan

-- ✅ FIX: Estimate for UI, exact for reports
SELECT reltuples::bigint FROM pg_class WHERE relname = 'events';  -- O(1) estimate
```

---

## §SCHEMA-PATTERNS — Canonical Templates

### Leaderboard / Ranking Table (Universal)

```sql
CREATE TABLE player_leaderboard (
    player_id     UUID         NOT NULL,
    league_id     SMALLINT     NOT NULL,
    season_id     SMALLINT     NOT NULL,
    games_played  SMALLINT     NOT NULL DEFAULT 0,
    -- Stat columns
    pts_total     INTEGER      NOT NULL DEFAULT 0,
    reb_total     INTEGER      NOT NULL DEFAULT 0,
    ast_total     INTEGER      NOT NULL DEFAULT 0,
    stl_total     INTEGER      NOT NULL DEFAULT 0,
    blk_total     INTEGER      NOT NULL DEFAULT 0,
    to_total      INTEGER      NOT NULL DEFAULT 0,
    -- Derived metric (recalculated on every game_stats INSERT)
    cpi_score     NUMERIC(8,3) NOT NULL DEFAULT 0,
    rank          SMALLINT,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_id, league_id, season_id)
);
-- Primary leaderboard query: league + season ordered by score
CREATE INDEX idx_lb_league_season_score ON player_leaderboard (league_id, season_id, cpi_score DESC);
-- Player lookup across seasons
CREATE INDEX idx_lb_player_season ON player_leaderboard (player_id, season_id);
```

### Event Ingest Table (Idempotent, Streaming-Safe)

```sql
CREATE TABLE game_events (
    event_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_event_id   TEXT         NOT NULL,   -- upstream dedup key
    game_id           UUID         NOT NULL,
    event_type        TEXT         NOT NULL,   -- 'score' | 'foul' | 'sub' | 'timeout'
    player_id         UUID,
    team_id           UUID         NOT NULL,
    payload           JSONB        NOT NULL DEFAULT '{}',
    occurred_at       TIMESTAMPTZ  NOT NULL,
    ingested_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_duplicate      BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_source_event UNIQUE (source_event_id)  -- idempotency guard
);
CREATE INDEX idx_events_game_type   ON game_events (game_id, event_type);
CREATE INDEX idx_events_occurred_at ON game_events (occurred_at DESC);
CREATE INDEX idx_events_player      ON game_events (player_id) WHERE player_id IS NOT NULL;
```

### Audit Log Table (Append-Only, Compliance-Safe)

```sql
CREATE TABLE audit_log (
    log_id       BIGSERIAL    PRIMARY KEY,
    entity_type  TEXT         NOT NULL,   -- 'player' | 'game' | 'team' | 'user'
    entity_id    UUID         NOT NULL,
    action       TEXT         NOT NULL,   -- 'INSERT' | 'UPDATE' | 'DELETE' | 'PURGE'
    actor_id     UUID         NOT NULL,
    actor_role   TEXT         NOT NULL,
    before_state JSONB,
    after_state  JSONB,
    ip_address   INET,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- IMPORTANT: No UPDATE or DELETE on this table — append-only enforced via trigger or RLS
CREATE INDEX idx_audit_entity   ON audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor    ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX idx_audit_occurred ON audit_log USING BRIN (occurred_at);  -- time-range scans
```

---

## §PIPELINE-PATTERNS — Production Templates

### Kafka → PostgreSQL (Exactly-Once via Outbox)

```python
from dataclasses import dataclass
from typing import Optional
import psycopg2
from confluent_kafka import Consumer, KafkaError

@dataclass
class GameEvent:
    source_event_id: str
    game_id: str
    event_type: str
    player_id: Optional[str]
    team_id: str
    payload: dict
    occurred_at: str

def ingest_event(conn, event: GameEvent) -> bool:
    """Idempotent event ingestion — safe to call multiple times."""
    sql = """
        INSERT INTO game_events
            (source_event_id, game_id, event_type, player_id, team_id, payload, occurred_at)
        VALUES
            (%(source_event_id)s, %(game_id)s, %(event_type)s,
             %(player_id)s, %(team_id)s, %(payload)s::jsonb, %(occurred_at)s)
        ON CONFLICT (source_event_id) DO UPDATE
            SET is_duplicate = TRUE,
                ingested_at  = NOW()
        RETURNING is_duplicate
    """
    with conn.cursor() as cur:
        cur.execute(sql, event.__dict__)
        row = cur.fetchone()
        conn.commit()
        return not row[0]  # True = new event, False = duplicate

def consume_loop(consumer: Consumer, conn):
    """Main consume loop with DLQ routing."""
    while True:
        msg = consumer.poll(timeout=1.0)
        if msg is None:
            continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                continue
            route_to_dlq(msg)
            continue
        try:
            event = parse_event(msg.value())
            is_new = ingest_event(conn, event)
            consumer.commit(asynchronous=False)  # manual commit = exactly-once
        except Exception as e:
            route_to_dlq(msg, error=str(e))
```

### dbt Incremental Model (Idempotent)

```sql
-- models/marts/player_season_stats.sql
{{
  config(
    materialized   = 'incremental',
    unique_key     = ['player_id', 'league_id', 'season_id'],
    on_schema_change = 'sync_all_columns',
    incremental_strategy = 'merge'
  )
}}

WITH game_stats AS (
    SELECT
        player_id,
        league_id,
        season_id,
        COUNT(DISTINCT game_id)         AS games_played,
        SUM(pts)                        AS pts_total,
        SUM(reb)                        AS reb_total,
        SUM(ast)                        AS ast_total,
        SUM(stl)                        AS stl_total,
        SUM(blk)                        AS blk_total,
        SUM(turnovers)                  AS to_total,
        -- CPI formula
        ROUND(
            SUM(pts)      * 1.0 +
            SUM(reb)      * 1.2 +
            SUM(ast)      * 1.5 +
            SUM(stl)      * 2.0 +
            SUM(blk)      * 2.0 -
            SUM(turnovers)* 1.5
        , 3)                            AS cpi_score
    FROM {{ ref('stg_game_player_stats') }}
    {% if is_incremental() %}
        WHERE game_date > (SELECT MAX(game_date) FROM {{ this }})
    {% endif %}
    WHERE NOT is_dnp  -- exclude Did Not Play
    GROUP BY 1, 2, 3
)

SELECT
    *,
    RANK() OVER (
        PARTITION BY league_id, season_id
        ORDER BY cpi_score DESC, pts_total DESC, games_played DESC
    ) AS cpi_rank
FROM game_stats
WHERE games_played >= 3  -- minimum qualifying threshold
```

---

## §DATA-MODELING — Paradigm Selection Guide

| Paradigm | Use When | Avoid When | Key Benefit |
|----------|----------|------------|-------------|
| **3NF** | OLTP, frequent writes, DML-heavy | Analytics, BI reporting | Write performance, integrity |
| **Star Schema** | BI/OLAP, dimensional analytics | Frequent updates to dims | Query simplicity, BI tool compat |
| **Snowflake Schema** | Large dims with sub-dimensions | Performance is priority | Storage efficiency |
| **Data Vault** | Full history, regulatory, auditable | Fast prototyping needed | Auditability, flexibility |
| **Wide Table (OBT)** | ML feature serving, ClickHouse | Many-to-many relationships | Read performance |
| **Entity-Centric** | Event sourcing, temporal data | Simple CRUD | Complete history replay |

---

## §COMPLIANCE — PII Classification & Remediation

```
DIRECT IDENTIFIERS:  name · email · phone · SSN · passport · DOB · address · photo
QUASI-IDENTIFIERS:   IP address · device_id · zip code · employer · job title
SENSITIVE SPECIAL:   health data · biometric · financial · political · sexual orientation

REMEDIATION TECHNIQUES:
  Masking        → show first/last char only: J*** D**  (reversible with key)
  Tokenization   → replace with non-sensitive token mapped in secure vault
  Generalization → DOB → age_range '30-40' · address → city only
  Perturbation   → add statistical noise to numeric PII (salary ±10%)
  Pseudonymization → hash(PII + secret_salt) · right-to-erasure = delete salt

GDPR RIGHT TO ERASURE:
  Never physically delete — pseudonymize by rotating the per-user salt
  Log the erasure event in audit_log with legal_hold=false
  Verify: SELECT COUNT(*) FROM table WHERE user_id = $deleted_id → must return 0
```

---

## §PERFORMANCE-TUNING — PostgreSQL Key Knobs

```sql
-- Memory (tune to 25% RAM for shared_buffers, 75% for effective_cache_size)
ALTER SYSTEM SET shared_buffers        = '4GB';
ALTER SYSTEM SET effective_cache_size  = '12GB';
ALTER SYSTEM SET work_mem              = '64MB';   -- per sort/hash op
ALTER SYSTEM SET maintenance_work_mem  = '1GB';    -- for VACUUM, CREATE INDEX

-- Parallel Query
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers            = 8;

-- WAL / Checkpoint
ALTER SYSTEM SET wal_buffers           = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size          = '4GB';

-- Stats / Planning
ALTER SYSTEM SET default_statistics_target = 200;  -- default 100; increase for skewed cols
ALTER SYSTEM SET random_page_cost      = 1.1;       -- SSD: set to 1.1 (default 4.0 = HDD)

SELECT pg_reload_conf();  -- apply without restart
```

---

## §VECTOR-DB — Embedding & Similarity Search

```python
# pgvector example — semantic search on player descriptions
# Prerequisite: CREATE EXTENSION vector;

# Schema
CREATE TABLE player_embeddings (
    player_id   UUID         PRIMARY KEY REFERENCES players(id),
    embedding   vector(1536) NOT NULL,   -- OpenAI ada-002 dimensions
    model_ver   TEXT         NOT NULL,
    indexed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_player_embed_cosine 
    ON player_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);  -- sqrt(row_count) is a good starting point

# Query — find top-10 most similar players to a given player
SELECT p.name, 1 - (pe.embedding <=> $query_embedding) AS similarity
FROM player_embeddings pe
JOIN players p ON p.id = pe.player_id
ORDER BY pe.embedding <=> $query_embedding  -- <=> = cosine distance
LIMIT 10;
```

---

## §API-CONTRACTS — JSON Schema Templates

```json
// Player Leaderboard API Response Contract v1
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LeaderboardResponse",
  "type": "object",
  "required": ["league_id", "season_id", "generated_at", "players"],
  "properties": {
    "league_id":     { "type": "integer", "enum": [1, 2, 3] },
    "season_id":     { "type": "integer", "minimum": 1 },
    "generated_at":  { "type": "string", "format": "date-time" },
    "players": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["rank", "player_id", "name", "games_played", "cpi_score"],
        "properties": {
          "rank":         { "type": "integer", "minimum": 1 },
          "player_id":    { "type": "string", "format": "uuid" },
          "name":         { "type": "string" },
          "games_played": { "type": "integer", "minimum": 0 },
          "cpi_score":    { "type": "number" },
          "pts_avg":      { "type": "number" },
          "reb_avg":      { "type": "number" },
          "ast_avg":      { "type": "number" }
        }
      }
    }
  }
}
```

---

**APEX-DATA-ARCHITECT v1.0 — Deep Reference**
**Proprietary — APEX Business Systems Ltd.**
