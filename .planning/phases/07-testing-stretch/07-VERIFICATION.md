---
phase: 07-testing-stretch
verified: 2026-04-28T17:58:51Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/4
  gaps_closed:
    - "GitHub Actions CI pipeline exists for normal checks and the manual heavy E2E path."
    - "Phase 7 proof commands now run from repo-owned entrypoints without depending on the broken checked-in backend virtualenv or preinstalled frontend node_modules."
    - "Playwright command listing and Docker-backed E2E proof now have recorded successful output."
  gaps_remaining:
    - "Backend coverage proof does not meet the roadmap 80%+ backend coverage criterion or TEST-01 100% economy-formula coverage wording."
    - "Frontend Jest coverage proof does not meet the TEST-03 70% frontend component coverage requirement."
  regressions: []
gaps:
  - truth: "Backend pytest tests satisfy the required backend coverage thresholds for economy/API coverage."
    status: partial
    reason: "Backend tests now run and produce coverage, but the actual proof is below the required threshold: 56% total coverage in the summary and 59.92% line-rate in backend/coverage.xml, while ROADMAP.md requires 80%+ backend coverage and REQUIREMENTS.md says TEST-01 needs 100% economy-formula coverage. The coverage command also does not enforce a fail-under threshold."
    artifacts:
      - path: "backend/coverage.xml"
        issue: "Cobertura root line-rate is 0.5992; total proof is below 80%."
      - path: "backend/pyproject.toml"
        issue: "Coverage config has reports only; no fail_under or --cov-fail-under threshold."
      - path: "Makefile"
        issue: "phase7-proof-backend runs coverage but does not require 80%+ to pass."
    missing:
      - "Add enough backend tests, or narrow the documented coverage contract explicitly, so the measured backend proof meets the required threshold."
      - "Enforce the agreed backend coverage threshold in pytest/coverage config or the Makefile proof command."
  - truth: "Frontend Jest component tests satisfy the TEST-03 70% coverage requirement."
    status: partial
    reason: "Frontend tests now run and pass, but the proof records all-files Jest coverage at 31.91% statements and frontend/coverage/lcov.info shows 33.73% line coverage, below the 70% requirement. Jest config records coverage but does not enforce a coverageThreshold."
    artifacts:
      - path: "frontend/coverage/lcov.info"
        issue: "Computed line coverage is 538/1595 = 33.73%, below 70%."
      - path: "frontend/jest.config.ts"
        issue: "No coverageThreshold is configured."
      - path: "Makefile"
        issue: "phase7-proof-frontend runs Jest coverage but does not require 70% to pass."
    missing:
      - "Add frontend component coverage until the measured proof reaches 70%, or update the formal requirement if a different scoped threshold is intended."
      - "Enforce the agreed frontend coverage threshold in Jest config or the Makefile proof command."
---

# Phase 7: Testing & Stretch Verification Report

**Phase Goal:** Test suite and CI complete; stretch modules deferred beyond this phase.  
**Verified:** 2026-04-28T17:58:51Z  
**Status:** gaps_found  
**Re-verification:** Yes - after 07-04 gap closure work

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | pytest backend tests cover economy, resolution, auth/API work and meet the required backend coverage threshold | FAILED | `make phase7-proof-backend` is now recorded as passing, but proof says 56% total coverage and `backend/coverage.xml` root line-rate is 0.5992. `backend/pyproject.toml:38` and `Makefile:60` do not enforce 80%+ or TEST-01's 100% economy-formula wording. |
| 2 | Jest frontend component tests meet TEST-03's 70% coverage requirement | FAILED | `make phase7-proof-frontend` is recorded as passing 8 suites / 38 tests, but summary proof says 31.91% statements and `frontend/coverage/lcov.info` computes 33.73% lines. `frontend/jest.config.ts` has no `coverageThreshold`. |
| 3 | Playwright E2E covers auth, bet lifecycle, dispute, and notifications, and the heavy path has concrete proof | VERIFIED | Exactly four `frontend/e2e/*.spec.ts` files exist; `make phase7-proof-e2e-list` recorded 4 tests in 4 files; `make phase7-heavy` recorded 4 passed in 2.1m. |
| 4 | GitHub Actions CI exists for normal checks and keeps Docker/Playwright manual-only | VERIFIED | `.github/workflows/ci.yml` triggers on `push` and `pull_request` and calls `make phase7-proof-backend` / `make phase7-proof-frontend`; `.github/workflows/e2e-manual.yml` triggers on `workflow_dispatch` and calls `make phase7-heavy`. |

