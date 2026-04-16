# Roadmap: Vox Populi

**Created:** 2026-03-24
**Target:** 14+ module points for 42 school ft_transcendence v21.0

---

## Phase 1 — Foundation

**Goal:** Working Docker stack with auth and database schema in place.

**Delivers:**
- Docker Compose: Nginx (HTTPS), FastAPI, Next.js, PostgreSQL, Redis, Celery
- Database schema (all tables, indexes, migrations via Alembic)
- User registration + login (email/password, JWT access + refresh tokens)
- Next.js 15 app shell: layout, routing, Tailwind, Zustand store skeleton

**Requirements:** INFRA-01–05, AUTH-01–04

**Canonical refs:**
- `plan/TECH.md`
- `plan/DATABASE.md`
- `plan/AUTH.md`
- `plan/DEPLOYMENT.md`

**42 modules:** FastAPI + Next.js (2pts), ORM/SQLAlchemy (1pt) — partial

**Plans:** 5/5 plans complete

Plans:
- [x] 01-01-PLAN.md — Docker Compose infra: all services, Nginx HTTPS, .env, Makefile, Dockerfiles
- [x] 01-02-PLAN.md — Backend foundation: FastAPI app, config, models (16 tables), Alembic migration, test scaffold
- [x] 01-03-PLAN.md — Auth API: register, login, /me, refresh, logout, password reset + integration tests
- [x] 01-04-PLAN.md — Next.js frontend: layout, Zustand store, middleware, auth pages, dashboard
- [x] 01-05-PLAN.md — Seed script + full stack smoke test checkpoint

---

## Phase 2 — Core Betting

**Goal:** Users can create markets, place bets, discuss, and earn karma.

**Delivers:**
- Market CRUD (create, list, detail pages)
- Betting system: place YES/NO (1 bp), withdraw, odds calculation
- Points economy: kp, bp, tp ledgers; daily allocation via Celery
- Comment threads with upvotes (kp earned)
- Dashboard: active bets, portfolio summary

**Requirements:** BET-01–08, DISC-01–03

**Canonical refs:**
- `plan/ECONOMY.md`
- `plan/PLANNING.md` §2–5 (UX flows, pages)

**42 modules:** Standard user management (2pts) — partial

**Plans:** 9/9 plans complete

Plans:
- [x] 02-01-PLAN.md — Market model, CRUD API, list + detail pages
- [x] 02-02-PLAN.md — Betting engine: place/withdraw, odds, economy ledger
- [x] 02-03-PLAN.md — Points economy: daily allocation, Celery beat, kp events
- [x] 02-04-PLAN.md — Comment threads, upvotes, market upvotes
- [x] 02-05-PLAN.md — Dashboard portfolio view
- [x] 02-06-PLAN.md — UAT fixes: login, nav balance, multichoice/numeric markets
- [x] 02-07-PLAN.md — Gap closure: bet cap enforcement + decimal input fix
- [x] 02-08-PLAN.md — Gap closure: comment author display + reply UI
- [x] 02-09-PLAN.md — Gap closure: dashboard portfolio row cleanup

---

## Phase 3 — Social

**Goal:** Friends, chat, profiles, notifications.

**Delivers:**
- Friend system (request / accept / decline / block)
- Direct messaging (persistent chat threads)
- User profiles: avatar upload, stats (kp, tp, bet history), bio
- Online status tracking (Redis-backed presence)
- In-app notification system (friend requests, bet events)

**Requirements:** SOC-01–05, COMP-04 (Chrome clean)

**Canonical refs:**
- `plan/PLANNING.md` §2.2 (key pages: Profile, Friends, Chat)

**42 modules:** User interaction — chat, profiles, friends (2pts); Standard user management (2pts); Notification system (1pt)

**Plans:** 4/4 plans complete (implemented directly by Claude Code)

Plans:
- [x] 03-01 — Friend system (request/accept/decline/block, symmetric constraint)
- [x] 03-02 — User profiles (avatar upload, bio, stats, user search)
- [x] 03-03 — Direct messaging chat (persistent threads, paginated history)
- [x] 03-04 — Notification system (bell dropdown, friend/bet/market events)

---

## Phase 4 — Real-time

**Goal:** Live updates via Socket.IO throughout the app.

**Delivers:**
- Socket.IO integration: bet odds, comments, notifications — all live
- Room architecture: `bet:{id}`, `user:{id}`, `global`
- Reconnection + state sync strategy
- Online status updates via Socket.IO

**Requirements:** RT-01–03

**Canonical refs:**
- `plan/REALTIME.md`

**42 modules:** Real-time features / WebSockets (2pts)

**Plans:** 2/4 plans executed

Plans:
- [x] 04-01-PLAN.md — Backend socket server: AsyncServer singleton, ASGI wrapper, connect auth, test scaffold
- [x] 04-02-PLAN.md — Backend service emit hooks: bet odds (throttled), comments, notifications, chat
- [x] 04-03-PLAN.md — Frontend socket store + AuthBootstrap/logout wiring
- [x] 04-04-PLAN.md — Frontend live updates: replace polling in NotificationBell, chat, market detail

---

## Phase 5 — Intelligence & Resolution

**Goal:** Full resolution system and LLM-powered features.

**Delivers:**
- Tier 1 auto-resolution (Celery poller)
- Tier 2 proposer resolution + 48h dispute window
- Tier 3 community vote (weighted, validity check, payout)
- LLM thread summarizer + resolution assistant (OpenRouter)
- Budget caps, prompt injection prevention, opt-out setting

**Requirements:** RES-01–06, LLM-01–05, ECON-01

**Canonical refs:**
- `plan/RESOLUTION.md`
- `plan/LLM_INTEGRATION.md`
- `plan/ECONOMY.md` (payout formulas)

