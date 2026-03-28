---
gsd_state_version: 1.0
milestone: v21.0
milestone_name: milestone
current_plan: Not started
status: In progress
last_updated: "2026-03-28T00:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 18
  completed_plans: 18
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-24)

**Core value:** Users can bet on real-world outcomes, argue their position, and earn a verifiable reputation score — without real money.
**Current focus:** Phase 04 — real-time

## Current Status

**Phase:** 03 complete → 04 next
**Current Plan:** Not started
**Last session:** 2026-03-28T00:00:00.000Z
**Resume file:** None

## Decisions

| Decision | Rationale | Phase |
|---|---|---|
| docker-compose.override.yml for dev hot-reload; base compose is eval-ready | Override picked up automatically by Docker Compose; evaluators never see it | 01-01 |
| Alembic migrations run in backend entrypoint before uvicorn start | Ensures migrations are always current on container start | 01-01 |
| Frontend production Dockerfile uses npm start not next dev | Two-stage build with npm run build in builder stage | 01-01 |
| gen-keys Makefile target generates SSL cert and RSA JWT key pair together | Single command for developer onboarding | 01-01 |

- [Phase 01]: docker-compose.override.yml for dev hot-reload; base compose is eval-ready without modification
- [Phase 01]: Alembic migrations run in backend entrypoint before uvicorn start; gen-keys Makefile target generates SSL cert and RSA JWT key pair in one command
- [Phase 01-02]: field_validator on secret_key rejects empty string — empty secret is insecure; pydantic str allows empty
- [Phase 01-02]: backend/.env with test values enables pytest to import app.config without Docker running
- [Phase 01-03]: bcrypt pinned to <4.0.0 for passlib 1.7.4 compatibility (bcrypt 5.x removed __about__ attr)
- [Phase 01-03]: sqlalchemy.types.Uuid replaces dialects.postgresql.UUID for cross-dialect compatibility (SQLite tests)
- [Phase 01-03]: Ephemeral RSA keys in conftest session fixture — tests don't need Docker secrets
- [Phase 01-03]: ForeignKey("users.id") added to OauthAccount.user_id — was missing in Plan 02 model
- [Phase 01-04]: Next.js 16 renames middleware.ts to proxy.ts — route guard uses src/proxy.ts with exported 'proxy' function
- [Phase 01-04]: AuthBootstrap client component required because root layout is a Server Component; cannot call useEffect in layout directly
- [Phase 01-04]: Zustand logout() is async — calls /api/auth/logout before clearing store state for proper server-side cookie clearing
- [Phase 01-05]: Seed script uses select + scalar_one_or_none before insert — safe to re-run without duplicate key errors
- [Phase 01-05]: JWT key paths in .env.example updated to keys/ (relative, dev path) instead of /run/secrets/ (Docker Secrets path)
- [Phase 02-09]: Display own-side win probability (Win X%) instead of both YES/NO percentages — simpler, user-centric
- [Phase 02-07]: compute_bet_cap uses log10 (digit count) not log2 — correct BET-04 formula
- [Phase 02-08]: Join User in both list_comments and create_comment rather than a separate lookup — keeps API contract simple

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|---|---|---|---|---|
| 01 | 01 | 3min | 2 | 11 |
| Phase 01 P01 | 3min | 2 tasks | 11 files |
| Phase 01 P02 | 8min | 2 tasks | 17 files |
| Phase 01 P03 | 9min | 2 tasks | 15 files |
| 01 | 04 | 16min | 2 | 22 |
| 01 | 05 | 15min | 2 | 4 |
| Phase 02 P09 | 2min | 1 tasks | 1 files |
| Phase 02 P07 | 2min | 2 tasks | 4 files |
| Phase 02 P08 | 2 | 2 tasks | 4 files |

## Session History

| Date | Stopped At |
|---|---|
| 2026-03-24 | Project initialized — roadmap created, ready for Phase 1 |
| 2026-03-24 | Completed 01-foundation/01-01-PLAN.md — Docker infrastructure scaffold |
| 2026-03-24 | Completed 01-foundation/01-03-PLAN.md — Auth API: register, login, /me, refresh, logout, reset |
| 2026-03-24 | Completed 01-foundation/01-04-PLAN.md — Next.js 16 frontend: auth UI, Zustand store, proxy route guard |
| 2026-03-24 | Completed 01-foundation/01-05-PLAN.md — Dev seed + full stack smoke test; Phase 1 complete |
| 2026-03-26 | Phase 2 complete — markets, betting, economy, comments, dashboard |
| 2026-03-28 | Phase 3 complete (via Claude Code) — friend system, user profiles, chat, notifications |
