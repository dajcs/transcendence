---
phase: 02-core-betting
plan: "07"
subsystem: betting
tags: [bet-cap, economy, bug-fix, frontend, gap-closure]
dependency_graph:
  requires: []
  provides: [bet-cap-enforcement, decimal-input]
  affects: [bet-placement]
tech_stack:
  added: []
  patterns: [log10-digit-count-cap, pydantic-field-ge-validation]
key_files:
  created: []
  modified:
    - backend/app/services/economy_service.py
    - backend/app/schemas/bet.py
    - backend/app/services/bet_service.py
    - frontend/src/app/(protected)/markets/[id]/page.tsx
decisions:
  - "compute_bet_cap uses math.log10 (digit count) — correct BET-04 formula: cap=1 for kp<10, cap=2 for kp<100"
  - "_check_bet_cap now takes amount float parameter instead of bet_id — validates amount > cap"
  - "BetPlaceRequest amount defaults to 1.0 with ge=1.0; upper bound enforced in service layer (user-specific)"
metrics:
  duration: "2min"
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 07: Bet Cap Enforcement and Decimal Input Summary

Fix two bugs found in UAT Test 8: bet cap was never triggered (checked position count instead of amount), and decimal input was blocked by browser's default step=1.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Fix compute_bet_cap (log10) and add amount field to BetPlaceRequest | 6f8f23b |
| 2 | Fix _check_bet_cap to validate amount vs cap; use data.amount in place_bet; add step="any" to numeric input | 033433b |

## Changes Made

### economy_service.py
- `compute_bet_cap`: changed `math.log2` to `math.log10` — correct digit-count formula per BET-04

### schemas/bet.py
- `BetPlaceRequest`: added `amount: float = Field(default=1.0, ge=1.0)` — accepts decimal stakes, defaults to 1.0 for backward compatibility

### bet_service.py
- `_check_bet_cap(db, user_id, amount)`: removed active_positions count query; now validates `amount > cap` directly
- `place_bet`: passes `data.amount` to cap check, deduct, credit, and `BetPosition.bp_staked`

### frontend markets/[id]/page.tsx
- Numeric estimate input: added `step="any"` attribute to allow decimal values without browser validation tooltip

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

All 4 modified files confirmed present. Both commits (6f8f23b, 033433b) confirmed in git log.
