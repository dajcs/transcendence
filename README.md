# Transcendence

A 42 school [project](.subject/transcendence_v21.0.md).

---

# Vox Populi

A lightweight prediction market designed to reduce the distortions introduced by money, while preserving incentives for truth-seeking and high-quality discussion.

## Motivation

Money-driven prediction markets have structural flaws: capital distorts signal, large players can influence outcomes, and disputes over resolution criteria turn toxic when real stakes are involved. Vox fixes this by making **reputation the primary currency**.

## Core Principles

- **Human-only participation**: bots are not allowed.
- **No real money (initially)**: users bet with platform-native points.
- **Earned influence**: points are earned through participation and contributions.
- **Transparent resolution**: outcomes are determined by a mix of automated data and community judgment.

### Points Economy

| Currency | How you earn it | What it does |
|---|---|---|
| **Karma** | Upvotes on comments and contributions | Gates your maximum bet size (log scale) |
| **Truth** | Winning bets | Measures forecasting track record |
| **Spice** | Settled pairwise real-money bets (Phase 2) | Adds skin-in-the-game flavour |

The log-scale bet cap (`max position = log(karma)`) prevents any single user from dominating a market regardless of how active they are.

### Bets as Discussions

Every bet doubles as a discussion thread. Anyone can propose a bet and define its terms. Resolution works in three tiers:

1. **Automatic** – pulled from public APIs/data sources whenever possible.
2. **Bet Proposer** – if the outcome is clear-cut, the proposer can resolve it unilaterally.
3. **Community vote** – if proposer outcome is disputed, a weighted majority vote determines the final resolution.

### Who Can Play

Humans only. No bots, no automation. Participation earns points; points unlock larger positions.

## Phase 2 – Spice

Once the platform reaches critical mass (~10k users), optional real-money micro-bets become available:

- **Pairwise bets** of max €1 between two users within an existing thread.
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
| **LLM** | OpenRouter API (market summarizer, resolution assistant) |
| **Infra** | Docker Compose + Nginx (HTTPS) |

See [plan/TECH.md](plan/TECH.md) for module targets and [plan/PLANNING.md](plan/PLANNING.md) for the full project plan (architecture, database schema, API endpoints, deployment).

## Quick Start

```bash
cp .env.example .env   # fill in secrets
docker compose up --build
```

Open `https://localhost:8443` in Google Chrome.

## Summary

Vox Populi rewards being right over being rich. Reputation is earned, bets are transparent, and the community – not capital – decides what's true.
