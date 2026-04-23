# Phase 7: Testing & Stretch - Research

**Researched:** 2026-04-21
**Domain:** Automated testing baseline, Playwright E2E, and GitHub Actions CI for the existing Vox Populi stack
**Confidence:** HIGH

## User Constraints

### Locked Decisions

**Test stack direction**
- D-01: Keep the current repo test stack instead of forcing the older roadmap/testing doc assumptions. Backend stays on `pytest`; frontend stays on `jest`, not Vitest.
- D-02: Planning must align phase deliverables and commands to the current codebase reality rather than treating `plan/TESTING.md` as fully authoritative.

**Backend test environment**
- D-03: Keep the current fast backend harness as the default baseline: in-memory SQLite plus `fakeredis`, following the existing `backend/tests/conftest.py` pattern.
- D-04: Phase 7 does not need to introduce real Postgres/Redis as the baseline test environment. Targeted higher-fidelity coverage is optional only if a specific gap clearly requires it.

**Coverage philosophy**
- D-05: Prioritize broad safety over chasing strict numeric coverage for its own sake. The test suite should cover critical business logic and user flows first.
- D-06: Focus coverage on the highest-risk areas already called out by the roadmap and requirements: economy formulas, resolution/dispute behavior, auth/session handling, and core UI regressions.
- D-07: Existing tests should be expanded pragmatically around real failure modes and regression-prone paths, not inflated with low-value tests just to satisfy a percentage.

**E2E scope**
- D-08: Playwright scope is limited to the four critical flows from the testing plan: auth flow, bet lifecycle, dispute flow, and notifications.
- D-09: Phase 7 should not broaden E2E coverage into general UI smoke coverage or non-critical feature permutations.

**CI strictness**
- D-10: GitHub Actions should be introduced in an incremental way: backend and frontend automated checks are part of the baseline CI path, while the heavier Docker/Playwright path starts as optional or manually triggered rather than mandatory on every push/PR.
- D-11: The pipeline should be structured so the project gets useful automated feedback quickly without making iteration unreasonably slow or brittle.

**Scope guardrail**
- D-12: Stretch modules are out of scope for Phase 7. Even if the test baseline completes early, this phase ends at testing/CI rather than rolling directly into Public API, advanced search, or PWA work.

### the agent's Discretion
- Exact CI job split and trigger strategy, as long as the heavy E2E path starts optional/manual
- Whether coverage gates are enforced immediately or phased in after the suite stabilizes
- Exact test file additions and grouping, as long as they follow the established repo patterns
- Whether any lightweight test utilities or fixtures are worth refactoring before adding more tests

### Deferred Ideas (OUT OF SCOPE)
- Public API stretch module
- Advanced search stretch module
- PWA stretch module
- Replacing Jest with Vitest
- Making Docker/Playwright mandatory on every PR/push immediately

## Summary

Phase 7 should be planned as three focused workstreams: backend test baseline, frontend Jest regression baseline, then Playwright plus CI integration. That split matches the current repo seams and the user's scope decisions. [VERIFIED: codebase scan]

The repository already has substantial backend pytest coverage and a small but real frontend Jest baseline, but it lacks three key pieces: dependable coverage-oriented command surfaces, a broader frontend regression net, and any Playwright/CI scaffolding. [VERIFIED: `backend/tests/*`, `frontend/package.json`, `frontend/src/**/__tests__`, `.github/workflows`]

The original planning docs are directionally useful but stale in one important way: they assume Vitest and container-backed backend tests as the default, while the live repo uses Jest on the frontend and SQLite plus `fakeredis` on the backend. Planning should reconcile docs to code, not force a mid-phase tool migration. [VERIFIED: `plan/TESTING.md`, `frontend/package.json`, `backend/tests/conftest.py`]

## Project Constraints (from copilot-instructions.md)

