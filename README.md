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

See [plan/TECH.md](plan/TECH.md) for module targets and [plan/PLANNING.md](plan/PLANNING.md) for the full project plan (architecture, database schema, API endpoints, deployment).

## Summary

Vox Populi rewards being right over being rich. Reputation is earned, bets are transparent, and the community – not capital – decides what's true.
