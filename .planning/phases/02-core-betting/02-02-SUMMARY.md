---
phase: 02-core-betting
plan: 02
subsystem: api
tags: [auth, economy, ledger]
requires:
  - phase: 02-01
    provides: test scaffold
provides:
  - Signup bonus (+10 bp)
  - Daily login bonus (+1 bp on first /me per UTC day)
  - User responses enriched with bp/kp/tp balances
affects: [auth, economy, frontend]
tech-stack:
  added: []
  patterns: ["ledger-based balance reads via SUM"]
key-files:
  created: []
  modified:
    - backend/app/services/economy_service.py
    - backend/app/services/auth_service.py
    - backend/app/api/routes/auth.py
    - backend/app/schemas/auth.py
key-decisions:
  - "Computed balances from transaction ledgers, never from user table columns."
  - "Applied daily bonus in auth current-user flow for deterministic once-per-day crediting."
patterns-established:
  - "Route-level response enrichment for derived balance fields"
requirements-completed: [BET-03, BET-04, BET-05, BET-06, BET-08]
duration: 28 min
completed: 2026-03-25
---

# Phase 02 Plan 02 Summary

**Auth and economy integration now credits signup/daily bonuses and exposes live balances in /api/auth responses.**

## Accomplishments
- Added signup and daily login bonus behavior in auth service.
- Returned bp/kp/tp in register/login/me responses.
- Validated with focused auth+economy pytest run.

## Deviations from Plan
- [Rule 1 - Bug] Replaced nested transaction blocks with single-session commit flow to avoid `InvalidRequestError` in request lifecycle.

## Issues Encountered
- Nested transaction conflicts during tests were fixed by removing inner `db.begin()` blocks.
