# Transcendence

A 42 school [project](.subject/transcendence_v21.0.md).

---

# Vox Populi

A lightweight prediction market designed to reduce the distortions introduced by money, while preserving incentives for truth-seeking and high-quality discussion.


## Quick Start

```bash
# first time setup:
cp .env.example .env   # fill in secrets
make gen-keys          # Generate SSL cert + RSA key pair for JWT (run once)

# optional seed data for testing:
make seed               # creates test users, bets, and comments

# Start all services with hot-reload (docker-compose.override.yml picked up automatically)
make dev               # docker compose up --build
```

Open [https://localhost:8443](https://localhost:8443) in your browser. Use the seeded test accounts or create a new one.


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

Every vote costs **1 bp**. Probabilities are refreshed continuously as votes come in.

- **Withdrawal** – a bet can be withdrawn at any time, but only a fraction is reimbursed: the current winning probability of the position (e.g. a position with 10 % winning probability returns 0.1 bp).
- **Winning** – a correct bet pays **+1 bp** and **tp** (between 0 and 1).


### Points Economy

| Currency | Name | How You Earn It | Purpose |
|---|---|---|---|
| **kp** | Karma Points | New upvotes on your comments or proposed bets (resets daily) | Measures community contribution |
| **bp** | Betting Points | +10 at signup, +1 daily login, +log(kp) daily, +1 to vote on your own bet | Currency for placing bets |
| **tp** | Truth Points | for each winning bet: + (t<sub>win</sub> / t<sub>bet</sub>) | Tracks forecasting accuracy |
| **sp** | Spice Points | Winnings from pairwise real-money bets (Part 2) | Skin-in-the-game signal |

- the log-scale bet cap log(kp) prevents any single user from dominating a market regardless of how active they are
- the tp amount t<sub>win</sub> / t<sub>bet</sub> is the ratio of time in winning position over the total time of the bet (reduces last minute tp farming)


### Bets as Discussions

Every bet doubles as a discussion thread. Anyone can propose a bet and define its terms. Resolution works in three tiers:

1. **Automatic** – pulled from public APIs/data sources whenever possible.
2. **Bet Proposer** – if the outcome is clear-cut, the proposer can resolve it unilaterally.
3. **Community vote** – if proposer outcome is disputed, a weighted majority vote determines the final resolution.
    - disputing a bet costs 1 bp and a losing dispute costs an additional 1 bp, while a successful dispute rewards 2 bp to the disputing voters
    - at least 1% of the participants must vote in the dispute for it to be valid
    - vote weight:
        - 0.5x for users voting for their winning position
        - 2x for users voting against their own position
        - 1x for users who didn't participate in the bet
    - bet proposers wrongly resolving a bet lose half of their staked bp as a penalty (including eventual winning on ongoing bets)


### Who Can Play

Humans only. No bots, no automation. Participation earns points; points unlock larger positions.

## Part 2 – Spice

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
