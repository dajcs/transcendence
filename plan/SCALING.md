# Scaling & Performance

## Target Capacity

| Metric | v1 Target | Design Headroom |
|---|---|---|
| Concurrent WebSocket connections | 200 | 1000 |
| Concurrent REST requests | 100 req/s | 500 req/s |
| Database connections | 20 | 100 |
| Active bets | 500 | 5000 |
| Total users | 1000 | 10000 |

v1 targets a 42 school evaluation environment (small cluster). Design for 5x headroom.

---

## Database Connection Pooling

### SQLAlchemy Async Pool
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,         # persistent connections
    max_overflow=5,       # burst connections
    pool_timeout=30,      # wait before error
    pool_pre_ping=True,   # detect stale connections
)
```

- Total max connections: 15 per worker
- With 2 workers: 30 connections to PostgreSQL
- PostgreSQL `max_connections`: set to 100 (safe margin)
- If needed: add PgBouncer as connection pooler in front of PostgreSQL

### Redis Connection Pool
```python
redis = aioredis.from_url(
    REDIS_URL,
    max_connections=20,
    decode_responses=True,
)
```

---

## Socket.IO Scalability

### v1 (Single Server)
- python-socketio with async mode
- Redis used as message backend even on single server (eases future horizontal scale)
- Max ~1000 concurrent connections per Python process
- Monitor with: `len(sio.manager.rooms.get('/', {}))`

### Horizontal Scale (if needed)
```python
mgr = socketio.AsyncRedisManager(REDIS_URL)
sio = socketio.AsyncServer(client_manager=mgr)
```
- Multiple server instances share Redis pub-sub
- Load balancer: sticky sessions required (or stateless via Redis session store)
- Nginx upstream config: `ip_hash` for sticky sessions

---

## Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|---|---|---|---|
| bp balance | `bp_balance:{user_id}` | 30s | On bp transaction |
| Bet odds | `bet_odds:{bet_id}` | 10s | On position change |
| User profile | `user_profile:{user_id}` | 60s | On profile update |
| Trending bets | `trending_bets` | 60s | Time-based |
| LLM budget | `llm_spend:{YYYY-MM}` | end of month | On each LLM call |

Cache-aside pattern: check Redis → miss → query DB → write Redis → return.

---

## Rate Limiting

Implemented via Redis counters with sliding window:

```python
async def rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_seconds)
    return count <= limit
```

| Action | Limit | Window |
|---|---|---|
| Login attempts | 5 | 15 min (per IP) |
| Bet creation | 10 | 1 hour (per user) |
| Comment posting | 30 | 1 hour (per user) |
| Dispute opening | 3 | 24 hours (per user) |
| LLM summarizer | 5 | 24 hours (per user) |
| API endpoints (general) | 100 | 1 min (per user) |

429 responses include `Retry-After` header.

---

## Database Indexes

See DATABASE.md for full index list. Summary of hot paths:

- Bets by status + deadline: `idx_bets_status`, `idx_bets_deadline`
- User transactions (balance): `idx_bp_transactions_user`
- Comments per bet: `idx_comments_bet`

Query plans audited via `EXPLAIN ANALYZE` before production.

---

## Celery Task Queue

Workers and tasks:

| Task | Schedule | Priority |
|---|---|---|
| Daily bp allocation | 00:00 UTC | High |
| Daily kp reset | 00:00 UTC | High |
| Bet deadline check | Every 5 min | Normal |
| Auto-resolution polling | Every 5 min | Normal |
| Log cleanup (90-day) | Daily 03:00 UTC | Low |
| LLM budget reset | 1st of month | Low |

Worker config: `--concurrency=4` (4 parallel workers), `--queues=high,default,low`

---

## Load Testing

Before any production deployment:

1. **Tool:** Locust (`uv add locust`)
2. **Scenarios:**
   - 200 concurrent users viewing bets (WebSocket + REST)
   - 50 concurrent users placing bets simultaneously (concurrency test)
   - 20 concurrent dispute votes (DB lock test)
3. **Success criteria:**
   - P95 REST response < 200ms
   - P95 WebSocket message delivery < 500ms
   - Zero deadlocks or balance inconsistencies
   - Zero 5xx errors under normal load

---

## Monitoring

### Metrics to Track
- Response time (P50, P95, P99) per endpoint
- Database query time
- Redis cache hit rate
- WebSocket connection count
- Celery task queue depth
- LLM spend (see LLM_INTEGRATION.md)

### Tools
- Nginx access logs → parse for response times
- FastAPI middleware: log slow requests (> 500ms)
- PostgreSQL `pg_stat_statements`: track slow queries
- Docker stats for container resource usage

### Alerts
- Any 5xx spike > 1% of requests
- DB connection pool exhaustion (pool_timeout errors)
- Redis memory usage > 80%
- LLM monthly budget > 80%

---

*Last updated: 2026-03-24*
