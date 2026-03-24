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

**Plans:** 1/5 plans executed

Plans:
- [x] 01-01-PLAN.md — Docker Compose infra: all services, Nginx HTTPS, .env, Makefile, Dockerfiles
- [ ] 01-02-PLAN.md — Backend foundation: FastAPI app, config, models (16 tables), Alembic migration, test scaffold
- [ ] 01-03-PLAN.md — Auth API: register, login, /me, refresh, logout, password reset + integration tests
- [ ] 01-04-PLAN.md — Next.js frontend: layout, Zustand store, middleware, auth pages, dashboard
- [ ] 01-05-PLAN.md — Seed script + full stack smoke test checkpoint

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

---

## Phase 5 — Intelligence & Resolution

**Goal:** Full resolution system and LLM-powered features.

**Delivers:**
- Tier 1 auto-resolution (Celery poller)
- Tier 2 proposer resolution + 48h dispute window
- Tier 3 community vote (weighted, validity check, payout)
- LLM thread summarizer + resolution assistant (OpenRouter)
- Budget caps, prompt injection prevention, opt-out setting

**Requirements:** RES-01–06, LLM-01–04

**Canonical refs:**
- `plan/RESOLUTION.md`
- `plan/LLM_INTEGRATION.md`
- `plan/ECONOMY.md` (payout formulas)

**42 modules:** LLM interface (2pts)

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
