# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vox Populi** — a reputation-based prediction market web application, built as a 42 school ft_transcendence project (v21.0). Users bet with platform-native points (Like Points, Betting Points, Truth Points) instead of real money. Bets double as discussion threads with tiered resolution (automatic, proposer, community vote).

## 42 Project Constraints

- Must be a web app with frontend, backend, and database
- Containerized deployment (Docker) — single command to run
- HTTPS everywhere on backend
- Compatible with latest stable Google Chrome (no console errors/warnings)
- Must include Privacy Policy and Terms of Service pages
- Multi-user simultaneous support required
- Credentials in `.env` (git-ignored), with `.env.example` provided
- Frontend and backend input validation required
- Need 14+ module points to pass (majors = 2pts, minors = 1pt)

## Architecture

- **Frontend**: Next.js 15 (React 19, App Router) + TypeScript + Tailwind CSS 4 + Zustand
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy 2 + Alembic + python-socketio
- **Database**: PostgreSQL 16 + Redis 7
- **Infra**: Docker Compose + Nginx (HTTPS) + Celery (background tasks)
- **LLM**: OpenRouter API (market summarizer, resolution assistant, chat)
- **Auth**: JWT + bcrypt + OAuth 2.0 (Google, GitHub, 42)
- **Package managers**: uv (Python), npm (Node)

See [plan/TECH.md](plan/TECH.md) for module targets and [plan/PLANNING.md](plan/PLANNING.md) for full project plan.

## Module Targets (14 pts)

1. Frontend + Backend frameworks (Next.js + FastAPI) — Major (2)
2. Real-time features (Socket.IO) — Major (2)
3. User interaction (chat, profiles, friends) — Major (2)
4. Standard user management — Major (2)
5. ORM (SQLAlchemy) — Minor (1)
6. Notification system — Minor (1)
7. OAuth 2.0 — Minor (1)
8. LLM interface — Major (2)
9. i18n (EN, FR, DE) — Minor (1)

## Commands

No build/test/lint commands exist yet. Update this section as the project scaffolds.

### Planned commands (once scaffolded)
- `docker compose up --build` — Start all services
- `uv run pytest` — Backend tests
- `npm test` — Frontend tests
- `uv run alembic revision --autogenerate -m "msg"` — New DB migration
- `uv run ruff check .` — Python linting
- `npm run lint` — TypeScript linting