**Score:** 2/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `Makefile` | Repo-native Phase 7 proof entrypoints | VERIFIED | Defines `phase7-proof-backend`, `phase7-proof-frontend`, `phase7-proof-e2e-list`, aggregate `phase7-proof`, and `phase7-heavy`. |
| `backend/pyproject.toml` | pytest-cov and backend coverage config | PARTIAL | Coverage reports are configured, but no coverage threshold is enforced. |
| `backend/coverage.xml` | Backend coverage proof artifact | PARTIAL | Exists, but root line-rate is 59.92%, below the roadmap 80%+ backend coverage target. |
| `frontend/package.json` | Jest and Playwright scripts | VERIFIED | Contains `test:coverage`, `test:e2e`, `test:e2e:list`, and browser install command. |
| `frontend/jest.config.ts` | Jest coverage config | PARTIAL | Collects coverage and writes reports, but no `coverageThreshold` is configured. |
| `frontend/coverage/lcov.info` | Frontend coverage proof artifact | PARTIAL | Exists, but computed line coverage is 33.73%, below TEST-03's 70% target. |
| `frontend/playwright.config.ts` | Playwright runtime config | VERIFIED | Uses Chromium, HTTPS base URL, one worker, retries in CI, and E2E directory. |
| `frontend/e2e/*.spec.ts` | Four required E2E specs | VERIFIED | Exactly four specs: auth, bet lifecycle, dispute, notifications. |
| `backend/app/api/routes/test_support.py` | Gated E2E setup helper | VERIFIED | Substantive scenario seeding routes; mounted only when `ENABLE_E2E_TEST_SUPPORT` is enabled. |
| `.github/workflows/ci.yml` | Normal push/PR CI | VERIFIED | Runs backend and frontend Phase 7 proof targets. |
| `.github/workflows/e2e-manual.yml` | Manual heavy Docker + Playwright workflow | VERIFIED | `workflow_dispatch` only, runs `make phase7-heavy`, uploads Playwright report, then shuts down Docker. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `Makefile` | `backend/pyproject.toml` | `UV_CACHE_DIR` plus `uv sync --group dev` and `uv run pytest --cov=app` | WIRED | Closes the prior broken `.venv` / unwritable cache proof gap. |
| `Makefile` | `frontend/package.json` | `npm ci`, `npm run type-check`, `npm run test:coverage`, Playwright scripts | WIRED | Closes the prior missing `node_modules` command-surface gap. |
| `.github/workflows/ci.yml` | `Makefile` | workflow calls Phase 7 backend/frontend proof targets | WIRED | Normal CI is lightweight and does not run Docker E2E. |
| `.github/workflows/e2e-manual.yml` | `Makefile` / Docker stack | `workflow_dispatch` calls `make phase7-heavy` | WIRED | Heavy E2E remains optional/manual. |
| `backend/app/main.py` | `backend/app/api/routes/test_support.py` | env-gated router registration | WIRED | Router is mounted only if `ENABLE_E2E_TEST_SUPPORT` is truthy. |
| Coverage proof commands | coverage thresholds | fail-under config | NOT WIRED | Backend and frontend commands produce reports but do not fail below the required thresholds. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `backend/app/api/routes/test_support.py` | `ScenarioResponse.users`, `market`, `notification` | Real DB inserts through SQLAlchemy session and auth registration | Yes | FLOWING |
| `frontend/e2e/*.spec.ts` | seeded scenario payloads | `/api/test-support/reset` and `/api/test-support/scenarios/{name}` | Yes | FLOWING |
| `backend/coverage.xml` | backend line/branch coverage | `make phase7-proof-backend` recorded in 07-04 summary | Yes, below threshold | FLOWING_BUT_INSUFFICIENT |
| `frontend/coverage/lcov.info` | frontend line/function/branch coverage | `make phase7-proof-frontend` recorded in 07-04 summary | Yes, below threshold | FLOWING_BUT_INSUFFICIENT |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Backend proof produces real coverage | inspected `backend/coverage.xml` | root line-rate `0.5992`; class examples include `services/economy_service.py` at `0.9859` and `services/resolution_service.py` at `0.6802` | FAIL for threshold |
| Frontend proof produces real coverage | parsed `frontend/coverage/lcov.info` | lines `538/1595 = 33.73%`, functions `137/524 = 26.15%`, branches `345/1109 = 31.11%` | FAIL for threshold |
| Playwright spec count | `find frontend/e2e -maxdepth 1 -name '*.spec.ts' | wc -l` | `4` | PASS |
| CI workflow wiring | inspected workflow YAML | normal CI calls backend/frontend proof targets; manual workflow calls heavy target | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `TEST-01` | `07-01-PLAN.md`, `07-04-PLAN.md` | Backend unit tests for economy formulas (100% coverage) | BLOCKED | Economy regression tests exist and run, but proof does not show 100% economy-formula coverage; `services/economy_service.py` line-rate is 98.59%, and no threshold enforces the requirement. |
| `TEST-02` | `07-01-PLAN.md`, `07-04-PLAN.md` | Backend integration tests for API endpoints (80%+ coverage) | BLOCKED | Backend integration tests exist and run, but total backend proof is 56% in the summary / 59.92% line-rate in `coverage.xml`, below 80%. Several API/service areas remain below 80%, including `api/routes/resolution.py` at 17.14%. |
| `TEST-03` | `07-02-PLAN.md`, `07-04-PLAN.md` | Frontend component tests (70%+ coverage) | BLOCKED | Jest tests pass, but proof reports 31.91% statements and `lcov.info` computes 33.73% lines, below 70%. |
| `TEST-04` | `07-03-PLAN.md`, `07-04-PLAN.md` | E2E tests: auth, bet lifecycle, dispute flow | SATISFIED | Four Playwright specs exist, including the required three plus notifications from ROADMAP.md; list proof shows 4 tests in 4 files and heavy Docker proof records 4 passed. |

