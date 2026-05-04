# Transcendence

A 42 school [project](.subject/transcendence_v21.1.md).

---

# Vox Populi

A lightweight prediction market designed to reduce the distortions introduced by money, while preserving incentives for truth-seeking and high-quality discussion.


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


## API Basics

All backend routes are served under `/api` through Nginx.

| Environment | Base URL |
|---|---|
| Local Docker | `https://localhost:8443` |
| Production | `https://voxpo.me` |

FastAPI documentation is available at:

- Swagger UI: `/api/docs`
- ReDoc: `/api/redoc`
- OpenAPI JSON: `/api/openapi.json`

Useful smoke checks:

```bash
# local uses a self-signed certificate
curl -k https://localhost:8443/api/health
curl -k https://localhost:8443/api/public/markets
curl -k https://localhost:8443/api/docs

# production should verify without -k
curl https://voxpo.me/api/health
curl https://voxpo.me/api/public/markets
curl https://voxpo.me/api/docs
```

### Public API

The read-only public API is anonymous and rate-limited to **60 requests per 60 seconds per client IP**. If Redis is unavailable, the limiter logs a warning and allows the request.

Current public endpoints:

- `GET /api/public/markets`
- `GET /api/public/markets/{market_id}`
- `GET /api/public/markets/{market_id}/comments`
- `GET /api/public/markets/{market_id}/positions`
- `GET /api/public/markets/{market_id}/payouts`
- `GET /api/public/users/{username}`
- `GET /api/public/leaderboards`

Example:

```bash
curl https://voxpo.me/api/public/markets
```

Rate-limit check:

```bash
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "$i %{http_code}\n" https://voxpo.me/api/public/markets
done
```

After the limit is exceeded, the API returns `429` with a `Retry-After` header.

### Authenticated API

Protected endpoints use secure HTTP-only cookies set by `/api/auth/login`. Browser requests include these automatically after login. For curl, store and reuse cookies:

```bash
curl -k -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' \
  https://localhost:8443/api/auth/login

curl -k -b cookies.txt https://localhost:8443/api/friends
```

Without a valid auth cookie, protected endpoints return:

```json
{"detail":"Not authenticated"}
```


## Motivation

Money-driven prediction markets have structural flaws: complicated share buying mechanism and liquidity limitations; capital distorts signal, large players can influence outcomes, and disputes over resolution criteria turn toxic when real stakes are involved. Vox fixes this by making **reputation the primary currency**.

## Core Principles

- **Human-only participation**: bots are not allowed.
- **No real money (initially)**: users bet with platform-native points.
- **Earned influence**: points are earned through participation and contributions.
- **Transparent resolution**: outcomes are determined by a mix of automated data and community judgment.


### Bet Types

- **Yes / No** – binary outcome.
- **Multiple choice** – pick one option from a set.
- **Numeric** – predict a number within a defined range.

### How Betting Works

Each position stakes between **1 and 10 BP**.

- **Probabilities** – market probabilities are based on the **number of active votes on each side**, not the total BP staked. A larger stake increases your payout weight if you win, but it does not move the displayed probability on its own.
- **Withdrawal** – a bet can be withdrawn at any time before resolution, but only part of the stake is refunded, depending on the actual winning probability at the time of withdrawal.
- **Winning** – when a market resolves, the total pot is distributed among the winning side. Winners are paid in proportion to their **BP-s staked** on the correct outcome (max 10x return).
- **Truth Points** – winning also grants **TP**, based on how long you spent in the correct position during the lifetime of the market. Getting in early and staying right counts more than switching late.


### Points Economy

| Currency | Name | How You Earn It | Purpose |
|---|---|---|---|
| **❤️** | Like Points | New upvotes on your comments or proposed markets (converted to BP on login) | Measures community contribution |
| **BP** | Betting Points | +10 at signup, +1 daily login, +log2(❤️+1) but max 10 | Currency for placing bets |
| **TP** | Truth Points | for each winning bet: + (t<sub>win</sub> / t<sub>bet</sub>) | Tracks forecasting accuracy |
| **SP** | Spice Points | Winnings from pairwise real-money bets (coming soon) | Skin-in-the-game signal |

- LP balance changes are pushed in real time to the recipient's open sessions when their comments or markets are liked/unliked
- the flat bet cap of max 10 BP prevents any single user from dominating a market regardless of balance
- the TP amount t<sub>win</sub> / t<sub>bet</sub> is the ratio of time in winning position over the total time of the bet (reduces last minute TP farming)


