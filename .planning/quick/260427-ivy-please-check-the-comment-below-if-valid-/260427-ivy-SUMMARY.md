---
quick_id: 260427-ivy
status: complete
date: 2026-04-27
commit: f302c1c
---

# Quick Task 260427-ivy Summary

## Result

The bug report was valid. `place_bet` rejected non-open markets but did not reject open markets whose deadline had already passed, so delayed worker sweeps left expired markets bettable.

## Changes

- Added a deadline guard in `backend/app/services/bet_service.py` before duplicate-position lookup, BP deduction, and position creation.
- Added `test_place_bet_rejects_open_market_after_deadline` in `backend/tests/test_bets.py`.

## Verification

- Regression first failed before the fix: expired open market returned `201 Created`.
- `DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_bets.py -q` passed: 11 tests.

Last action: committed fix `f302c1c`.
