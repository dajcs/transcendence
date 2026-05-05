---
status: complete
quick_id: 260505-prt
commit: b5eaff1
date: 2026-05-05
---

# Quick Task 260505-prt Summary

## Result

Fixed pending-resolution timeout behavior so markets proceed to community vote after the proposer misses the 2-day resolution window.

## Changes

- Added `PROPOSER_RESOLUTION_WINDOW_DAYS = 2` as the shared backend timeout.
- Updated the auto-escalation worker to open a dispute once `pending_resolution` markets are older than 2 days.
- Updated the proposer resolve route so a late proposer attempt creates/returns `disputed` instead of a dead-end expiration error.
- Updated the resolution due email copy from 7 days to 2 days.
- Added regression tests for scheduled escalation and late proposer escalation.

## Verification

- `python -m py_compile backend/app/api/routes/resolution.py backend/app/workers/tasks/resolution.py backend/app/services/resolution_service.py backend/app/services/email_service.py` passed.
- `uv run pytest -o addopts= tests/test_resolution.py::test_vote_weights_follow_position_vs_vote_semantics -q` passed.
- DB-backed targeted tests timed out in the existing `db_engine` fixture; an unchanged existing DB test timed out the same way, so this remains an environment/test-harness limitation for this session.
