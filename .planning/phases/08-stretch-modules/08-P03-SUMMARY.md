---
phase: 08-stretch-modules
plan: P03
subsystem: api
tags: [fastapi, public-api, openapi, redis, pytest]

requires:
  - phase: 08-stretch-modules
    provides: RWD shell and page-level mobile fixes from P01/P02
provides:
  - Read-only `/api/public` API surface for markets, comments, positions, payouts, profiles, and leaderboards
  - Redis-backed per-IP public API rate limiting
  - OpenAPI documentation coverage for public endpoints
affects: [stretch-modules, backend-api, public-documentation]

tech-stack:
  added: []
  patterns:
    - Dedicated read-only public FastAPI router mounted under `/api/public`
    - Router-level dependency for public API rate limiting

key-files:
  created:
    - backend/app/api/routes/public.py
    - backend/app/services/public_rate_limit.py
    - backend/tests/test_public_api.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Public API uses a dedicated `/api/public` namespace instead of exposing existing mutable routes."
  - "Public API is read-only: exactly seven GET endpoints and no public write decorators."
  - "Rate limiter fails open on Redis outage so public reads remain available."

patterns-established:
  - "Public API endpoints delegate to existing market, comment, and profile services with anonymous viewer context."
  - "Public API OpenAPI coverage is asserted by tests against `/openapi.json`."

requirements-completed: [STRETCH-01]

duration: 36 min
completed: 2026-04-30
---

# Phase 8 Plan P03: Public API Summary

**Read-only FastAPI public API with seven documented `/api/public` GET endpoints and Redis-backed per-IP throttling**

## Performance

- **Duration:** 36 min
- **Started:** 2026-04-30T18:42:00Z
- **Completed:** 2026-04-30T19:18:00Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Added a dedicated `public` router under `/api/public`.
- Exposed read-only endpoints for market list/detail, comments, positions, payouts, public profiles, and leaderboards.
- Added public API rate limiting with `rate:public:{ip}` Redis keys and `Retry-After: 60` on HTTP 429.
- Added focused tests for unauthenticated access, no public writes, OpenAPI path/tag coverage, and rate limiting.

## Task Commits

1. **Planning metadata:** `f685bb2` docs(08): plan public API follow-up
2. **Task 1: Public API tests:** `10d953f` test(08-P03): cover public API
3. **Tasks 2-3: Rate limiter + router:** `cf3a42d` feat(08-P03): add read-only public API

Task 4 verification was executed after the implementation commit.

## Files Created/Modified

- `backend/app/api/routes/public.py` - Dedicated read-only public API router with seven GET endpoints.
- `backend/app/services/public_rate_limit.py` - Redis-backed public API rate limiter.
- `backend/tests/test_public_api.py` - Public API regression tests.
- `backend/app/main.py` - Public router registration under `/api/public`.
- `.planning/phases/08-stretch-modules/08-CONTEXT.md` - Added D-04 public API scope decision.
- `.planning/phases/08-stretch-modules/08-P03-PLAN.md` - Public API execution plan.
- `.planning/ROADMAP.md` - Added P03 and status updates.
- `.planning/STATE.md` - Updated active/completion state.

## Decisions Made

- Kept Public API read-only and unauthenticated, matching the recommended scope selected by the user.
- Used `/api/public` as a separate namespace so Swagger/OpenAPI clearly exposes the stretch-module API without inheriting authenticated write routes.
- Added short Redis socket timeouts to the public rate limiter so Redis outages do not hang public reads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Redis socket timeouts**
- **Found during:** Task 4 verification
- **Issue:** Sandboxed tests hung when the public rate limiter attempted to connect to an unavailable Redis instance before the rate-limit test monkeypatched FakeRedis.
- **Fix:** Added `socket_connect_timeout=0.1` and `socket_timeout=0.1` to `redis.asyncio.from_url(...)`.
- **Files modified:** `backend/app/services/public_rate_limit.py`
- **Verification:** `tests/test_public_api.py` passed after the fix.
- **Committed in:** `cf3a42d`

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** The timeout change strengthens the planned fail-open Redis-outage behavior and does not expand scope.

## Issues Encountered

- Sandboxed pytest processes hung on network-restricted Redis connection behavior. The stuck sandboxed processes were killed after the rate limiter timeout fix. Required tests were rerun outside the sandbox and passed.

## Verification

- `UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest -o addopts= tests/test_public_api.py -q` → 6 passed, 1 warning.
- `UV_CACHE_DIR=/mnt/c/Users/dajcs/code/transcendence/.cache/uv uv run pytest -o addopts= tests/test_markets.py tests/test_comments.py tests/test_market_positions.py tests/test_users.py -q` → 46 passed, 1 warning.
- `git diff --check` → passed.
- Acceptance greps confirmed:
  - `rate:public:` present once.
  - `Retry-After` present once.
  - `PUBLIC_RATE_LIMIT_MAX_REQUESTS = 60` present once.
  - `public.py` has exactly 7 `@router.get` decorators.
  - `public.py` has no public write-route decorators.
  - `main.py` registers `app.include_router(public_router, prefix="/api/public")`.

## User Setup Required

None - no external service configuration required. The API reuses the existing Redis deployment.

## Next Phase Readiness

Phase 8 now covers RWD and the Public API stretch module. PWA remains intentionally deferred.

## Self-Check: PASSED

- All plan tasks executed.
- Summary created.
- STRETCH-01 copied from plan requirements into `requirements-completed`.
- Public API tests and route-adjacent regressions passed.

---
*Phase: 08-stretch-modules*
*Completed: 2026-04-30*
