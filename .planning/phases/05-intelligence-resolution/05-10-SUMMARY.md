---
phase: 05-intelligence-resolution
plan: 10
subsystem: api
tags: [celery, beat, resolution, scheduler, polling]

# Dependency graph
requires:
  - phase: 05-intelligence-resolution
    provides: resolve_market_at_deadline task (per-bet ETA approach)
provides:
  - check_auto_resolution Celery beat task firing every 5 min (RES-01 fallback poller)
  - beat_schedule entry check-auto-resolution-every-5min in celery_app.py
  - test_beat_schedule_has_check_auto_resolution unit test
affects: [05-intelligence-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Celery beat fallback scanner: lightweight task enqueues per-item tasks via send_task rather than processing inline — keeps beat task fast and isolates failures per market"]

key-files:
  created: []
  modified:
    - backend/app/workers/tasks/resolution.py
    - backend/app/workers/celery_app.py
    - backend/tests/test_resolution.py

key-decisions:
  - "check_auto_resolution delegates to resolve_market_at_deadline via send_task rather than calling _process_auto_resolution directly — isolates each bet's processing and stays idempotent (resolve_market_at_deadline guards on status=='open')"
  - "Fallback beat approach complements per-bet ETA: ETA tasks fire once per market; beat poller catches markets whose ETA tasks were lost on worker restart or broker flush"

patterns-established:
  - "Beat fallback pattern: lightweight scanner enqueues individual tasks per item, never processes inline"

requirements-completed: [RES-01]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 05 Plan 10: Beat Schedule Fallback Poller Summary

**Celery beat fallback poller check_auto_resolution (every 5 min) added as RES-01 safety net alongside per-bet ETA approach**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T08:30:00Z
- **Completed:** 2026-04-02T08:35:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added check_auto_resolution Celery task to resolution.py — scans open bets past deadline+5min and enqueues resolve_market_at_deadline per bet
- Added check-auto-resolution-every-5min entry to celery_app.py beat_schedule (crontab minute='*/5')
- Added test_beat_schedule_has_check_auto_resolution that passes immediately (not xfail)
- Updated module docstring to accurately document dual-approach architecture (per-bet ETA + fallback beat)

## Task Commits

1. **Task 1: Define check_auto_resolution task and update module docstring** - `d95cd1b` (feat)
2. **Task 2: Add beat schedule entry and update test** - `10c0d50` (feat)

## Files Created/Modified
- `backend/app/workers/tasks/resolution.py` - Added check_auto_resolution task, _scan_and_enqueue_expired_bets helper, updated module docstring
- `backend/app/workers/celery_app.py` - Added check-auto-resolution-every-5min beat_schedule entry
- `backend/tests/test_resolution.py` - Added test_beat_schedule_has_check_auto_resolution (passing)

## Decisions Made
- check_auto_resolution delegates to resolve_market_at_deadline via send_task rather than calling _process_auto_resolution directly — each bet runs in isolation, failures don't affect others, and idempotency is preserved (resolve_market_at_deadline already guards on status=="open")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None. The PytestWarning about `pytestmark = pytest.mark.asyncio` on the sync test function is expected and harmless (documented in plan as known behavior — pytestmark only applies to async functions).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RES-01 safety net complete: markets will be resolved even if per-bet ETA tasks are lost
- Both beat tasks (check_dispute_deadlines every 15 min, check_auto_resolution every 5 min) are wired and tested
- Ready for phase completion

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-04-02*
