---
status: complete
quick_id: 260424-dty
date: 2026-04-24
---

# Summary

Implemented the backend terminology refactor so prediction markets now have canonical `Market` model names and fresh database tables:

- Added `app.db.models.market` with `Market`, `MarketPosition`, `MarketPositionHistory`, and `MarketUpvote`.
- Kept `app.db.models.bet` as a compatibility shim for legacy imports.
- Renamed fresh Alembic schema tables from `bets`/`bet_positions`/`position_history`/`bet_upvotes` to `markets`/`market_positions`/`market_position_history`/`market_upvotes`.
- Updated backend services, routes, workers, tests, and `scripts/seed_dev.py` to import/use the canonical market models.
- Preserved public `/api/bets/...` route and `bet_id` payload compatibility via ORM synonyms where needed.
- Consolidated `bet_id` compatibility in `market.py` to SQLAlchemy synonyms only; `app.db.models.bet` remains the single legacy import shim.
- Adjusted the auth E2E logout expectation to the current route behavior: unauthenticated users land on public `/`, not `/login`.

# Verification

Passed:

- `POSTGRES_DB=test POSTGRES_USER=test POSTGRES_PASSWORD=test DATABASE_URL=sqlite+aiosqlite:///:memory: REDIS_URL=redis://localhost:6379 SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing .venv/bin/python -m pytest tests/test_market_model_terminology.py -q`
- `POSTGRES_DB=test POSTGRES_USER=test POSTGRES_PASSWORD=test DATABASE_URL=sqlite+aiosqlite:///:memory: REDIS_URL=redis://localhost:6379 SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing .venv/bin/python -m compileall app tests scripts`
- Sync SQLAlchemy metadata creation against SQLite after the repo's JSONB test patch.
- User reran the broader test suite and reported the backend/refactor tests passed.
- `make e2e` reached 3/4 passing; the single failure was the stale logout redirect expectation and has been updated.

Not rerun by this agent:

- Full Docker-backed `make e2e` after the auth spec adjustment.
