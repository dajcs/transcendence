# Vox Populi

## What This Is

A reputation-based prediction market web app built as a 42 school ft_transcendence project (v21.0). Users create and bet on predictions using platform-native points (Karma, Truth, Betting Points) instead of real money. Every bet doubles as a discussion thread with tiered resolution (automatic, proposer, community vote). The platform rewards truth-seeking over wealth — being right matters more than being rich.

## Core Value

Users can bet on real-world outcomes, argue their position in discussion threads, and earn a verifiable reputation score — all without real money.

## Requirements

### Validated

**Responsive Web Design** — Validated in Phase 08: stretch-modules
- Mobile hamburger drawer sidebar with backdrop overlay and slide-in animation
- Breakpoint-conditional AppShell margin (full-width on mobile, 220px offset on desktop)
- Responsive markets grid replacing inline gridTemplateColumns
- SVG histogram overflow-x-auto wrapping on market detail page
- Profile page: compact 5-stat row, split date/time columns, mobile-optimised bets/markets tables
- All 15+ pages tested at 360px — no horizontal overflow

**Intelligence & Resolution** — Validated in Phase 05: intelligence-resolution
- Tiered resolution (auto Celery ETA + beat fallback, proposer, community vote with weighted voting)
- LLM via OpenRouter: thread summarizer + resolution assistant with rate limits (5/day summary, 3/day hint)
- OPENROUTER_MODEL env var configures model at runtime (default: openai/gpt-4o-mini)
- Monthly budget cap enforced via Redis; graceful 503 degradation on cap exceeded
- AI responses rendered as markdown via react-markdown in market detail page
- Prompt injection prevention (sanitized inputs, system-role isolation)

### Active

**Infrastructure**
- [ ] Docker Compose single-command start (`docker compose up --build`)
- [ ] HTTPS on all endpoints (Nginx + self-signed cert)
- [ ] PostgreSQL 16 + Redis 7 running in containers
- [ ] Environment config via `.env` (git-ignored), `.env.example` committed

**Auth**
- [ ] Email/password registration and login
- [ ] JWT access + refresh token flow
- [ ] OAuth 2.0: Google, GitHub, 42 school
- [ ] Password reset via email link

**Betting**
- [ ] Create markets (title, description, resolution criteria, deadline)
- [ ] Place YES/NO bets (costs 1 bp per vote)
- [ ] Withdraw bets before resolution (partial refund by probability)
- [ ] Four-currency economy: kp, bp, tp, sp (Phase 2)
- [ ] Bet cap enforced: `floor(log10(kp + 1)) + 1` max position
- [ ] Daily bp allocation via Celery scheduled task

**Discussion**
- [ ] Each bet is a threaded discussion (comments + replies)
- [ ] Upvotes on comments earn kp for authors
- [ ] Real-time comment updates via Socket.IO

**Resolution**
- [ ] Tier 1: Automatic (API polling)
- [ ] Tier 2: Proposer resolution with justification
- [ ] Tier 3: Community vote dispute (weighted, 48h window)
- [ ] Proposer penalty on overturned resolutions
- [ ] Payout: +1 bp + tp to winners on close

**Social**
- [ ] Friend system (request/accept/block)
- [ ] Direct messaging chat
- [ ] User profiles with stats (kp, tp, bet history)
- [ ] Online status tracking
- [ ] Notification system (in-app)

**Real-time**
- [ ] Socket.IO: live bet odds, comments, notifications
- [ ] Room-based architecture (bet rooms, user rooms)

**Intelligence**
- [ ] LLM via OpenRouter: thread summarizer + resolution assistant
- [ ] Per-user daily LLM usage limits + monthly budget cap

**Polish**
- [ ] i18n: English, French, German
- [ ] Dark mode
- [ ] Privacy Policy + Terms of Service pages (42 requirement)
- [ ] No console errors/warnings in latest stable Chrome

**Quality**
- [ ] Backend test suite (pytest + pytest-asyncio)
- [ ] Frontend test suite (Vitest + React Testing Library)
- [ ] E2E tests (Playwright) for critical user paths

### Out of Scope

- Real money / cryptocurrency — reputation-only economy by design
- Mobile native app — web-first, Chrome-compatible
- Spice Points (sp) pairwise bets — Phase 2, post-v1
- Stretch modules (Public API, PWA, advanced search) — time-permitting only
- Email notifications — in-app only for v1

## Context

42 school ft_transcendence project, evaluated by 42 evaluators who run `docker compose up --build` and test features manually. Minimum 14 module points required to pass:

| Module | Pts |
|---|---|
| Frontend (Next.js 15) + Backend (FastAPI) | 2 |
| Real-time (Socket.IO) | 2 |
| User interaction (chat, profiles, friends) | 2 |
| Standard user management | 2 |
| ORM (SQLAlchemy) | 1 |
| Notification system | 1 |
| OAuth 2.0 | 1 |
| LLM interface | 2 |
| i18n (EN, FR, DE) | 1 |
| **Total** | **14** |

Chrome compatibility is a hard requirement (no console errors/warnings). HTTPS everywhere is required. Multi-user simultaneous support required.

All spec details live in:
- `plan/PLANNING.md` — full UX flows, pages, color scheme
- `plan/TECH.md` — stack decisions with rationale
- `plan/ECONOMY.md` — points formulas and edge cases
- `plan/RESOLUTION.md` — resolution tiers and dispute mechanics
- `plan/DATABASE.md` — schema and concurrency model
- `plan/REALTIME.md` — Socket.IO event catalog
- `plan/AUTH.md` — OAuth + JWT flow
- `plan/LLM_INTEGRATION.md` — LLM usage, safety, cost limits
- `plan/TESTING.md` — test strategy
- `plan/PRIVACY.md` — GDPR and data handling
- `plan/SCALING.md` — performance targets
- `plan/DEPLOYMENT.md` — Docker setup and CI

## Constraints

- **Tech stack**: Fixed — Next.js 15, FastAPI, PostgreSQL 16, Redis 7, Socket.IO, Docker Compose (42 module requirements)
- **HTTPS**: Required by 42 spec — Nginx with self-signed cert for development/evaluation
- **Chrome**: Latest stable Chrome must have zero console errors/warnings
- **Single command**: `docker compose up --build` must start everything
- **Package managers**: uv (Python), npm (Node) — no mixing

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Reputation over money | Core differentiator; avoids gambling regulations | — Pending |
| log10 formula for bp cap | Sublinear growth prevents whale dominance | — Pending |
| Ledger-based point tracking | Immutable audit trail, no double-spend | — Pending |
| Socket.IO over raw WebSockets | python-socketio + Redis pub-sub = horizontal scale ready | — Pending |
| OpenRouter for LLM | Single API for multiple models, cost control | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 — Phase 01 (foundation) complete: Docker stack, FastAPI auth API, Next.js frontend scaffold, all running via docker compose up --build*