**42 modules:** LLM interface (2pts)

**Plans:** 13/13 plans complete

Plans:
- [x] 05-01-PLAN.md — Wave 0: test scaffolds (test_resolution.py, test_llm.py, fake_redis fixture)
- [x] 05-02-PLAN.md — Migration 009 (llm_opt_out) + resolution_service.py (payout, vote weights, tp)
- [x] 05-03-PLAN.md — LLM service (OpenRouter, rate-limit, budget cap) + LLM API routes
- [x] 05-04-PLAN.md — Celery resolution tasks (auto-resolution, dispute deadlines) + REST routes
- [x] 05-05-PLAN.md — Frontend: inline ResolutionSection, DisputeSection, LLM buttons, settings page
- [x] 05-06-PLAN.md — Frontend: socket wiring (bet:resolved, dispute:*) + UAT checkpoint
- [x] 05-07-PLAN.md — Gap closure: LLM settings redesign (migration 012, config endpoint, conditional platform-default, model field, profile cogwheel)
- [x] 05-08-PLAN.md — Gap closure: payout formula fix (proportional BP pool split, per-position averaged TP)
- [x] 05-09-PLAN.md — Gap closure: deadline input UX fix (split datetime-local into date + time inputs)
- [x] 05-10-PLAN.md — Gap closure: add check_auto_resolution fallback beat task (RES-01 safety net)
- [x] 05-11-PLAN.md — Gap closure: align RES-04/RES-06 spec text + fix asyncio decorator warnings
- [x] 05-12-PLAN.md — Gap closure: wire OPENROUTER_MODEL env var through Settings to call_openrouter
- [x] 05-13-PLAN.md — Gap closure: render AI summary and hint as markdown via react-markdown

---

## Phase 5.1 — Autoresolution, Profile Bet Logs, Market Bet Details (INSERTED)

**Goal:** Wire Open-Meteo auto-resolution through market creation UI, add public point transaction ledger to user profiles, and add participant lists + payout breakdowns to market detail pages.

**Delivers:**
- Market creation form: auto-resolution toggle with city/condition fields; resolution_source JSON persisted to Bet
- Profile pages: full sortable point transaction ledger (BP/TP/KP UNION query, all flows)
- Market detail pages: participant list + aggregate stats; payout breakdown for closed markets
- Three new public GET endpoints: positions, payouts, transactions

**Requirements:** D-01–D-10

**Plans:** 4 plans

Plans:
- [ ] 05.1-01-PLAN.md — Backend: resolution_source schema field + MarketCreate validator + market_service persistence
- [ ] 05.1-02-PLAN.md — Backend: ledger_service (UNION query) + TransactionListResponse schema + GET /users/{username}/transactions
- [ ] 05.1-03-PLAN.md — Backend: ParticipantListResponse + PayoutListResponse schemas + GET /markets/{id}/positions + GET /markets/{id}/payouts
- [ ] 05.1-04-PLAN.md — Frontend: auto-resolution toggle (new/page.tsx) + participants/payouts sections ([id]/page.tsx) + transaction ledger (profile/page.tsx) + all i18n keys

---

## Phase 6 — Polish & Compliance

**Goal:** i18n, OAuth, legal pages, dark mode. 42 compliance complete.

**Delivers:**
- i18n: English, French, German (all UI strings, legal pages)
- OAuth 2.0: Google, GitHub, 42 school (PKCE flow)
- Privacy Policy + Terms of Service (EN/FR/DE) at `/privacy` and `/terms`
- GDPR: data export endpoint, account deletion with pseudonymization
- Dark mode (Tailwind `dark:` variants)
- Chrome audit: zero console errors/warnings

**Requirements:** AUTH-05, COMP-01–06

**Canonical refs:**
- `plan/AUTH.md`
- `plan/PRIVACY.md`

**42 modules:** OAuth 2.0 (1pt); i18n (1pt)

**Plans:** 3 plans

Plans:
- [x] 06-01-PLAN.md — Merge imp/i18n + fix/polish; OAuth env gap; locale switcher in nav; GDPR+dark mode verify
- [x] 06-02-PLAN.md — Privacy Policy + Terms of Service i18n (EN/FR/DE translations + client components)
- [x] 06-03-PLAN.md — Chrome audit fixes (dark mode gaps, hydration, nav i18n) + human verification checkpoint

---

## Phase 7 — Testing & Stretch

**Goal:** Test suite complete; stretch modules if time permits.

**Delivers:**
- pytest backend tests (economy, resolution, auth — 80%+ coverage)
- Vitest frontend component tests (70%+ coverage)
- Playwright E2E: auth flow, bet lifecycle, dispute, notifications
- GitHub Actions CI pipeline
- Stretch (time-permitting): Public API (+2pts), advanced search (+1pt), PWA (+1pt)

**Requirements:** TEST-01–04

**Canonical refs:**
- `plan/TESTING.md`
- `plan/SCALING.md` (load test targets)

---

## Module Point Summary

| Module | Phase | Pts |
|---|---|---|
| Frontend (Next.js 15) + Backend (FastAPI) | 1 | 2 |
| ORM (SQLAlchemy 2) | 1 | 1 |
| Standard user management | 2–3 | 2 |
| User interaction (chat, profiles, friends) | 3 | 2 |
| Notification system | 3 | 1 |
| Real-time (Socket.IO) | 4 | 2 |
| LLM interface | 5 | 2 |
| OAuth 2.0 | 6 | 1 |
| i18n (EN/FR/DE) | 6 | 1 |
| **Total** | | **14** |

Stretch: +5 pts available (Public API, GDPR, search, PWA)

---
*Roadmap created: 2026-03-24*