No additional Phase 7 requirement IDs were found in `.planning/REQUIREMENTS.md` beyond TEST-01 through TEST-04.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `backend/pyproject.toml` | 38 | Coverage reports without fail-under | Warning | CI can pass even when backend coverage remains below the roadmap threshold. |
| `frontend/jest.config.ts` | 6-30 | Coverage collection without `coverageThreshold` | Warning | CI can pass even when TEST-03 coverage remains below 70%. |
| `backend/tests/test_llm.py` | 2-69 | xfail LLM tests | Info | Outside TEST-01 through TEST-04 scope; explains the `4 xpassed` proof note but is not a Phase 7 blocker by itself. |
| `backend/tests/test_markets.py`, `backend/tests/test_comments.py` | review findings | Too-permissive assertions in three backend tests | Warning | `07-REVIEW.md` found tests that can pass without checking the behavior their names claim; not the main blocker, but relevant to test-suite quality. |

### Human Verification Required

None required for the current decision. The blocking issues are measurable coverage/threshold gaps, not visual or external-service ambiguity.

### Gaps Summary

07-04 closed the old environmental proof failures: repo-owned Makefile targets exist, CI workflows are present and wired, Playwright lists exactly four specs, and the Docker-backed E2E run has recorded success.

The remaining blocker is that the test proof does not satisfy the phase's own coverage contract. Backend proof is below the roadmap's 80%+ backend coverage target and does not prove TEST-01's 100% economy-formula wording. Frontend proof is well below TEST-03's 70% coverage requirement. Because the proof commands also lack fail-under thresholds, CI can remain green while these requirements are unmet.

---

_Verified: 2026-04-28T17:58:51Z_  
_Verifier: Claude (gsd-verifier)_
