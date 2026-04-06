---
phase: 05-intelligence-resolution
plan: "08"
subsystem: backend/resolution
tags: [payout, economy, d11, tp, bp, resolution]
dependency_graph:
  requires: [05-02]
  provides: [D-11-payout]
  affects: [resolution_service, bet_close_flow]
tech_stack:
  added: []
  patterns: [proportional-pool-split, per-position-tp-average]
key_files:
  created: []
  modified:
    - backend/app/services/resolution_service.py
    - backend/tests/test_resolution.py
decisions:
  - "D-11 payout: proportional BP pool split among winners (floor(user_winning_stake / total_winning_stake * total_bp_pool)) replaces flat +1 bp"
  - "D-11 TP: per-position average — losers earn 0, winning positions earn floor(bp_staked / total_winning_stake * 100) / 100, final = sum / count(all positions)"
  - "_compute_tp_for_user queries all active BetPosition rows per user to handle multi-position edge case"
  - "compute_tp_earned (time-based legacy) preserved for test backward compatibility"
metrics:
  duration: 6min
  completed_date: "2026-04-02"
  tasks: 1
  files: 2
---

# Phase 05 Plan 08: D-11 Payout Formula Rewrite Summary

Rewrote `trigger_payout` and added `_compute_tp_for_user` in `resolution_service.py` to implement the D-11 economy rules: proportional BP pool split among winners and per-position averaged TP (losers earn 0).

## What Was Done

**Task 1: Rewrite trigger_payout with proportional BP and per-position TP**

Added `_compute_tp_for_user` async helper before `trigger_payout`:
- Queries all active BetPosition rows for a given user+bet
- For winning positions: `tp_i = floor(bp_staked / total_winning_stake * 100) / 100`
- For losing positions: `tp_i = 0`
- Returns `sum(tp_values) / len(tp_values)` — average across all positions

Replaced `trigger_payout` body:
- Computes `total_bp_pool` = sum of bp_staked for all active positions
- Computes `total_winning_stake` = sum of bp_staked for winning-side active positions only
- Groups winners by `user_id` with aggregated `user_winning_stake` via `func.sum`
- Per winner: `winner_bp = floor(user_winning_stake / total_winning_stake * total_bp_pool)`
- Per winner: calls `_compute_tp_for_user` instead of time-based `compute_tp_earned`
- Proposer penalty logic, idempotency guard, and socket emit unchanged

## Decisions Made

- Flat +1 bp per winner (RES-06 original) replaced by proportional D-11 formula
- `compute_tp_earned` kept in file for test backward compatibility (4 existing xfail stubs reference it)
- Winners grouped by `user_id` before payout loop to handle multi-position users correctly
- `celery_emit` remains outside `async with db.begin()` block — fire-and-forget after commit

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- 2 new D-11 formula unit tests: PASSED
- 4 existing xfail stubs: xpassed (functions now exist and work)
- No failures

## Self-Check: PASSED

Files exist:
- backend/app/services/resolution_service.py: FOUND
- backend/tests/test_resolution.py: FOUND

Commits:
- 3b76c37: test(05-08): add D-11 payout formula unit tests (RED)
- 46bb8f4: feat(05-08): rewrite trigger_payout with D-11 proportional BP pool split and per-position TP
