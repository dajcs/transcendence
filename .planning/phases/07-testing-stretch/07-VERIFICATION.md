---
phase: 07-testing-stretch
verified: 2026-04-22T07:00:47Z
status: gaps_found
score: 1/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "GitHub Actions CI pipeline exists for normal checks and the manual heavy E2E path"
    status: failed
    reason: "Phase 07 requires CI completion, but the repository does not contain the claimed GitHub Actions workflow files."
    artifacts:
      - path: ".github/workflows/ci.yml"
        issue: "Missing file; normal push/pull_request CI workflow is absent."
      - path: ".github/workflows/e2e-manual.yml"
        issue: "Missing file; manual Docker plus Playwright workflow is absent."
    missing:
      - "Add `.github/workflows/ci.yml` with backend and frontend checks for push and pull_request."
      - "Add `.github/workflows/e2e-manual.yml` with workflow_dispatch and Docker-backed Playwright execution."
  - truth: "Backend and frontend testing requirements are verified as runnable and meet the required coverage thresholds"
    status: partial
    reason: "Test artifacts exist, but local verification is blocked by environment defects: backend `uv run` cannot initialize its cache and the checked-in backend virtualenv points to a missing interpreter; frontend local Jest and Playwright packages are absent from `frontend/node_modules`, so coverage and runtime thresholds cannot be proven."
    artifacts:
      - path: "backend/.venv/bin/python"
        issue: "Broken symlink to `/opt/pyenv/versions/3.13.1/bin/python3`."
      - path: "backend"
        issue: "`cd backend && uv run pytest --version` fails because `/home/anemet/.cache/uv` cannot be created in this environment."
      - path: "frontend/node_modules/.bin/jest"
        issue: "Missing; local Jest command surface is not installed."
      - path: "frontend/node_modules/@playwright/test"
        issue: "Missing; local Playwright runtime is not installed."
    missing:
      - "Repair or recreate the backend virtualenv and provide a writable `uv` cache/home path, then rerun backend pytest coverage commands."
      - "Install frontend Jest/RTL and Playwright dependencies into `frontend/node_modules`, then rerun Jest coverage and Playwright listing/execution commands."
      - "Capture real backend/frontend coverage output to show TEST-01 through TEST-03 thresholds are met."
---

# Phase 7: Testing & Stretch Verification Report

**Phase Goal:** Test suite and CI complete; stretch modules deferred beyond this phase.
**Verified:** 2026-04-22T07:00:47Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | pytest backend tests exist for economy, resolution, and auth with 80%+ coverage evidence | ✗ FAILED | `backend/pyproject.toml` includes `pytest-cov` and coverage defaults, and backend tests exist, but coverage is not verified. `backend/.venv/bin/python` is a dead symlink and `cd backend && uv run pytest --version` fails with `Failed to initialize cache at /home/anemet/.cache/uv`. |
| 2 | Jest frontend component tests exist with 70%+ coverage evidence | ✗ FAILED | `frontend/package.json` adds `test:coverage`, `frontend/jest.config.ts` collects coverage, and regression tests exist, but `frontend/node_modules/.bin/jest` and `frontend/node_modules/jest` are missing, so the local Jest suite is not runnable. |
| 3 | Playwright E2E artifacts exist for auth, bet lifecycle, dispute, and notifications | ✓ VERIFIED | `frontend/playwright.config.ts` exists, `rg --files frontend/e2e` returns exactly four specs, and `backend/app/main.py` gates `test_support` behind `ENABLE_E2E_TEST_SUPPORT`. |
| 4 | GitHub Actions CI pipeline exists | ✗ FAILED | Phase 07 roadmap deliverable requires CI, but `.github/workflows/ci.yml` and `.github/workflows/e2e-manual.yml` are both missing from the repository. |

