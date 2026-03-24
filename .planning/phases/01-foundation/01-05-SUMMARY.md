---
phase: 01-foundation
plan: 05
subsystem: infra
tags: [docker, fastapi, nextjs, postgres, redis, jwt, pytest, seed]

# Dependency graph
requires:
  - phase: 01-foundation/01-04
    provides: Next.js frontend with auth UI, Zustand store, proxy route guard
  - phase: 01-foundation/01-03
    provides: FastAPI auth API (register, login, /me, refresh, logout, reset)
  - phase: 01-foundation/01-02
    provides: backend config, models, migrations, tests
  - phase: 01-foundation/01-01
    provides: Docker Compose 6-service stack, Nginx HTTPS, Makefile

provides:
  - Dev seed script creating alice and bob test users (idempotent, make seed)
  - Full end-to-end smoke test verification of Phase 1 deliverable
  - Confirmed all 6 Docker services healthy in integrated stack

affects: [02-markets, future phases requiring working dev environment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent seed script via select + scalar_one_or_none before insert"
    - "make seed target calls docker compose exec backend uv run python scripts/seed_dev.py"

key-files:
  created:
    - backend/scripts/__init__.py
    - backend/scripts/seed_dev.py
  modified:
    - .env.example
    - docker-compose.override.yml

key-decisions:
  - "Seed script uses upsert-via-select pattern (skip if email exists) so it is safe to run repeatedly in dev"
  - "JWT key paths in .env.example updated to keys/ (relative, inside container) instead of /run/secrets/ (Docker secrets path)"

patterns-established:
  - "Seed scripts live in backend/scripts/ and are invoked via make targets"
  - "All smoke test steps verified before marking phase complete"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-03-24
---

# Phase 1 Plan 05: Dev Seed + Full Stack Smoke Test Summary

**Idempotent dev seed script (alice + bob) created and all 12 Phase 1 smoke test steps verified: 6 healthy Docker services, HTTPS API, JWT httpOnly cookies, 11/11 pytest passing, and browser auth flow working end-to-end**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T23:30:00Z
- **Completed:** 2026-03-24T23:44:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Dev seed script created for alice and bob test users — idempotent, runnable via `make seed`
- All 6 Docker services reach healthy status via `docker compose up --build`
- HTTPS on :8443 confirmed; FastAPI auth API and Next.js frontend fully integrated
- All 11 backend pytest tests green inside container
- Full browser auth flow verified: register → login → dashboard → logout → redirect guard

## Task Commits

1. **Task 1: Dev seed script** — `dfe006e` (feat)
2. **Task 2: Smoke test config fixes** — `da9502e` (chore)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `backend/scripts/__init__.py` — Empty package init for scripts module
- `backend/scripts/seed_dev.py` — Idempotent dev seed: creates alice + bob with hashed passwords
- `.env.example` — JWT key paths corrected to `keys/` relative paths
- `docker-compose.override.yml` — Removed deprecated `version:` field

## Decisions Made

- Seed script uses select + `scalar_one_or_none` before insert — safe to re-run without duplicate key errors
- JWT key paths in `.env.example` changed from `/run/secrets/` (Docker Secrets path) to `keys/` (standard dev path matching `make gen-keys` output location)

## Deviations from Plan

None — plan executed exactly as written. Minor config corrections (`JWT_PRIVATE_KEY_PATH`, `version:` removal) discovered during smoke test and fixed inline.

## Issues Encountered

- `make seed` initially failed with import error: `PYTHONPATH` not set — fixed with `PYTHONPATH=/app` in Makefile target (committed as `ee66dbc` during Task 1 phase)
- Backend healthcheck URL was `/health` instead of `/api/health` — fixed in `dbc47cc`
- `frontend/public/` directory missing for Docker build — fixed in `7daa5a5`

All issues were caught and resolved during the seed task phase, before the smoke test checkpoint.

## User Setup Required

None — no external service configuration required. Dev environment runs fully from `make gen-keys && docker compose up --build`.

## Next Phase Readiness

- Phase 1 complete: full Docker stack operational, auth API verified, frontend auth flow working
- `alice@example.com / Passw0rd!` and `bob@example.com / Passw0rd!` available via `make seed`
- Ready for Phase 2: prediction markets core (market model, bet model, resolution logic)

---
*Phase: 01-foundation*
*Completed: 2026-03-24*
