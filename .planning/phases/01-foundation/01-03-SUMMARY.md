---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [jwt, bcrypt, fastapi, pydantic, redis, sqlalchemy, pytest, httponly-cookies]

# Dependency graph
requires:
  - phase: 01-02
    provides: User model, OauthAccount model, get_db session dependency, app.config settings with JWT key paths and Redis URL

provides:
  - RS256 access token (15min) + opaque refresh token (Redis-backed, 7 days)
  - bcrypt password hashing (cost=12) via passlib
  - 7 auth endpoints at /api/auth/: register, login, /me, refresh, logout, reset-request, reset-confirm
  - httpOnly + secure cookies with SameSite=lax (access) / SameSite=strict (refresh)
  - Rate limiting on login: 5 attempts/15min/IP via Redis INCR+EXPIRE
  - Auth service layer: register, login, get_current_user, refresh, logout, reset_request, reset_confirm
  - Integration tests (11 passing) with SQLite in-memory DB + FakeRedis + ephemeral RSA keys

affects: [04-frontend-scaffold, 05-oauth, realtime, social]

# Tech tracking
tech-stack:
  added:
    - PyJWT (RS256/HS256 token ops)
    - passlib[bcrypt] + bcrypt<4.0.0 (password hashing, pinned for passlib compat)
    - pydantic[email] + email-validator (EmailStr validation)
    - aiosqlite (SQLite async driver for tests)
    - fakeredis (Redis mock for tests)
    - cryptography (RSA key generation in test fixtures)
  patterns:
    - httpOnly cookie auth with separate access/refresh token lifetimes
    - Thin route handlers delegating to service layer (routes call service functions)
    - TDD with SQLite in-memory + FakeRedis for isolated unit tests
    - Ephemeral RSA key pairs generated per session in conftest for JWT tests
    - Anti-enumeration: reset-request always returns 200

key-files:
  created:
    - backend/app/utils/jwt.py
    - backend/app/utils/password.py
    - backend/app/utils/__init__.py
    - backend/app/schemas/auth.py
    - backend/app/schemas/__init__.py
    - backend/app/services/auth_service.py
    - backend/app/services/email_service.py
    - backend/app/services/__init__.py
    - backend/app/api/routes/auth.py
    - backend/app/api/routes/__init__.py
    - backend/tests/test_auth.py
  modified:
    - backend/app/main.py (auth_router registered at /api/auth)
    - backend/app/db/models/user.py (ForeignKey on OauthAccount.user_id; Uuid cross-dialect type)
    - backend/tests/conftest.py (SQLite + FakeRedis + RSA key fixtures)
    - backend/pyproject.toml (added pydantic[email], bcrypt<4.0.0, aiosqlite, fakeredis, cryptography)

key-decisions:
  - "bcrypt pinned to <4.0.0 because passlib 1.7.4 is incompatible with bcrypt>=4.0 (removed __about__ attr)"
  - "OauthAccount.user_id ForeignKey missing in Plan 02 model — added ForeignKey('users.id', ondelete='CASCADE')"
  - "SQLAlchemy Uuid type (cross-dialect) replaces sqlalchemy.dialects.postgresql.UUID so SQLite tests work"
  - "Ephemeral RSA keys generated in conftest session fixture — avoids test dependency on Docker secrets"
  - "FakeRedis patched into auth_service._redis global — tests Redis-dependent login/refresh without live Redis"

patterns-established:
  - "Pattern: route handlers are thin (import service, call one function, return)"
  - "Pattern: auth cookies set/cleared via helper functions (_set_auth_cookies, _clear_auth_cookies)"
  - "Pattern: conftest overrides get_db dependency and patches Redis for isolated tests"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 01 Plan 03: Auth API Summary

**RS256 JWT + httpOnly cookie auth with bcrypt password hashing, Redis refresh token rotation, and 11 integration tests passing against SQLite + FakeRedis**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T21:44:49Z
- **Completed:** 2026-03-24T21:54:06Z
- **Tasks:** 2 (+ TDD RED commit)
- **Files modified:** 15

## Accomplishments

- Complete auth API: register, login, /me, refresh, logout, password reset (7 endpoints)
- httpOnly + secure cookies with proper SameSite flags and path restriction on refresh token
- JWT: RS256 access tokens (15min), opaque refresh tokens backed by Redis (7 days) with rotation
- 11 integration tests passing via SQLite in-memory + FakeRedis + ephemeral RSA keys — no Docker required

## Task Commits

1. **Task 1: JWT utils, password utils, schemas, auth service** - `8bc94e5` (feat)
2. **TDD RED: Failing auth tests** - `c52f0c3` (test)
3. **Task 2: Auth routes + main.py + tests green** - `2252b9e` (feat)

## Files Created/Modified

