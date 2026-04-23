# Phase 7: Testing & Stretch - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 is testing and CI only. The goal is to complete a practical automated quality baseline for the existing app: backend pytest coverage, frontend component/unit coverage with the current frontend test runner, Playwright coverage for the four critical user flows, and an initial GitHub Actions pipeline.

Stretch modules from the roadmap (Public API, advanced search, PWA) are explicitly deferred out of this phase even if time remains.

</domain>

<decisions>
## Implementation Decisions

### Test Stack Direction
- **D-01:** Keep the current repo test stack instead of forcing the older roadmap/testing doc assumptions. Backend stays on `pytest`; frontend stays on `jest`, not Vitest.
- **D-02:** Planning must align phase deliverables and commands to the current codebase reality rather than treating `plan/TESTING.md` as fully authoritative.

### Backend Test Environment
- **D-03:** Keep the current fast backend harness as the default baseline: in-memory SQLite plus `fakeredis`, following the existing `backend/tests/conftest.py` pattern.
- **D-04:** Phase 7 does not need to introduce real Postgres/Redis as the baseline test environment. Targeted higher-fidelity coverage is optional only if a specific gap clearly requires it.

### Coverage Philosophy
- **D-05:** Prioritize broad safety over chasing strict numeric coverage for its own sake. The test suite should cover critical business logic and user flows first.
- **D-06:** Focus coverage on the highest-risk areas already called out by the roadmap and requirements: economy formulas, resolution/dispute behavior, auth/session handling, and core UI regressions.
- **D-07:** Existing tests should be expanded pragmatically around real failure modes and regression-prone paths, not inflated with low-value tests just to satisfy a percentage.

### E2E Scope
- **D-08:** Playwright scope is limited to the four critical flows from the testing plan: auth flow, bet lifecycle, dispute flow, and notifications.
- **D-09:** Phase 7 should not broaden E2E coverage into general UI smoke coverage or non-critical feature permutations.

### CI Strictness
- **D-10:** GitHub Actions should be introduced in an incremental way: backend and frontend automated checks are part of the baseline CI path, while the heavier Docker/Playwright path starts as optional or manually triggered rather than mandatory on every push/PR.
- **D-11:** The pipeline should be structured so the project gets useful automated feedback quickly without making iteration unreasonably slow or brittle.

### Scope Guardrail
- **D-12:** Stretch modules are out of scope for Phase 7. Even if the test baseline completes early, this phase ends at testing/CI rather than rolling directly into Public API, advanced search, or PWA work.

### the agent's Discretion
- Exact CI job split and trigger strategy, as long as the heavy E2E path starts optional/manual
- Whether coverage gates are enforced immediately or phased in after the suite stabilizes
- Exact test file additions and grouping, as long as they follow the established repo patterns
- Whether any lightweight test utilities or fixtures are worth refactoring before adding more tests

</decisions>

<specifics>
## Specific Ideas

- "Keep current stack" means preserve the repo's current `pytest` + `jest` direction rather than migrating frontend tests to Vitest mid-phase.
- "Prioritize broad safety" means protect critical product flows and fragile business rules first, not optimize for a coverage dashboard.
- "4 critical flows only" means Playwright is limited to auth, bet lifecycle, dispute, and notifications.
- "Heavier Docker/Playwright path optional/manual at first" means CI should not block every push on the slowest path initially.
- Stretch work was reconsidered and explicitly removed from Phase 7 scope.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance targets
- `.planning/ROADMAP.md` — Phase 7 goal, deliverables, and the fact that stretch items exist but are now deferred by this context
- `.planning/REQUIREMENTS.md` — `TEST-01` through `TEST-04` define the testing requirements for this phase
- `.planning/STATE.md` — project is ready for Phase 7 planning after Phase 06.1 completion

### Testing strategy docs
- `plan/TESTING.md` — original testing strategy and intended critical flows; use as input, but reconcile with actual repo state
- `plan/SCALING.md` — load-test and performance targets that may inform CI/test planning, without expanding scope beyond testing

### Existing backend test baseline
- `backend/pyproject.toml` — current pytest configuration and dev dependencies
- `backend/tests/conftest.py` — current SQLite + `fakeredis` fixture strategy
- `backend/tests/test_economy.py` — existing coverage pattern for economy logic
- `backend/tests/test_resolution.py` — existing coverage pattern for resolution logic
- `backend/tests/test_auth.py` — existing auth/session coverage pattern

### Existing frontend test baseline
- `frontend/package.json` — current frontend scripts and `jest` dependency setup
- `frontend/jest.config.ts` — current frontend test runner configuration
- `frontend/jest.setup.ts` — frontend test environment bootstrap
- `frontend/src/components/auth/__tests__/LoginForm.test.tsx` — representative current component test pattern
- `frontend/src/app/(protected)/markets/[id]/__tests__/market-detail.test.tsx` — representative current page-level test pattern
- `frontend/src/app/(protected)/markets/new/__tests__/autoresolution.test.tsx` — representative feature regression test pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tests/conftest.py`: already provides a working async test client, temporary RSA keys, DB override wiring, and fake Redis support
- Existing backend test modules already cover major domains: auth, bets, comments, economy, resolution, autoresolution, notifications, sockets, ledger, markets
- `frontend/jest.config.ts` and `frontend/jest.setup.ts`: current frontend testing foundation already in place
- Existing frontend tests in auth and market pages provide concrete patterns for mocking `@/lib/api`, `next/navigation`, i18n, and Zustand stores

### Established Patterns
- Backend tests currently favor fast in-process tests over container-backed integration tests
- Frontend tests currently use Jest globals and React Testing Library, not Vitest APIs
- The repo has no Playwright config yet and no `.github/workflows` CI pipeline scaffold yet
- Some project planning docs still describe an older intended testing stack; Phase 7 planning must reconcile docs with reality instead of following them blindly

### Integration Points
- Backend quality work connects through `backend/tests/` and `backend/pyproject.toml`
- Frontend quality work connects through `frontend/src/**/__tests__`, `frontend/package.json`, and Jest config files
- CI work will connect through `.github/workflows/`
- E2E scaffolding will need new Playwright config plus a strategy for booting the app stack in automation without disturbing the current local workflow

</code_context>

<deferred>
## Deferred Ideas

- Public API stretch module — deferred beyond Phase 7
- Advanced search stretch module — deferred beyond Phase 7
- PWA stretch module — deferred beyond Phase 7
- Replacing Jest with Vitest — deferred unless a future phase has a strong reason to migrate
- Making Docker/Playwright mandatory on every PR/push immediately — deferred until the heavy path is stable and worth enforcing

</deferred>

---

*Phase: 07-testing-stretch*
*Context gathered: 2026-04-21*
