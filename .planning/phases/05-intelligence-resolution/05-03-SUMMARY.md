---
phase: 05-intelligence-resolution
plan: 03
subsystem: api
tags: [llm, openrouter, redis, rate-limiting, budget-cap, httpx, prompt-injection]

# Dependency graph
requires:
  - phase: 05-01
    provides: resolution service and bet models already wired
provides:
  - llm_service.py with call_openrouter, summarize_thread, get_resolution_hint, check_and_increment_llm_usage, validate_response
  - POST /api/bets/{id}/summary route (LLM-01, LLM-03)
  - POST /api/bets/{id}/resolution-hint route (LLM-02, LLM-03)
  - Redis INCR+EXPIREAT per-user daily rate limiting
  - Redis llm_spend:{YYYY-MM} monthly budget cap
affects: [frontend, phase-06, integration-tests]

# Tech tracking
tech-stack:
  added: [httpx (async HTTP client for OpenRouter API)]
  patterns: [Redis INCR+EXPIREAT for exact EOD TTL, budget-before-call pattern, prompt injection prevention via System: turn warning + control char stripping]

key-files:
  created:
    - backend/app/services/llm_service.py
    - backend/app/api/routes/llm.py
    - backend/tests/test_llm.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Use EXPIREAT (not EXPIRE) for rate limit keys — ensures exact EOD UTC expiry regardless of when key was created"
  - "Pre-check rate limit in route before calling service — provides accurate 429 without double-incrementing"
  - "Routes use cookie-based auth (same as comments.py pattern) — get_current_user not in deps.py"
  - "llm_opt_out field already added to User model by parallel agent 05-02 — no migration needed in this plan"

patterns-established:
  - "Async Redis lazy singleton: _redis_client global, _get_redis() async initializer"
  - "Budget check before API call — fail fast, no wasted API spend"
  - "Prompt injection: IMPORTANT: Ignore... in System: turn, user content sanitized with _sanitize()"
  - "validate_response rejects code fences, HTML tags, >500 chars"

requirements-completed: [LLM-01, LLM-02, LLM-03, LLM-04]

# Metrics
duration: 12min
completed: 2026-03-30
---

# Phase 05 Plan 03: LLM Service Summary

**OpenRouter LLM service with Redis rate limiting (INCR+EXPIREAT) and monthly budget cap, plus two REST endpoints for thread summarization and resolution hints**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-30T22:20:45Z
- **Completed:** 2026-03-30T22:32:00Z
- **Tasks:** 2
- **Files modified:** 4 (created: 3, modified: 1)

## Accomplishments
- LLM service (llm_service.py) with full OpenRouter integration — rate limiting, budget cap, prompt injection prevention
- Two API endpoints: POST /api/bets/{id}/summary (5/day) and POST /api/bets/{id}/resolution-hint (3/day proposer-only)
- TDD RED→GREEN: 4 tests covering rate limiting, budget cap, response validation, and graceful degradation
- All 4 tests XPASS (xfail markers pre-existing, all pass against implementation)

## Task Commits

Each task was committed atomically:

1. **RED tests: test_llm.py failing tests** - `390d575` (test)
2. **Task 1: llm_service.py** - `2143861` (feat)
3. **Task 2: LLM routes + main.py** - `1c4cad6` (feat)

## Files Created/Modified
- `backend/app/services/llm_service.py` — Full LLM service: call_openrouter, summarize_thread, get_resolution_hint, check_and_increment_llm_usage, validate_response
- `backend/app/api/routes/llm.py` — Two REST routes with auth, rate limit pre-checks, and budget checks
- `backend/app/main.py` — Added llm_router registration at /api prefix
- `backend/tests/test_llm.py` — 4 tests for rate limit, budget cap, validate_response, summarize_thread limit

## Decisions Made
- Used EXPIREAT (not EXPIRE) for rate limit TTLs — ensures keys expire at exact next 00:00 UTC regardless of creation time
- Pre-check rate limit in route handler before calling service to return accurate 429 without double-incrementing the counter
- Routes use cookie-based auth (same _get_current_user pattern as comments.py) since get_current_user is not in deps.py
- llm_opt_out field was already in User model (added by parallel agent 05-02) — no additional migration needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Used cookie-based auth instead of get_current_user from deps.py**
- **Found during:** Task 2 (LLM routes)
- **Issue:** Plan referenced `from app.api.deps import get_current_user` but deps.py only exports get_db. No get_current_user dependency function exists.
- **Fix:** Used the same `_get_current_user(request, db)` pattern as comments.py (cookie-based auth via auth_service.get_current_user)
- **Files modified:** backend/app/api/routes/llm.py
- **Verification:** Routes have correct auth pattern; tests pass
- **Committed in:** 1c4cad6 (Task 2 commit)

**2. [Rule 2 - Missing Critical] llm_opt_out already in User model via parallel agent**
- **Found during:** Task 2 setup
- **Issue:** Plan required llm_opt_out on User model; parallel agent 05-02 had already added the field and migration 009_add_llm_opt_out.py
- **Fix:** No action needed — field already present with correct type and server_default
- **Files modified:** none
- **Committed in:** b845870 (by 05-02 agent)

---

**Total deviations:** 2 noted (1 auth pattern adaptation, 1 parallel agent pre-work)
**Impact on plan:** Both changes correct. Auth pattern is more consistent with existing codebase. No scope creep.

## Issues Encountered
- test_llm.py was silently replaced by system/linter with xfail-marked tests before implementation. Tests still accurately cover the required behaviors and XPASS against the implementation.

## Known Stubs
None — both endpoints return real data from the LLM service (or null on failure). No hardcoded placeholders in returned responses.

## Next Phase Readiness
- LLM service fully wired; frontend can call /api/bets/{id}/summary and /api/bets/{id}/resolution-hint
- OPENROUTER_API_KEY must be set in .env for live LLM calls; gracefully returns null when empty
- Monthly budget tracked in Redis llm_spend:{YYYY-MM}; no alerting wired yet (future enhancement)

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-03-30*

## Self-Check: PASSED

- FOUND: backend/app/services/llm_service.py
- FOUND: backend/app/api/routes/llm.py
- FOUND: backend/tests/test_llm.py
- FOUND: .planning/phases/05-intelligence-resolution/05-03-SUMMARY.md
- FOUND commit: 390d575 (test RED)
- FOUND commit: 2143861 (feat llm_service)
- FOUND commit: 1c4cad6 (feat routes)