### Bets as Discussions

Every bet doubles as a discussion thread. Anyone can propose a bet and define its terms. Resolution works in three tiers:

1. **Automatic** – pulled from public APIs/data sources ([open-meteo](https://open-meteo.com/) in current implementation).
2. **Bet Proposer** – if the outcome is clear-cut, the proposer can resolve it unilaterally.
3. **Community vote** – if proposer outcome is disputed, a weighted majority vote determines the final resolution.
    - disputing a bet costs 1 BP and a losing dispute costs an additional 1 BP, while a successful dispute rewards 2 BP to the disputing voters
    - at least 10% of the losing participants must vote to trigger a dispute
    - vote weight:
        - 0.5x for users voting for their winning position
        - 2x for users voting against their own position
        - 1x for users who didn't participate in the bet
    - bet proposers wrongly resolving a bet lose half of their staked BP as a penalty (including eventual winning on ongoing bets)


### Who Can Play

Humans only. No bots, no automation. Participation earns points; points unlock larger positions.

## Part 2 – Spice Up Your Bets (coming soon)

Once the platform reaches critical mass (~10k users), optional real-money micro-bets become available:

- **Pairwise bets** between two users within an existing thread. Each party stakes between 1 and 99 cents so the pot always totals **€1**. The winner takes the full euro.
- Pairwise bets **cannot be withdrawn**.
- A pairwise bet resolves when **both parties agree** on the outcome.
- The aggregate of settled pairwise bets produces a **spice flavour** that can factor into disputed thread-level resolutions.
- Spice points are docked for users who resist accepting clear outcomes.
- Only enabled in jurisdictions where gambling is legal.

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

## 42 Module Point Calculation

The ft_transcendence subject v21.1 requires **14 module points**. Major modules count for **2 points** and minor modules count for **1 point**. The table below lists the subject modules that are relevant to Vox Populi's scope and whether this project currently appears to satisfy them.

| Category | Module | Type | Ticked | Counted pts | Evidence / note |
|---|---|---:|:---:|---:|---|
| Web | Use a framework for both frontend and backend | Major | Yes | 2 | Next.js frontend and FastAPI backend. |
| Web | Use a frontend framework | Minor | Yes | 0 | Covered by the major framework module, not counted separately. |
| Web | Use a backend framework | Minor | Yes | 0 | Covered by the major framework module, not counted separately. |
| Web | Real-time features using WebSockets or similar | Major | Yes | 2 | Socket.IO powers live market, balance, chat, friend, and notification updates. |
| Web | User interaction: chat, profiles, friends | Major | Yes | 2 | Direct messages, public profiles, friend requests, friends list, blocking. |
| Web | Public API with API key, rate limiting, docs, and 5+ endpoints | Major | Partial | 1 | The read-only public API has 5+ documented endpoints and rate limiting; it is partial because it is anonymous/read-only rather than API-key-secured with POST/PUT/DELETE coverage. |
| Web | ORM for the database | Minor | Yes | 1 | SQLAlchemy 2 models and Alembic migrations. |
| Web | Complete notification system | Minor | Yes | 1 | Stored notifications, unread counts, mark-read/delete actions, and Socket.IO delivery. |
| Web | Real-time collaborative features | Minor | No | 0 | The app has real-time updates, but not shared editing/workspaces/collaborative drawing. |
| Web | Server-Side Rendering (SSR) | Minor | No | 0 | Next.js is present, but most pages are client components, so this is not claimed. |
| Web | Progressive Web App with offline support | Minor | No | 0 | No service worker, manifest, install flow, or offline mode is present. |
| Web | Custom-made design system with 10+ reusable components | Minor | No | 0 | There are reusable React components, but no documented design-system module is claimed. |
| Web | Advanced search with filters, sorting, pagination | Minor | Yes | 1 | Market list supports query search, description toggle, filters, sorting, and paginated loading. |
| Web | File upload and management system | Minor | No | 0 | Avatar upload exists, but not a general multi-type file management system. |
| Accessibility and Internationalization | Complete WCAG 2.1 AA accessibility compliance | Major | No | 0 | Not audited or documented as complete WCAG AA compliance. |
| Accessibility and Internationalization | Multiple languages, at least 3 | Minor | Yes | 1 | i18n dictionaries exist for English, French, and German with a locale switcher. |
| Accessibility and Internationalization | Right-to-left language support | Minor | No | 0 | No RTL language or mirrored layout support. |
| Accessibility and Internationalization | Additional browser support | Minor | Yes | 1 | Manually tested in Firefox, Opera, Brave, and Edge; all tested flows worked without browser-specific issues. |
| User Management | Standard user management and authentication | Major | Yes | 2 | Secure signup/login, profile pages, profile editing, avatar upload, friends, and online status. |
| User Management | Game statistics and match history | Minor | No | 0 | Vox Populi is not a game project. |
| User Management | Remote authentication with OAuth 2.0 | Minor | Yes | 1 | Google, GitHub, and 42 OAuth 2.0 routes and UI are implemented. |
| User Management | Advanced permissions system | Major | No | 0 | No admin/moderator role CRUD system is present. |
| User Management | Organization system | Major | No | 0 | No organization CRUD or organization membership system. |
| User Management | Two-Factor Authentication | Minor | No | 0 | No 2FA flow is present. |
| User Management | User activity analytics and insights dashboard | Minor | Yes | 1 | Profile pages show the user's full betting history, created markets, positions, transactions, and reputation balances. |
| Artificial Intelligence | AI opponent for games | Major | No | 0 | Vox Populi is not a game project. |
| Artificial Intelligence | Complete RAG system | Major | No | 0 | No retrieval-augmented knowledge base or dataset Q&A system. |
| Artificial Intelligence | Complete LLM system interface | Major | Yes | 2 | OpenRouter and custom provider integration support summaries and resolution hints, with rate limits and budget controls. |
| Artificial Intelligence | Recommendation system using machine learning | Major | No | 0 | No ML recommendation engine is present. |
| Artificial Intelligence | Content moderation AI | Minor | No | 0 | No automatic moderation/deletion/warning pipeline. |
| Artificial Intelligence | Voice/speech integration | Minor | No | 0 | No voice or speech features. |
| Artificial Intelligence | Sentiment analysis | Minor | No | 0 | No sentiment analysis of user content. |
| Artificial Intelligence | Image recognition and tagging | Minor | No | 0 | No image recognition pipeline. |
| Cybersecurity | Hardened WAF/ModSecurity plus HashiCorp Vault | Major | No | 0 | HTTPS/security headers exist, but there is no ModSecurity/WAF plus Vault setup. |
| Devops | ELK log management | Major | No | 0 | No Elasticsearch, Logstash, or Kibana stack. |
| Devops | Prometheus and Grafana monitoring | Major | No | 0 | No Prometheus/Grafana monitoring stack. |
| Devops | Backend as microservices | Major | No | 0 | Backend is a FastAPI service with workers, not split into independently scoped microservices. |
| Devops | Health/status page, automated backups, disaster recovery | Minor | No | 0 | Docker health checks exist, but no complete status page, backup automation, and disaster recovery procedure. |
| Data and Analytics | Advanced analytics dashboard with visualization | Major | No | 0 | No advanced analytics dashboard. |
| Data and Analytics | Data export and import functionality | Minor | No | 0 | GDPR export exists, but not general import/export in multiple formats. |
| Data and Analytics | GDPR compliance features | Minor | Yes | 1 | User data export and account deletion/pseudonymization are implemented. |
| Modules of choice | Custom module: reputation-based prediction market economy and dispute resolution | Major | Yes | 2 | Like/Betting/Truth Points, capped stake influence, automated/proposer/community resolution, disputes, and payout logic are central custom features. |
| Modules of choice | Custom module: responsive web design optimized for mobile | Minor | Yes | 1 | The application is optimized for mobile and desktop layouts and has been manually validated as usable on small screens. |

### Result

| Count | Points |
|---|---:|
| Conservative, non-custom modules | 19 |
| Custom module candidates | +3 |
| **Total claimed in this README** | **22** |
| Required by subject | 14 |
| Buffer above requirement | +8 |

The safer evaluation pitch is to demonstrate the **19 non-custom points first**, because they map directly to explicit subject modules. The custom modules can be presented as an additional buffer if evaluators accept the project-specific prediction-market economy, dispute-resolution engine, and responsive mobile optimization as modules of choice.

See [plan/TECH.md](plan/TECH.md) for module targets and [plan/PLANNING.md](plan/PLANNING.md) for the full project plan (architecture, database schema, API endpoints, deployment).

## Summary

Vox Populi rewards being right over being rich. Reputation is earned, bets are transparent, and the community – not capital – decides what's true.