- `backend/app/utils/jwt.py` — RS256 access token + opaque refresh token + HMAC password reset token
- `backend/app/utils/password.py` — bcrypt hashing (cost=12) via passlib
- `backend/app/schemas/auth.py` — Pydantic v2 request/response schemas with field_validator
- `backend/app/services/auth_service.py` — register, login, refresh, logout, reset_request, reset_confirm
- `backend/app/services/email_service.py` — async SMTP with stdout fallback for dev
- `backend/app/api/routes/auth.py` — thin route handlers delegating to auth_service
- `backend/app/main.py` — auth_router registered at /api/auth
- `backend/app/db/models/user.py` — ForeignKey added to OauthAccount.user_id; Uuid cross-dialect type
- `backend/tests/test_auth.py` — 9 auth integration tests (AUTH-01 through AUTH-04)
- `backend/tests/conftest.py` — SQLite+FakeRedis+RSA key fixtures for isolated tests
- `backend/pyproject.toml` — added pydantic[email], bcrypt<4.0.0, aiosqlite, fakeredis, cryptography

## Decisions Made

- Pinned `bcrypt<4.0.0` — passlib 1.7.4 is incompatible with bcrypt>=4.x (removed `__about__` attribute)
- Used `sqlalchemy.types.Uuid` (cross-dialect) instead of `sqlalchemy.dialects.postgresql.UUID` so SQLite tests work
- Generated ephemeral RSA keys in conftest `session`-scoped fixture — tests don't need Docker secrets mounted
- FakeRedis patched into `auth_service._redis` global for test isolation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing email-validator package**
- **Found during:** Task 2 (running tests)
- **Issue:** `pydantic[email]` requires `email-validator` but it was not in pyproject.toml; import failed
- **Fix:** `uv add "pydantic[email]"` added email-validator==2.3.0 and dnspython==2.8.0
- **Files modified:** backend/pyproject.toml, backend/uv.lock
- **Verification:** Import succeeded; tests progressed past conftest loading
- **Committed in:** 2252b9e (Task 2 commit)

**2. [Rule 1 - Bug] OauthAccount missing ForeignKey on user_id**
- **Found during:** Task 2 (running tests)
- **Issue:** `sqlalchemy.exc.NoForeignKeysError` — OauthAccount.user_id declared as UUID column without ForeignKey("users.id"), causing SQLAlchemy relationship configuration to fail
- **Fix:** Added `ForeignKey("users.id", ondelete="CASCADE")` to the user_id column definition
- **Files modified:** backend/app/db/models/user.py
- **Verification:** SQLAlchemy mapper configured without error; register test passed
- **Committed in:** 2252b9e (Task 2 commit)

**3. [Rule 1 - Bug] PostgreSQL UUID type incompatible with SQLite tests**
- **Found during:** Task 2 (running tests — same error as #2)
- **Issue:** `sqlalchemy.dialects.postgresql.UUID` is dialect-specific and fails on SQLite
- **Fix:** Replaced with `sqlalchemy.types.Uuid(as_uuid=True)` (SQLAlchemy 2 cross-dialect native)
- **Files modified:** backend/app/db/models/user.py
- **Verification:** SQLite in-memory DB created all tables correctly; all tests passed
- **Committed in:** 2252b9e (Task 2 commit)

**4. [Rule 1 - Bug] bcrypt 5.0.0 incompatible with passlib 1.7.4**
- **Found during:** Task 2 (running tests after model fix)
- **Issue:** `ValueError: password cannot be longer than 72 bytes` — bcrypt 5.x changed its API, removed `__about__` attribute that passlib reads; passlib falls back to broken backend
- **Fix:** `uv add "bcrypt<4.0.0"` — pinned to bcrypt 3.2.2
- **Files modified:** backend/pyproject.toml, backend/uv.lock
- **Verification:** hash_password and verify_password work correctly; test_register passes
- **Committed in:** 2252b9e (Task 2 commit)

**5. [Rule 3 - Blocking] JWT key file not available in test environment**
- **Found during:** Task 2 (login test failing with FileNotFoundError)
- **Issue:** `test_login_sets_cookies` calls login which creates access token reading `/run/secrets/jwt_private.pem` — not available outside Docker
- **Fix:** Added `rsa_key_pair` session fixture in conftest generating ephemeral RSA keys; `patch_jwt_key_paths` autouse fixture patches settings to use temp paths
- **Files modified:** backend/tests/conftest.py, backend/pyproject.toml (+ cryptography dev dep)
- **Verification:** All 9 auth tests pass including test_login_sets_cookies and test_me_authenticated
- **Committed in:** 2252b9e (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 blocking, 3 bugs)
**Impact on plan:** All fixes necessary for correctness and test isolation. The model bug (missing FK) was pre-existing from Plan 02. Bcrypt and key path issues are environment/dependency version mismatches. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Auth API complete with all 7 endpoints functional
- 11/11 tests passing without Docker (SQLite + FakeRedis + ephemeral RSA keys)
- Alembic migration needed before Docker deploy: `OauthAccount.user_id` now has FK constraint
- Frontend scaffold (Plan 04) can now implement auth flows against these endpoints

---
*Phase: 01-foundation*
*Completed: 2026-03-24*
