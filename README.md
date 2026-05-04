# Transcendence

A 42 school [project](.subject/transcendence_v21.1.md).

---

# Vox Populi

A lightweight prediction market designed to reduce the distortions introduced by money, while preserving incentives for truth-seeking and high-quality discussion.

## Motivation

Money-driven prediction markets have structural flaws: complicated share buying mechanism and liquidity limitations; capital distorts signal, large players can influence outcomes, and disputes over resolution criteria turn toxic when real stakes are involved. Vox fixes this by making **reputation the primary currency**.

## Core Principles

- **Human-only participation**: bots are not allowed.
- **No real money**: users bet with platform-native points.
- **Earned influence**: points are earned through participation and contributions.
- **Transparent resolution**: outcomes are determined by a mix of automated data and community judgment.

Detailed rules and mechanics are outlined in the [Market Mechanics](plan/Market_Mechanics.md).



## Quick Start

```bash
# first time setup:
cp .env.example .env   # fill in secrets
make gen-keys          # Generate SSL cert + RSA key pair for JWT (run once)

# Start all services with hot-reload (docker-compose.override.yml picked up automatically)
make dev               # docker compose up --build

# optional seed data for testing:
make seed               # creates test users, bets, and comments
```

Open [https://localhost:8443](https://localhost:8443) in your browser. Use the seeded test accounts or create a new one.



## Tech Stack

| | Choice |
|---|---|
| **Frontend** | Next.js 15 (React 19) + TypeScript + Tailwind CSS 4 |
| **Backend** | FastAPI (Python 3.12) + SQLAlchemy 2 + Alembic |
| **Database** | PostgreSQL 16 + Redis 7 |
| **Real-time** | Socket.IO (WebSockets) |
| **Auth** | JWT + bcrypt + OAuth 2.0 |
| **LLM** | OpenRouter API (thread summarizer, resolution assistant) |
| **Infra** | Docker Compose + Nginx (HTTPS) |


## Team Roles and Work Distribution

The team uses explicit ownership so every part of the project has a responsible lead, while all members still contribute as developers through implementation, review, testing, and evaluation preparation.

| Role | Team member | Primary responsibilities | Main project areas |
|---|---|---|---|
| Product Owner (PO) | @anemet | Product vision, feature priority, module selection, acceptance criteria, evaluation narrative | Prediction-market rules, point economy, user-facing workflows, README/module justification |
| Project Manager (PM) / Scrum Master | @anmerten | Planning, task breakdown, meeting cadence, risk tracking, integration checkpoints, delivery coordination | Roadmap, sprint organization, issue tracking, testing coordination, release readiness |
| Technical Lead / Architect | @fmick | Architecture, stack decisions, data model, security baseline, critical reviews, technical consistency | FastAPI/Next.js architecture, PostgreSQL schema, Socket.IO design, HTTPS/Docker deployment |
| Developer | @hhuber | Feature implementation, frontend/backend tasks, tests, bug fixes, documentation | Market UI, profiles, chat/friends flows, responsive UI, browser validation |
| Developers | All team members | Every team member implements code, reviews changes, tests features, and can explain the mandatory app and claimed modules | Auth, markets, betting, resolution, real-time updates, i18n, LLM, GDPR, docs |


## Subject Requirement Checklist

| Requirement | Status | Where it is covered |
|---|---|---|
| Web application with frontend, backend, and database | Satisfied | Next.js frontend, FastAPI backend, PostgreSQL database, Redis cache/pub-sub. |
| Single-command containerized deployment | Satisfied | `make dev` runs `docker compose up --build`; production uses Docker Compose plus Nginx. |
| HTTPS backend access | Satisfied | Nginx terminates TLS on `https://localhost:8443` locally and `https://voxpo.me` in production. |
| Latest stable Google Chrome compatibility | Satisfied | Manual validation target; the app is designed to run without browser console errors or warnings. |
| Additional browser compatibility | Claimed module | Manually tested in Firefox, Opera, Brave, and Edge. |
| Privacy Policy and Terms of Service pages | Satisfied | `/privacy` and `/terms`, linked from the public UI and translated through the i18n system. |
| Multi-user simultaneous support | Satisfied | Authenticated sessions, PostgreSQL persistence, Redis, Socket.IO rooms, real-time updates, and concurrent betting/comment flows. |
| Credentials stored in `.env`, with example committed | Satisfied | `.env` is local/git-ignored; `.env.example` documents database, Redis, JWT, OAuth, LLM, and frontend URL settings. |
| Frontend input validation | Satisfied | React Hook Form and Zod validation in auth and form flows. |
| Backend input validation | Satisfied | Pydantic schemas validate auth, market creation, betting, comments, profile updates, and LLM requests. |
| Basic secure user management | Satisfied | Email/username plus password registration and login, bcrypt password hashing, JWT cookies, refresh flow, profile pages. |
| Clear database schema and relations | Satisfied | SQLAlchemy models and Alembic migrations define users, OAuth accounts, markets, positions, comments, disputes, notifications, social graph, and point ledgers. |
| Responsive and accessible frontend | Satisfied | Tailwind responsive layouts, mobile-optimized protected pages, semantic form labels, legal pages, and locale-aware UI text. |
| 14+ module points | Satisfied | The module calculation below claims 22 points, with 19 non-custom points before module-of-choice buffer. |


## Module Targets (22 points)

The subject requires **14 points**. Vox Populi implements **22 points** in total:
**19 non-custom points** plus **3 module-of-choice points**.

| Module | Category | Type | Pts | Evidence |
|---|---|---:|---:|---|
| Frontend + backend frameworks | Web | Major | 2 | Next.js 15 frontend and FastAPI backend. |
| Real-time features | Web | Major | 2 | Socket.IO live updates for markets, balances, chat, friends, and notifications. |
| User interaction: chat, profiles, friends | Web | Major | 2 | Direct messaging, public profiles, friend requests/list, blocking, online status. |
| Public API | Web | Partial major | 1 | 5+ documented read-only endpoints with rate limiting; partial because it is anonymous/read-only rather than API-key secured with POST/PUT/DELETE coverage. |
| ORM | Web | Minor | 1 | SQLAlchemy 2 models and Alembic migrations. |
| Notification system | Web | Minor | 1 | Stored notifications, unread counts, mark-read/delete, Socket.IO delivery. |
| Advanced search | Web | Minor | 1 | Market query search, description search toggle, filters, sorting, and pagination. |
| Multiple languages | Accessibility and Internationalization | Minor | 1 | English, French, and German dictionaries plus locale switching. |
| Additional browser support | Accessibility and Internationalization | Minor | 1 | Manually tested in Firefox, Opera, Brave, and Edge. |
| Standard user management and authentication | User Management | Major | 2 | Signup/login, bcrypt hashing, JWT cookies, profile pages, avatar upload, friends, online status. |
| OAuth 2.0 | User Management | Minor | 1 | Google, GitHub, and 42 OAuth routes and UI. |
| User activity analytics and insights dashboard | User Management | Minor | 1 | Profile pages show betting history, created markets, positions, transactions, and reputation balances. |
| Complete LLM system interface | Artificial Intelligence | Major | 2 | OpenRouter/custom provider integration for summaries and resolution hints, with limits and budget controls. |
| GDPR compliance features | Data and Analytics | Minor | 1 | User data export and account deletion/pseudonymization. |
| Custom prediction-market economy and dispute resolution | Modules of choice | Major | 2 | Like/Betting/Truth Points, capped payouts, auto/proposer/community resolution, disputes, weighted votes. |
| Responsive web design optimized for mobile | Modules of choice | Minor | 1 | Mobile-friendly market, profile, chat, settings, navigation, and legal-page layouts. |
| **Total claimed** | | | **22** | Required: 14; buffer: +8. |



### Custom Modules of Choice Justification

| Custom module | Why we chose it | Technical challenges | Value added | Why it deserves the claimed status |
|---|---|---|---|---|
| Reputation-based prediction market economy and dispute resolution | Vox Populi is not a Pong/game clone; the core idea is a social prediction market where reputation replaces money. | Requires point ledgers, stake caps, payout calculation, market-type validation, automatic/proposer/community resolution paths, dispute thresholds, weighted votes, and real-time balance updates. | Makes the project coherent and original: users can create markets, debate outcomes, bet with earned points, resolve disputes, and build a forecasting reputation. | This is a major custom module because it is central to the product and spans database design, backend services, frontend workflows, scheduled tasks, and real-time events. |
| Responsive web design optimized for mobile | Prediction markets are most useful when users can check odds, comments, and notifications from any device. | Requires protected pages, market cards, navigation, profile views, settings, chat, and legal pages to remain usable across narrow and wide screens. | Mobile usability makes the whole application easier to evaluate and more realistic for daily use. | This is a minor custom module because it adds meaningful user value and required consistent responsive work across the UI, but it is smaller in scope than the custom market economy. |

See [plan/TECH.md](plan/TECH.md) for module targets and [plan/PLANNING.md](plan/PLANNING.md) for the full project plan [plan/DATABASE.md](plan/DATABASE.md) for the database schema, [plan/API.md](plan/API.md) for the API endpoints, [plan/WORKFLOW.md](plan/WORKFLOW.md) for the development workflow, [plan/DEPLOYMENT.md](plan/DEPLOYMENT.md) for the deployment strategy.

## Summary

Vox Populi rewards being right over being rich. Reputation is earned, bets are transparent, and the community – not capital – decides what's true.
