---
status: planned
created: 2026-04-24
scope: backend
---

# Backend Terminology Refactor: Bet -> Market

Goal: make the persistence model and backend internals use `Market` terminology for prediction markets, while keeping wager/position concepts distinct and preserving `/api/bets/...` route compatibility unless a backend-only rename is provably safe.

## Constraints

- Backend, tests, and seed only unless an API shape change is unavoidable.
- No Alembic migration. Update the initial schema directly for fresh databases.
- `make seed` must work against the updated initial schema.
- Prefer compatibility shims over broad route/request/response churn.

## Likely Files

- Create: `backend/app/db/models/market.py`
- Modify: `backend/app/db/models/__init__.py`
- Modify or replace with compatibility aliases: `backend/app/db/models/bet.py`
- Modify: `backend/app/services/market_service.py`
- Modify: `backend/app/services/bet_service.py`
- Modify: `backend/app/services/comment_service.py`
- Modify: `backend/app/services/ledger_service.py`
- Modify: `backend/app/services/profile_service.py`
- Modify: `backend/app/services/resolution_service.py`
- Modify: `backend/app/services/gdpr_service.py`
- Modify: `backend/app/workers/tasks/resolution.py`
- Modify: `backend/app/api/routes/markets.py`
- Modify: `backend/app/api/routes/resolution.py`
- Modify: `backend/app/api/routes/llm.py`
- Modify: `backend/app/api/routes/test_support.py`
- Modify: `backend/scripts/seed_dev.py`
- Modify: `backend/tests/test_bets.py`
- Modify: `backend/tests/test_markets.py`
- Modify: `backend/tests/test_market_positions.py`
- Modify: `backend/tests/test_resolution.py`
- Modify: `backend/tests/test_tasks.py`
- Modify: `backend/tests/test_socket.py`
- Verify existing contract: `backend/tests/test_market_model_terminology.py`

## Steps

### 1. Introduce canonical market models and a compatibility layer

- Add `backend/app/db/models/market.py` with canonical ORM names:
  - `Market` for the market row
  - `MarketPosition` for a user wager/position
  - `MarketPositionHistory` for history
  - `MarketUpvote` for market likes
- Rename table and FK names in the initial schema to match the domain:
  - `bets` -> `markets`
  - `bet_positions` -> `market_positions`
  - `position_history` -> `market_position_history`
  - `bet_upvotes` -> `market_upvotes`
  - downstream FKs/columns from `bet_id` -> `market_id` where the persistence model should be explicit
- Keep non-market concepts (`Resolution`, `Dispute`, `ResolutionReview`, `Comment`) attached to `market_id`.
- Update `backend/app/db/models/__init__.py` to export the new canonical names.
- Keep `backend/app/db/models/bet.py` as a thin alias/shim if needed so the refactor can land without breaking every import at once.

Verification:

- `cd backend && uv run pytest tests/test_market_model_terminology.py -q`

### 2. Refactor backend services and routes to use Market/Position terminology internally

- Replace internal imports/usages of `Bet`, `BetPosition`, `BetUpvote`, and `PositionHistory` with the canonical market model names in services, routes, workers, and test support.
- Rename local variables and comments from `bet` to `market` wherever the object is the market itself; keep wager-specific code distinct as `position` or `wager`.
- Preserve public route compatibility:
  - `/api/markets/...` stays as-is
  - `/api/bets/...` wager endpoints stay as-is
  - request/response fields like `bet_id` should remain unless all server-side consumers can be updated safely in the same change
- Update any schema/model docstrings that currently blur “market” and “bet” concepts, but avoid frontend-facing API churn.

Verification:

- `cd backend && uv run pytest tests/test_bets.py tests/test_markets.py tests/test_market_positions.py tests/test_resolution.py tests/test_tasks.py tests/test_socket.py -q`

### 3. Update seed data and final regression coverage for the fresh schema

- Update `backend/scripts/seed_dev.py` to construct `Market` and `MarketPosition` records against the renamed initial tables/FKs.
- Update `backend/app/api/routes/test_support.py` and any fixtures that insert rows directly so they seed/query the new canonical model names.
- Run the focused backend suite that covers the renamed model layer, market listing, bet placement, resolution, and seed-adjacent direct inserts.
- If local Docker services are available, recreate the dev DB before the seed check because there is no migration path for old table names.

Verification:

- `cd backend && uv run pytest tests/test_market_model_terminology.py tests/test_bets.py tests/test_markets.py tests/test_market_positions.py tests/test_resolution.py tests/test_tasks.py -q`
- `docker compose down -v && docker compose up -d backend db redis && make seed`

## Risks

- Existing dev volumes with old `bets` tables will not match the renamed initial schema. The refactor assumes a fresh database.
- Broad internal renames can break direct imports. A temporary `app.db.models.bet` alias module is the safest way to stage the change.
- Changing persisted FK column names from `bet_id` to `market_id` is correct for clarity, but public API payload keys should stay stable unless the frontend is updated in the same change.
- Seed/test-support code performs direct inserts and will fail quickly if any table or FK rename is missed.
