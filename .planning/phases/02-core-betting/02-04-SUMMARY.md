---
phase: 02-core-betting
plan: 04
subsystem: api
tags: [bets, odds, withdrawal]
requires:
  - phase: 02-02
    provides: economy primitives
  - phase: 02-03
    provides: market lifecycle
provides:
  - Bets API (place, withdraw, positions)
  - Bet cap enforcement
  - Refund calculation and crediting
affects: [backend, dashboard]
tech-stack:
  added: []
  patterns: ["market-context position responses"]
key-files:
  created:
    - backend/app/services/bet_service.py
    - backend/app/schemas/bet.py
    - backend/app/api/routes/bets.py
  modified: []
key-decisions:
  - "Resolved nested transaction hazards by using explicit commit/rollback flow after service operations."
patterns-established:
  - "Bet position response enriched with market odds"
requirements-completed: [BET-02, BET-03, BET-04, BET-05]
duration: 22 min
completed: 2026-03-25
---

# Phase 02 Plan 04 Summary

**Bet placement, withdrawal, and portfolio position retrieval are implemented with cap checks and refund logic.**

## Accomplishments
- Added `/api/bets` POST, `/api/bets/{position_id}` DELETE, and `/api/bets/positions` GET.
- Implemented cap validation and duplicate-position handling.
- Implemented withdrawal refund calculation with ledger crediting.

## Deviations from Plan
- [Rule 1 - Bug] Reworked transaction boundaries to avoid nested session transactions after pre-read queries.

## Issues Encountered
- SQLAlchemy transaction state conflicts were resolved with explicit commit/rollback handling.

## Post-UAT Fixes
- Withdrawal refund changed to probability-weighted: refund = `stake × current_probability_for_side` instead of flat amount, so refund correctly reflects market odds at time of withdrawal.