- Preserve existing project conventions and repo-local patterns when planning changes. [VERIFIED: repo instructions]
- Frontend work should respect current component/page structure and existing testing style rather than introducing a parallel framework. [VERIFIED: `frontend/src/**/__tests__`]
- Backend changes should stay compatible with the current async FastAPI/SQLAlchemy test harness. [VERIFIED: `backend/tests/conftest.py`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Backend regression coverage | `backend/tests/` | backend services/routes | Existing pytest suite already exercises app code directly |
| Frontend regression coverage | `frontend/src/**/__tests__` | page/component modules | Jest + React Testing Library already present |
| Coverage command surfaces | `backend/pyproject.toml`, `frontend/package.json` | Makefile | CI needs stable entrypoints, not ad hoc commands |
| Playwright runtime orchestration | repo root / frontend tooling | Docker Compose | E2E needs a deterministic boot path over the real stack |
| CI orchestration | `.github/workflows/` | repo scripts/config | GitHub Actions should call repo-native commands rather than duplicate logic |
| Test-only setup helpers | backend API/test support layer | Playwright specs | If used, must be gated and unavailable in normal runtime |

## Standard Stack

### Current, repo-verified stack

| Layer | Current stack | Evidence |
|-------|---------------|----------|
| Backend tests | `pytest` + `pytest-asyncio` + `httpx` + `fakeredis` | [VERIFIED: `backend/pyproject.toml`, `backend/tests/conftest.py`] |
| Backend DB test mode | in-memory SQLite with `StaticPool` | [VERIFIED: `backend/tests/conftest.py`] |
| Frontend tests | `jest` + `@testing-library/react` + `@testing-library/user-event` | [VERIFIED: `frontend/package.json`] |
| Frontend config | `next/jest` wrapper, jsdom | [VERIFIED: `frontend/jest.config.ts`] |
| E2E tooling | not present yet | [VERIFIED: no Playwright config, no Playwright dependency found] |
| CI workflows | not present yet | [VERIFIED: `.github/workflows` empty] |

### Recommended additions for Phase 7

| Need | Recommendation | Why |
|------|----------------|-----|
| Backend coverage reporting | add `pytest-cov` in backend dev dependencies | Enables CI-visible backend coverage without changing test harness |
| Frontend coverage reporting | add a Jest coverage script/config | Keeps frontend on current runner while making CI measurable |
| E2E framework | add Playwright only | Directly matches phase scope; no competing E2E stack needed |
| CI entrypoints | use repo-owned commands/scripts | Prevents workflow YAML from becoming the source of truth |

## Architecture Patterns

### Pattern 1: Keep test runners aligned with the live repo

Backend should stay on the existing async pytest harness, and frontend should stay on Jest. The repo already has Jest-specific test syntax (`jest.mock`, `jest.fn`) in multiple files, so migrating to Vitest during Phase 7 would create churn unrelated to the goal. [VERIFIED: `frontend/src/components/auth/__tests__/LoginForm.test.tsx`, `frontend/src/app/(protected)/markets/[id]/__tests__/market-detail.test.tsx`]

### Pattern 2: Use fast in-process backend tests as the default safety net

The current fixture model provides:
- temporary RSA keys for auth tests
- in-memory SQLite schema setup
- FastAPI dependency override with `AsyncClient`
- fake Redis where stateful services need it

This is exactly the baseline the user chose to preserve. [VERIFIED: `backend/tests/conftest.py`]

### Pattern 3: Expand tests around known regression-prone domains

The repo history and existing test files point to four high-risk zones:
- auth/session/cookie and OAuth host behavior
- economy/payout formulas
- resolution/dispute workflow behavior
- notification and market-detail UI behavior

These are better Phase 7 targets than broad low-value coverage expansion. [VERIFIED: `backend/tests/test_auth.py`, `backend/tests/test_resolution.py`, `.planning/STATE.md` decisions list, frontend existing tests]

### Pattern 4: CI should call stable project commands, not embed all logic in YAML

The project already has a root `Makefile` and package/pyproject command surfaces. Phase 7 should strengthen those command entrypoints first, then point CI at them. That keeps local and CI behavior aligned. [VERIFIED: `Makefile`, `backend/pyproject.toml`, `frontend/package.json`]

### Pattern 5: E2E should run against Docker only in the heavy path

The Compose stack is already the canonical integration environment with healthchecks for `db`, `redis`, `backend`, and `frontend`. The optional/manual E2E path should use this stack rather than inventing a separate runtime model. [VERIFIED: `docker-compose.yml`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontend test migration | A Jest→Vitest conversion | Existing Jest stack | Out of scope and contradicts locked decision D-01 |
| Backend default integration environment | A mandatory Postgres/Redis test harness | Existing SQLite + `fakeredis` fixtures | Matches locked decision D-03 |
| CI command logic | Large inline shell pipelines in workflow YAML | repo commands/scripts | Easier to run locally and keep in sync |
| Full-suite E2E on every PR | always-on Docker/Playwright gating | optional/manual heavy path | Matches locked decision D-10 |

## Common Pitfalls

### Pitfall 1: Letting stale planning docs override the codebase
- `plan/TESTING.md` still says Vitest and real-Postgres backend testing are the baseline.
- The repo does not match that anymore.
- If plans follow the stale doc literally, Phase 7 will drift into framework migration instead of testing/CI completion. [VERIFIED: `plan/TESTING.md`, `frontend/package.json`, `backend/tests/conftest.py`]

### Pitfall 2: Spreading CI logic across multiple unrelated command surfaces
- If backend, frontend, and E2E commands are inconsistent between local and CI use, maintenance cost rises immediately.
- Phase 7 should standardize the command surfaces before or alongside workflow YAML.

### Pitfall 3: Making Playwright depend on fragile manual setup
- The current repo has no Playwright scaffolding, no `test:e2e` script, and no CI workflow.
- If E2E setup depends on hand-created state, the optional/manual path will still be too brittle to use.
- Phase 7 should either drive setup via UI/API flows or add a test-only gated helper path. [VERIFIED: `frontend/package.json`, `.github/workflows`]

### Pitfall 4: Chasing coverage percentages without improving regression detection
- The user explicitly rejected coverage-chasing as the main goal.
- Plans that only add thresholds but not meaningful tests will satisfy neither the user decision nor the actual safety objective.

### Pitfall 5: Overloading one plan with backend, frontend, E2E, and CI together
- The checker expects 2-3 tasks and manageable file sets per plan.
- Phase 7 naturally decomposes into backend, frontend, and integration/CI slices.

## Codebase Inventory

### Existing backend tests
- `backend/tests/test_auth.py`
- `backend/tests/test_autoresolution.py`
- `backend/tests/test_bets.py`
- `backend/tests/test_comments.py`
- `backend/tests/test_config.py`
- `backend/tests/test_economy.py`
- `backend/tests/test_ledger.py`
- `backend/tests/test_llm.py`
- `backend/tests/test_market_positions.py`
- `backend/tests/test_markets.py`
- `backend/tests/test_notification_service.py`
- `backend/tests/test_resolution.py`
- `backend/tests/test_socket.py`
- `backend/tests/test_tasks.py`
- `backend/tests/test_users.py`

This means backend Phase 7 work is an expansion/hardening phase, not a greenfield test scaffold. [VERIFIED: file listing]

### Existing frontend tests
- `frontend/src/components/auth/__tests__/LoginForm.test.tsx`
- `frontend/src/__tests__/NotificationBell.test.tsx`
- `frontend/src/app/(protected)/markets/new/__tests__/autoresolution.test.tsx`
- `frontend/src/app/(protected)/markets/[id]/__tests__/market-detail.test.tsx`

This means frontend Phase 7 work should add depth around existing critical pages/components and introduce coverage-friendly scripts/config, not a new test architecture. [VERIFIED: file listing]

### Existing infra seams relevant to CI/E2E
- `docker-compose.yml` already defines the full app stack with healthchecks.
- `Makefile` already centralizes some dev/test commands, but currently only exposes backend tests.
- `.env.example` already describes the runtime variables CI will need to populate or reuse.

## Recommended Plan Split

### Plan 01: Backend regression baseline
- Add backend coverage command support (`pytest-cov`) and normalize backend test invocation for CI. [ASSUMED: `pytest-cov` is the simplest path; verify during implementation]
- Expand backend tests in the risk-heavy domains: economy, resolution, auth/session, and critical API happy paths.
- Keep SQLite + `fakeredis` as the default test substrate.

### Plan 02: Frontend Jest regression baseline
- Add Jest coverage entrypoints without changing runner.
- Expand page/component tests around auth, notifications, top-nav/profile state, and market detail interactions.
- Keep mocks aligned with current repo style (`jest.mock`, store mocking, `next/navigation` mocking).

### Plan 03: Playwright plus CI integration
- Introduce Playwright config and four critical specs only.
- Add any minimal, test-only setup mechanism needed to make those flows reliable, but keep it gated off by default.
- Create GitHub Actions with lightweight backend/frontend checks on `push`/`pull_request`, and the Docker/Playwright path as optional/manual.

## Validation Architecture

| Requirement | Delivery focus | Best automation layer |
|-------------|----------------|------------------------|
| `TEST-01` economy formulas | deterministic math and payout cases | backend pytest |
| `TEST-02` backend integration | auth, bets, resolution-related routes | backend pytest with `AsyncClient` |
| `TEST-03` frontend component tests | auth, notification, market/profile regressions | Jest + RTL |
| `TEST-04` E2E critical paths | auth, bet lifecycle, dispute, notifications | Playwright against Docker |

## Open Questions (RESOLVED)

1. Does Playwright need a dedicated test-support API surface, or are the current UI/API flows enough to set up the four required scenarios reliably?
   - Resolved: keep the existing env-gated `test_support` route surface already present in the repo for deterministic E2E setup where UI-only setup would be brittle or too slow.
   - Constraint: the helper surface remains explicitly disabled by default and is only enabled in the manual E2E flow via `ENABLE_E2E_TEST_SUPPORT=true`.

2. Should backend/frontend coverage thresholds be enforced immediately in CI, or should Phase 7 start by producing reports and only fail on broken tests?
   - Resolved: Phase 7 should prove real coverage output now, but threshold enforcement can remain phased.
   - Rationale: D-05 prioritizes regression safety over threshold-chasing, so the immediate requirement is trustworthy runnable proof and captured percentages, not an early brittle gate on every percentage target.

## Final Recommendation

Plan Phase 7 as three plans in two waves:

- Wave 1
  - `07-01`: backend regression baseline
  - `07-02`: frontend Jest regression baseline
- Wave 2
  - `07-03`: Playwright critical flows and GitHub Actions CI

That structure preserves parallelism where the codebase allows it, keeps plan scopes checker-friendly, and aligns with all locked decisions. [VERIFIED: phase scope + repo scan]