**Score:** 1/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `backend/pyproject.toml` | Backend pytest and coverage command support | ✓ VERIFIED | Contains `pytest-cov` and `addopts = "--cov --cov-report=term-missing --cov-report=xml"`. |
| `backend/tests/conftest.py` | SQLite + FakeRedis backend harness retained | ✓ VERIFIED | Uses `sqlite+aiosqlite:///:memory:` and `FakeRedis`; no mandatory Postgres/Redis harness introduced. |
| `frontend/package.json` | Jest coverage and Playwright scripts | ✓ VERIFIED | Contains `test:coverage`, `test:e2e`, and `test:e2e:list`. |
| `frontend/jest.config.ts` | Explicit Jest coverage config | ✓ VERIFIED | Sets `collectCoverageFrom` and coverage reporters while staying on `next/jest`. |
| `frontend/playwright.config.ts` | Playwright runtime config | ✓ VERIFIED | Defines a Chromium project and base URL. |
| `frontend/e2e/*.spec.ts` | Four critical E2E specs only | ✓ VERIFIED | Exactly four spec files exist: `auth`, `bet-lifecycle`, `dispute`, `notifications`. |
| `backend/app/api/routes/test_support.py` | Test-only seeded E2E setup | ✓ VERIFIED | Present and paired with an env gate in `backend/app/main.py`. |
| `.github/workflows/ci.yml` | Push and pull_request CI | ✗ MISSING | File does not exist. |
| `.github/workflows/e2e-manual.yml` | Manual heavy Docker + Playwright workflow | ✗ MISSING | File does not exist. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `backend/pyproject.toml` | backend tests | pytest coverage command path used by CI and local runs | ✓ WIRED | `gsd-tools verify key-links` found the coverage pattern. |
| `backend/tests/conftest.py` | `backend/tests/test_auth.py` | AsyncClient + dependency override + temp JWT keys | ✓ WIRED | Shared auth fixture wiring is present. |
| `frontend/package.json` | `frontend/jest.config.ts` | coverage-capable Jest scripts | ✓ WIRED | `test:coverage` is present and Jest config defines coverage collection. |
| `frontend/package.json` | `frontend/playwright.config.ts` | Playwright scripts and browser install path | ✓ WIRED | `test:e2e`, `test:e2e:list`, and install script are present. |
| `backend/app/main.py` | `backend/app/api/routes/test_support.py` | env-gated router registration | ✓ WIRED | Router is only mounted when `ENABLE_E2E_TEST_SUPPORT` is truthy. |
| `.github/workflows/ci.yml` | backend and frontend test commands | workflow calls repo-native commands | ✗ NOT_WIRED | Source file not found. |
| `.github/workflows/e2e-manual.yml` | `docker-compose.yml` | manual heavy path runs against Docker stack | ✗ NOT_WIRED | Source file not found. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `backend/app/api/routes/test_support.py` | `ScenarioResponse.market` / `notification` | Real inserts into `users`, `bets`, `bet_positions`, `notifications`, and `bp_transactions` tables | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Backend `uv` command surface initializes | `cd backend && uv run pytest --version` | Failed: `Failed to initialize cache at /home/anemet/.cache/uv` | ✗ FAIL |
| Backend checked-in interpreter is usable | `backend/.venv/bin/python -V` | Failed; symlink points to missing `/opt/pyenv/versions/3.13.1/bin/python3` | ✗ FAIL |
| Frontend Jest command surface is installed | `test -x frontend/node_modules/.bin/jest && frontend/node_modules/.bin/jest --version` | `jest-not-runnable` | ✗ FAIL |
| Frontend Playwright command surface is installed | `test -x frontend/node_modules/.bin/playwright && frontend/node_modules/.bin/playwright test --list` | `playwright-not-runnable` | ✗ FAIL |
| CI workflow artifacts exist | `test -f .github/workflows/ci.yml` and `test -f .github/workflows/e2e-manual.yml` | Both missing | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `TEST-01` | `07-01-PLAN.md` | Backend unit tests for economy formulas (100% coverage) | ✗ BLOCKED | Economy and resolution tests exist, but no runnable backend coverage evidence is available because local backend verification is blocked by the broken venv interpreter and `uv` cache initialization failure. |
| `TEST-02` | `07-01-PLAN.md` | Backend integration tests for API endpoints (80%+ coverage) | ✗ BLOCKED | Auth, bets, and users tests exist, but the coverage threshold is unverified for the same backend environment reasons. |
| `TEST-03` | `07-02-PLAN.md` | Frontend component tests (70%+ coverage) | ✗ BLOCKED | Jest coverage scripts and test files exist, but `frontend/node_modules` does not contain runnable Jest/RTL binaries and packages. |
| `TEST-04` | `07-03-PLAN.md` | E2E tests: auth, bet lifecycle, dispute flow | ✗ BLOCKED | Four Playwright specs exist, but Playwright is not installed locally and the CI workflows that should automate this layer are missing. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No placeholder/TODO stubs were found in the present Phase 07 test files scanned | ℹ️ Info | The blocking issues are missing workflow artifacts and unrunnable local environments, not placeholder code inside the test files. |

### Gaps Summary

Phase 07 did not achieve its roadmap goal.

The strongest failure is structural: the roadmap requires a GitHub Actions CI pipeline, but neither `.github/workflows/ci.yml` nor `.github/workflows/e2e-manual.yml` exists in the repository. That makes the "CI complete" portion of the phase goal false.

The rest of the testing work is only partially evidenced. Backend pytest, frontend Jest, and Playwright artifacts are present and mostly wired, but the required runtime proof is missing because local verification is blocked in both stacks. On the backend, the checked-in virtualenv points at a missing interpreter and `uv run` cannot initialize its cache in this environment. On the frontend, `frontend/node_modules` exists as a directory, but the Jest and Playwright packages and binaries needed for local verification are absent. Until those environments are repaired and the coverage commands are rerun, TEST-01 through TEST-04 remain unclosed.

---

_Verified: 2026-04-22T07:00:47Z_
_Verifier: Claude (gsd-verifier)_
