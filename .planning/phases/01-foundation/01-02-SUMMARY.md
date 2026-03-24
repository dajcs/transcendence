---
phase: 01-foundation
plan: 02
subsystem: database
tags: [fastapi, sqlalchemy, alembic, pydantic-settings, celery, asyncpg, postgresql, pytest]

# Dependency graph
requires:
  - phase: 01-01
    provides: Docker infrastructure, Dockerfile, entrypoint script that runs alembic upgrade head

provides:
  - FastAPI app instance with lifespan hook and /health endpoint
  - pydantic-settings Settings class validating all required env vars at startup
  - SQLAlchemy 2 async engine and session factory (asyncpg, pool_pre_ping)
  - All 16 database models matching DATABASE.md schema
  - Alembic migration 001 creating all 16 tables + 6 indexes
  - Celery app skeleton with ping task wired to Redis
  - pytest scaffold: conftest with AsyncClient, test_config.py (2 tests pass)

affects: [01-03-auth, 01-04-frontend, any plan using DB models or FastAPI deps]

# Tech tracking
tech-stack:
  added:
    - fastapi>=0.115.0
    - sqlalchemy[asyncio]>=2.0.36
    - alembic>=1.14.0
    - asyncpg>=0.30.0
    - pydantic-settings>=2.6.0
    - PyJWT>=2.10.0
    - passlib[bcrypt]>=1.7.4
    - celery>=5.4.0
    - redis[asyncio]>=5.2.0
    - pytest + pytest-asyncio (dev)
  patterns:
    - pydantic-settings BaseSettings with SettingsConfigDict (Pydantic v2 API)
    - SQLAlchemy async_sessionmaker + create_async_engine (asyncpg driver)
    - FastAPI asynccontextmanager lifespan for startup/shutdown
    - Alembic async env.py with NullPool for migration runs
    - All models imported in app/db/models/__init__.py for Alembic autogenerate

key-files:
  created:
    - backend/pyproject.toml
    - backend/app/config.py
    - backend/app/main.py
    - backend/app/db/session.py
    - backend/app/db/base.py
    - backend/app/db/models/user.py
    - backend/app/db/models/bet.py
    - backend/app/db/models/transaction.py
    - backend/app/db/models/social.py
    - backend/app/db/models/__init__.py
    - backend/app/api/deps.py
    - backend/app/workers/celery_app.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/versions/001_initial_schema.py
    - backend/tests/test_config.py
    - backend/tests/conftest.py
  modified:
    - backend/app/config.py (field_validator added for secret_key security)

key-decisions:
  - "field_validator on secret_key rejects empty string — empty secret is insecure, pydantic str type allows empty"
  - "pyproject.toml uses dependency-groups.dev (not deprecated tool.uv.dev-dependencies)"
  - "backend/.env with dummy values allows pytest to import app.config without Docker"

patterns-established:
  - "Pattern: get_db() as FastAPI dependency via Depends — import from app.api.deps"
  - "Pattern: models imported in app/db/models/__init__.py before alembic target_metadata"
  - "Pattern: all models share Base from app.db.base — never import from different Base"

requirements-completed: [INFRA-05]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 01 Plan 02: Backend Foundation Summary

