---
gsd_state_version: 1.0
milestone: v21.0
milestone_name: milestone
current_plan: 1
status: Executing Phase 05
last_updated: "2026-04-02T08:33:33.712Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 29
  completed_plans: 28
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-24)

**Core value:** Users can bet on real-world outcomes, argue their position, and earn a verifiable reputation score — without real money.
**Current focus:** Phase 05 — intelligence-resolution

## Current Status

**Phase:** 03 complete → 04 next
**Current Plan:** 1
**Last session:** 2026-04-02T08:33:33.689Z
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
- [Phase 04]: useSocketStore.getState() in logout() — Zustand outside-React pattern for non-component action calls
- [Phase 04]: Socket connects with withCredentials: true, no auth token field — D-04 httpOnly cookie constraint
- [Phase 04-01]: importlib.import_module used in main.py to register socket events without shadowing FastAPI app variable
- [Phase 04-01]: cors_allowed_origins=[] on AsyncServer singleton — Nginx handles CORS, wildcard conflicts with withCredentials cookie auth
- [Phase 05]: Community vote button style: active = green+bold+border-2; inactive options = violet (matches multichoice display); binary voted-NO turns YES red (rejected)
- [Phase 05]: Replaced collection-breaking test_llm.py with xfail stubs where service imports are inside test bodies — Wave 0 Nyquist compliance
- [Phase 05-02]: TpTransaction has no reason field — omitted from constructor call (plan's sample code was incorrect)
- [Phase 05-02]: Proposer penalty clamped to current balance to avoid 402 mid-payout transaction
- [Phase 05-02]: Socket emit in trigger_payout fire-and-forget (try/except pass) so socket failure never rolls back payout
- [Phase 05-03]: EXPIREAT (not EXPIRE) for rate limit keys ensures exact EOD UTC expiry regardless of creation time
- [Phase 05-03]: Routes use cookie-based auth (_get_current_user from request cookies) — get_current_user not in deps.py
- [Phase 05-04]: Tier 1 auto-resolution uses status='proposer_resolved' same as Tier 2 — only Resolution.tier differentiates them
- [Phase 05-04]: Resolution routes use cookie-based auth (_get_current_user from request) — consistent with bets.py, no get_current_user in deps.py
- [Phase 05-05]: GET /api/users/me added alongside PATCH — settings page needs to read current llm_opt_out value; route ordering before /{username} required for FastAPI priority
- [Phase 05-05]: resolutionQuery enabled only when market.status !== open to avoid 404 on open markets (no resolution record yet)
- [Phase 05-hotfix]: resolution.py async with db.begin() replaced with await db.commit() — SQLAlchemy 2.x autobegin on first query makes nested begin() raise InvalidRequestError
- [Phase 05-hotfix]: list_positions active condition changed from market.status == "open" to market.status != "closed" — positions on pending_resolution/proposer_resolved/disputed markets must show in active list with status colors
- [Phase 05-hotfix]: MarketCard status colors: open=white, pending_resolution=red(own)/yellow, proposer_resolved=blue, disputed=violet, closed=green — identical on /markets and /dashboard
- [Phase 05-hotfix]: Dispute button myPosition guard removed — backend enforces 403; frontend shows error inline so button is always visible on proposer_resolved markets
- [Phase 05-06]: TopNav.tsx (not Navbar.tsx) is the actual nav component — plan referenced wrong filename
- [Phase 05-06]: dispute:voted patches React Query cache directly for immediate tally updates without refetch round-trip
- [Phase 05-06]: UAT issue 1 (date/time picker UX gap) deferred to separate gap closure plan; issues 2+3 addressed by 05-07 LLM settings redesign
- [Phase 05-08]: D-11 payout: proportional BP pool split replaces flat +1 bp; per-position TP average replaces time-based formula
- [Phase 05-07]: GET /api/config/llm-available reads OPENROUTER_API_KEY from env; never exposes the value — only bool presence
- [Phase 05-07]: Settings page defaults to 'disabled' when platform key unavailable to avoid broken default mode
- [Phase 05-09]: deadlineDate/deadlineTime derived inline via split('T') — no new useState added; IIFE scopes derivations without polluting component scope
- [Phase 05-10]: check_auto_resolution delegates to resolve_market_at_deadline via send_task — isolates each bet's processing and stays idempotent
- [Phase 05-10]: Fallback beat complements per-bet ETA: catches markets whose ETA tasks were lost on worker restart or broker flush

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
| Phase 04 P03 | 3min | 2 tasks | 3 files |
| Phase 04 P01 | 8min | 2 tasks | 8 files |
| Phase 05 P01 | 8min | 2 tasks | 3 files |
| Phase 05 P02 | 5min | 2 tasks | 4 files |
| Phase 05 P03 | 12min | 2 tasks | 4 files |
| Phase 05 P04 | 15min | 2 tasks | 4 files |
| Phase 05 P05 | 10min | 2 tasks | 4 files |
| Phase 05 P06 | 8min | 2 tasks | 2 files |
| Phase 05 P08 | 6min | 1 tasks | 2 files |
| Phase 05 P07 | 5min | 2 tasks | 7 files |
| Phase 05 P09 | 3min | 1 tasks | 1 files |
| Phase 05 P10 | 5min | 2 tasks | 3 files |

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
