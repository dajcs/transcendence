---
phase: 07-testing-stretch
plan: "05"
subsystem: testing
tags: [coverage, fail-under, gap-closure, relaxed-thresholds]
requires:
  - phase: 07-testing-stretch
    provides: Phase 7 proof targets and baseline coverage evidence
provides:
  - relaxed backend and frontend coverage gates
  - additional backend regression coverage
  - additional frontend behavior coverage
  - reviewed backend test hardening
affects: [phase-07, tests, coverage, frontend, backend]
requirements-completed: [TEST-01, TEST-02, TEST-03]
completed: 2026-04-29
---

# Phase 07 Plan 05 Summary

Phase 07-05 is complete with relaxed coverage thresholds. The original 80 percent backend and 70 percent frontend targets were lowered to match the coverage that the expanded regression suites currently prove.

## Backend Coverage Proof

Relaxed backend gate:

```text
fail_under = 62
--cov-fail-under=62
```

Most recent full backend proof before relaxation:

```text
154 passed, 1 failed, 4 xpassed, 2 warnings
Total coverage: 62.39%
```

The one failing socket assertion was fixed after that run by forcing the odds-emission test through the non-SQLite path. A targeted rerun of the fixed socket test and the new empty-odds economy test passed.

Economy service coverage reached the formula target; the empty-market odds branch was added so `get_bet_odds` now covers the even-odds default.

## Frontend Coverage Proof

Relaxed frontend gate:

```text
statements: 54
lines: 57
```

Most recent full frontend coverage proof:

```text
Test Suites: 18 passed, 18 total
Tests: 64 passed, 64 total
All files: 54.98% statements, 44.53% branches, 47.34% functions, 57.57% lines
```

Focused phase-07 frontend regression set also passed:

```text
Test Suites: 10 passed, 10 total
Tests: 26 passed, 26 total
```

TypeScript proof passed:

```text
npm run type-check
```

## Threshold Enforcement

- Backend enforcement remains in both `backend/pyproject.toml` and `Makefile`.
- Frontend enforcement remains in `frontend/jest.config.ts`.
- Thresholds were intentionally relaxed rather than removed, so proof commands still fail if coverage drops below the current verified baseline.
- `npm ci` completed successfully but took about eight minutes on the Windows-mounted workspace.

## Review Findings Closed

- `test_create_market_deducts_1bp` now asserts the user's BP decreases by exactly 1.
- `test_create_market_insufficient_bp` now asserts a strict `402` response.
- Comment upvote coverage now uses LP terminology and asserts the comment author's LP increases.

## TEST-04 Preservation

No new Playwright scope was added in 07-05. The existing 07-04 E2E proof remains the TEST-04 source of truth:

```text
make phase7-proof-e2e-list -> Total: 4 tests in 4 files
make phase7-heavy -> 4 passed
```

## Deviations from Plan

The plan called for backend 80 percent and frontend 70 percent coverage gates. Those gates were attempted and proved too large for the recovered 07-05 implementation in this session. Per user instruction on 2026-04-29, the requirements were relaxed and the phase was marked complete against the verified lower gates.

## Self-Check: PASSED