**FastAPI app with pydantic-settings env validation, SQLAlchemy 2 async session, 16-table schema via Alembic 001 migration, Celery skeleton, and pytest config test (2/2 passing)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T21:33:20Z
- **Completed:** 2026-03-24T21:41:57Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Complete backend Python package: FastAPI app, pydantic-settings config with env var validation, async SQLAlchemy session
- All 16 database models (users, bets, positions, resolutions, disputes, comments, transactions, social) matching DATABASE.md
- Alembic migration 001 hand-written with all tables in FK dependency order + 6 indexes
- Celery app skeleton with ping task, wired to Redis via settings
- Test scaffold: conftest.py with AsyncClient fixture, test_config.py with 2 passing tests (INFRA-05 validated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend package setup — config, DB session, FastAPI app** - `65a9175` (feat)
2. **Task 2: All DB models, Alembic migration, Celery skeleton, test scaffold** - `c2270e4` (feat)

## Files Created/Modified

- `backend/pyproject.toml` - Project dependencies, pytest config (asyncio_mode=auto)
- `backend/app/config.py` - pydantic-settings Settings class; field_validator rejects empty secret_key
- `backend/app/main.py` - FastAPI app with lifespan hook, CORS middleware, /health endpoint
- `backend/app/db/session.py` - async_sessionmaker with asyncpg, pool_pre_ping=True
- `backend/app/db/base.py` - DeclarativeBase shared by all models
- `backend/app/db/models/user.py` - User, OauthAccount models
- `backend/app/db/models/bet.py` - Bet, BetPosition, PositionHistory, Resolution, Dispute, DisputeVote, Comment, CommentUpvote
- `backend/app/db/models/transaction.py` - BpTransaction, TpTransaction, KpEvent
- `backend/app/db/models/social.py` - FriendRequest, Message, Notification
- `backend/app/db/models/__init__.py` - Re-exports all models for Alembic
- `backend/app/api/deps.py` - get_db re-export for route handlers
- `backend/app/workers/celery_app.py` - Celery app with ping task
- `backend/alembic.ini` - Alembic config
- `backend/alembic/env.py` - Async Alembic runner; imports all models before target_metadata
- `backend/alembic/versions/001_initial_schema.py` - 16 tables + 6 indexes
- `backend/tests/conftest.py` - AsyncClient fixture
- `backend/tests/test_config.py` - test_missing_env_var, test_settings_has_required_fields

## Decisions Made

- `field_validator` on `secret_key` rejects empty string: pydantic `str` type accepts `""`, but empty secret key is a security hole — added validator to raise `ValueError` on empty value. This also makes `test_missing_env_var` testable by setting `SECRET_KEY=""`.
- `dependency-groups.dev` (PEP 735) instead of deprecated `tool.uv.dev-dependencies` — eliminates deprecation warning from all uv commands.
- `backend/.env` with local dummy values: pydantic-settings reads `.env` file at import time; a test `.env` allows pytest to import `app.config` without Docker running.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] field_validator on secret_key rejects empty string**
- **Found during:** Task 2 (test_config.py — test_missing_env_var)
- **Issue:** `test_missing_env_var` sets `SECRET_KEY=""` and expects `ValidationError`. Pydantic v2 `str` type accepts empty string, so `Settings()` would succeed — test would fail (and an empty secret key is insecure).
- **Fix:** Added `@field_validator("secret_key")` that raises `ValueError` if `secret_key` is empty. This fixes both the test and the security issue.
- **Files modified:** `backend/app/config.py`
- **Verification:** `uv run pytest tests/test_config.py -v` — 2/2 pass
- **Committed in:** `c2270e4`

**2. [Rule 3 - Blocking] pyproject.toml dev-dependencies format**
- **Found during:** Task 2 (uv sync warnings)
- **Issue:** `[tool.uv] dev-dependencies` is deprecated in favor of `[dependency-groups] dev`. Every `uv run` printed a deprecation warning.
- **Fix:** Migrated to `[dependency-groups] dev = [...]` (PEP 735 standard).
- **Files modified:** `backend/pyproject.toml`
- **Verification:** `uv sync` runs cleanly without warnings; tests pass.
- **Committed in:** `c2270e4`

---

**Total deviations:** 2 auto-fixed (1 security, 1 blocking warning)
**Impact on plan:** Both fixes improve correctness. No scope creep.

## Issues Encountered

None — plan executed cleanly. Tests pass. Syntax check passes (`from app.main import app` imports without errors).

## User Setup Required

None — all configuration via `.env` file already in place from Plan 01.

## Next Phase Readiness

- Backend package is importable and all models are defined
- Alembic migration 001 is ready to run against PostgreSQL (`alembic upgrade head` in entrypoint)
- Plan 03 (auth) can immediately add auth endpoints on top of this foundation
- `get_db()` dependency is available via `app.api.deps` for route handlers
- Test infrastructure in place for Plan 03 to add auth-specific fixtures

---
*Phase: 01-foundation*
*Completed: 2026-03-24*

## Self-Check: PASSED

- FOUND: backend/app/main.py
- FOUND: backend/app/config.py
- FOUND: backend/app/db/session.py
- FOUND: backend/alembic/versions/001_initial_schema.py
- FOUND: backend/tests/test_config.py
- FOUND commit: 65a9175 (Task 1)
- FOUND commit: c2270e4 (Task 2)
