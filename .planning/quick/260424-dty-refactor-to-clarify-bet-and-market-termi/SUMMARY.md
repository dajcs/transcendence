---
status: incomplete
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

# Verification

Passed:

- `POSTGRES_DB=test POSTGRES_USER=test POSTGRES_PASSWORD=test DATABASE_URL=sqlite+aiosqlite:///:memory: REDIS_URL=redis://localhost:6379 SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing .venv/bin/python -m pytest tests/test_market_model_terminology.py -q`
- `POSTGRES_DB=test POSTGRES_USER=test POSTGRES_PASSWORD=test DATABASE_URL=sqlite+aiosqlite:///:memory: REDIS_URL=redis://localhost:6379 SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing .venv/bin/python -m compileall app tests scripts`
- Sync SQLAlchemy metadata creation against SQLite after the repo's JSONB test patch.

Blocked:

- `tests/test_bets.py::test_place_yes_bet` timed out while the async SQLite fixture was acquiring an `aiosqlite` connection in this sandbox. Full async API-suite verification still needs a clean local run.
- Docker-backed `make seed` was not run because it requires Docker services/fresh DB lifecycle outside this sandbox run.
