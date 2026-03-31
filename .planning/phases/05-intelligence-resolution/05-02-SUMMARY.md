---
phase: 05-intelligence-resolution
plan: 02
subsystem: api
tags: [resolution, payout, alembic, sqlalchemy, socketio, python]

# Dependency graph
requires:
  - phase: 05-01
    provides: test contracts for resolution service (test_resolution.py with xfail stubs)
  - phase: 02
    provides: economy_service.py with credit_bp/deduct_bp, BpTransaction, TpTransaction models
provides:
  - Alembic migration 009 adding llm_opt_out column to users table
  - User model llm_opt_out field with server_default=false()
  - resolution_service.py with compute_vote_weight, compute_tp_earned, compute_proposer_penalty, trigger_payout
affects: [05-03, 05-04, 05-05, 05-06, resolution routes, Celery resolution tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "trigger_payout uses async with db.begin() for full atomicity — SELECT FOR UPDATE on Bet prevents double-payout"
    - "Socket emit is fire-and-forget after transaction commit, wrapped in try/except to avoid payout failure on socket error"
    - "TpTransaction has no reason field — omit reason when inserting tp records"
    - "compute_proposer_penalty clamps to current_balance to avoid negative bp balance"

key-files:
  created:
    - backend/alembic/versions/009_add_llm_opt_out.py
    - backend/app/services/resolution_service.py
  modified:
    - backend/app/db/models/user.py
    - backend/tests/test_resolution.py

key-decisions:
  - "TpTransaction has no reason field — plan's code sample included reason='bet_win' but the model doesn't have it; omitted"
  - "Proposer penalty clamped to current balance (not hard deduct) to avoid 402 error mid-payout transaction"
  - "test_proposer_penalty had wrong fixture name 'db' (should be 'db_session') — auto-fixed per Rule 1"

patterns-established:
  - "Resolution payout pattern: lock Bet with FOR UPDATE, idempotent guard on status==closed, batch credit winners, optional proposer penalty, socket emit post-commit"

requirements-completed: [RES-04, RES-05, RES-06]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 05 Plan 02: Payout Service and Migration 009 Summary

**Atomic resolution payout service with vote weight helpers, tp formula, proposer penalty, and Alembic migration adding llm_opt_out to users**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-30T22:20:43Z
- **Completed:** 2026-03-30T22:25:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Alembic migration 009 adds `llm_opt_out` boolean column to users with server_default=false()
- User model updated with `llm_opt_out` field
- `resolution_service.py` implements all 4 required functions: `compute_vote_weight`, `compute_tp_earned`, `compute_proposer_penalty`, `trigger_payout`
- `trigger_payout` atomically credits +1bp and tp to all winners, optionally penalizes proposer, emits socket event post-commit
- All 3 target tests now XPASS (were xfail stubs before this plan)

## Task Commits

1. **Task 1: Alembic migration 009 + User model llm_opt_out field** - `b845870` (feat)
2. **Task 2: resolution_service.py — payout helpers + trigger_payout** - `a688ae1` (feat)

## Files Created/Modified
- `backend/alembic/versions/009_add_llm_opt_out.py` — Migration 009: adds llm_opt_out to users, revision=009, down_revision=008
- `backend/app/db/models/user.py` — Added llm_opt_out: Mapped[bool] with nullable=False, server_default=false()
- `backend/app/services/resolution_service.py` — Full resolution service with compute_vote_weight, compute_tp_earned, compute_proposer_penalty, trigger_payout (atomic, idempotent, socket emit)
- `backend/tests/test_resolution.py` — Fixed fixture name bug in test_proposer_penalty (db -> db_session)

## Decisions Made
- **TpTransaction no reason field:** Plan's code sample used `reason="bet_win"` in TpTransaction constructor but the model doesn't define a `reason` column. Omitted to match actual model schema.
- **Proposer penalty clamped to balance:** Rather than calling `deduct_bp` (which raises 402 if insufficient), we manually query current balance and clamp the penalty to avoid mid-transaction HTTP exceptions.
- **Socket emit fire-and-forget:** Wrapped in `try/except Exception: pass` so a socket failure never rolls back the payout transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong fixture name in test_proposer_penalty**
- **Found during:** Task 2 (running tests for verification)
- **Issue:** `test_proposer_penalty(db)` used fixture name `db` but conftest only defines `db_session`. Test was XFAIL due to fixture-not-found error, not because of missing implementation.
- **Fix:** Changed `async def test_proposer_penalty(db):` to `async def test_proposer_penalty(db_session):` in test_resolution.py
- **Files modified:** `backend/tests/test_resolution.py`
- **Verification:** Test now XPASS (was XFAIL before fix)
- **Committed in:** `a688ae1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test fixture)
**Impact on plan:** Fix was necessary to satisfy acceptance criteria (all 3 tests must pass GREEN). No scope creep.

## Issues Encountered
- None beyond the test fixture bug documented above.

## Known Stubs
None — all implemented functions return real computed values. `trigger_payout` is wired to real DB models and socket server.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `trigger_payout` is ready for consumption by resolution routes (plan 05-03) and Celery tasks (plan 05-04)
- Migration 009 must run via `alembic upgrade head` before routes that rely on `llm_opt_out` go live
- Socket emit is fire-and-forget — no additional socket room setup needed beyond existing `bet:{bet_id}` room pattern

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-03-30*

## Self-Check: PASSED
- FOUND: backend/alembic/versions/009_add_llm_opt_out.py
- FOUND: backend/app/db/models/user.py (with llm_opt_out)
- FOUND: backend/app/services/resolution_service.py
- FOUND: .planning/phases/05-intelligence-resolution/05-02-SUMMARY.md
- FOUND commit b845870: feat(05-02): add llm_opt_out migration 009 and User model field
- FOUND commit a688ae1: feat(05-02): implement resolution_service.py with payout helpers and trigger_payout
- All 3 target tests XPASS: test_vote_weights, test_payout_formula, test_proposer_penalty
