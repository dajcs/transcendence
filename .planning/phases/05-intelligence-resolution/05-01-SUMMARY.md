---
phase: 05-intelligence-resolution
plan: 01
subsystem: testing
tags: [pytest, xfail, resolution, llm, fakeredis, tdd]

# Dependency graph
requires:
  - phase: 04-realtime-social
    provides: conftest.py with async fixtures (db, client, FakeRedis imports)
provides:
  - xfail test stubs for RES-01 through RES-06 in test_resolution.py
  - xfail test stubs for LLM-01 through LLM-04 in test_llm.py
  - fake_redis async fixture in conftest.py for LLM rate-limit and budget tests
affects: [05-02, 05-03, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 xfail test scaffold pattern: define failing tests before implementation"
    - "pytestmark = pytest.mark.asyncio at module level for async test files"
    - "fake_redis fixture in conftest.py for isolated Redis-dependent tests"

key-files:
  created:
    - backend/tests/test_resolution.py
    - (test_llm.py replaced with xfail scaffold)
  modified:
    - backend/tests/conftest.py
    - backend/tests/test_llm.py

key-decisions:
  - "Replaced existing test_llm.py (collection-breaking ImportError) with xfail stubs — aligns with Wave 0 Nyquist compliance pattern"
  - "fake_redis fixture uses non-decode_responses mode to match async LLM service usage"

patterns-established:
  - "xfail scaffold pattern: wrap service imports inside test body so collection never fails"

requirements-completed: [RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, LLM-01, LLM-02, LLM-03, LLM-04]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 5 Plan 01: Test Scaffolds for Resolution and LLM (Wave 0)

**xfail test stubs for all 10 Phase 5 requirements (RES-01 to RES-06, LLM-01 to LLM-04) collected by pytest with no collection errors, plus fake_redis fixture in conftest.py**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-31T09:19:31Z
- **Completed:** 2026-03-31T09:27:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created backend/tests/test_resolution.py with 6 xfail stubs covering RES-01 (weather mapping), RES-02 (proposer resolve), RES-03 (dispute flow), RES-04 (vote weights), RES-05 (proposer penalty), RES-06 (payout formula)
- Replaced broken test_llm.py (had top-level ImportError causing collection failure) with 4 xfail stubs for LLM-01 through LLM-04
- Added `async def fake_redis()` fixture to conftest.py for isolated LLM rate-limit and budget tests

## Task Commits

1. **Task 1: test_resolution.py scaffold** - `496086a` (test)
2. **Task 2: test_llm.py scaffold + fake_redis fixture** - `223241c` (test)

## Files Created/Modified

- `backend/tests/test_resolution.py` - 6 xfail test stubs for resolution requirements RES-01 to RES-06
- `backend/tests/test_llm.py` - 4 xfail test stubs for LLM requirements LLM-01 to LLM-04 (replaced broken version)
- `backend/tests/conftest.py` - Added `fake_redis` async fixture after `reset_redis_singleton`

## Decisions Made

- Replaced pre-existing test_llm.py that had top-level service imports (causing `ModuleNotFoundError` at collection time) with xfail stubs where imports are inside each test function body — this is required for Wave 0 compliance where services don't exist yet
- fake_redis fixture in conftest.py uses non-decode-responses mode (the client fixture's inline FakeRedis uses `decode_responses=True`, but the standalone fixture is fresh for LLM tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced collection-breaking test_llm.py**
- **Found during:** Task 2 (create test_llm.py scaffold)
- **Issue:** test_llm.py already existed with top-level `from app.services.llm_service import ...` causing `ModuleNotFoundError` at pytest collection time (not wrapped in xfail). Collection exited with error instead of 4 xfail tests.
- **Fix:** Replaced entire file with xfail scaffold version where all service imports are inside test function bodies
- **Files modified:** backend/tests/test_llm.py
- **Verification:** `pytest tests/test_llm.py --collect-only -q` shows 4 tests collected, exit 0
- **Committed in:** 223241c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required fix — pre-existing file broke collection. No scope creep.

## Issues Encountered

- XPASS results (7 of 10 tests) are expected: `strict=False` on xfail means passing tests show as XPASS not failures. This is correct — some service functions already exist (economy service, partial resolution_service). The RED state will be fully established in plans 02 and 03 when those specific function signatures are defined.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 test scaffold complete — all 10 requirements have automated test stubs
- Plans 02 (resolution service) and 03 (LLM service) can now be implemented against these test definitions
- conftest.py fake_redis fixture available for all LLM tests in plans 03+
- No blockers for subsequent plans

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-03-31*
