# Tech Stack

## Frontend

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (React 19, App Router) | SSR + SPA in one, counts as both frontend and backend framework for the 42 module |
| Language | **TypeScript** | Type safety across the stack |
| Styling | **Tailwind CSS 4** | Utility-first, fast iteration |
| Real-time | **Socket.IO client** | Live bet updates, chat, notifications |
| State | **Zustand** | Lightweight, no boilerplate |
| Forms | **React Hook Form + Zod** | Validation shared with backend schemas |

## Backend

| Layer | Choice | Why |
|---|---|---|
| Framework | **FastAPI** (Python 3.12) | Async, WebSocket-native, auto OpenAPI docs |
| Package mgr | **uv** | Fast Python dependency management |
| ORM | **SQLAlchemy 2** + Alembic | Async support, mature migrations |
| Database | **PostgreSQL 16** | JSONB for flexible bet metadata, strong concurrency |
| Cache / Pub-Sub | **Redis 7** | Session store, real-time event bus, rate limiting |
| Auth | **JWT** (access + refresh tokens) + **bcrypt** | Stateless auth with secure password hashing |
| Real-time | **Socket.IO server** (python-socketio) | Scalable WebSocket layer, rooms for bet threads |
| Task queue | **Celery + Redis** | Bet resolution scheduling, API data polling |

## Infrastructure

| Layer | Choice | Why |
|---|---|---|
| Containers | **Docker Compose** | Single `docker compose up` to run everything (with rootless docker)|
| Reverse proxy | **Nginx** | HTTPS termination, static file serving |
| Secrets | `.env` file (git-ignored) | 42 requirement; `.env.example` committed |

## Module Targets (14+ points)

| Module | Type | Pts |
|---|---|---|
| Frontend + Backend frameworks (Next.js + FastAPI) | Major | 2 |
| Real-time features (WebSockets / Socket.IO) | Major | 2 |
| User interaction (chat, profiles, friends) | Major | 2 |
| Standard user management (profile, avatar, friends, online status) | Major | 2 |
| ORM (SQLAlchemy) | Minor | 1 |
| Notification system | Minor | 1 |
| OAuth 2.0 (Google / GitHub / 42) | Minor | 1 |
| LLM interface (bet resolution assistant, market summariser) | Major | 2 |
| i18n - 3 languages (EN, FR, DE) | Minor | 1 |
| **Total** | | **14** |

### Stretch modules (bonus, up to +5)

| Module | Type | Pts |
|---|---|---|
| Public API (5+ endpoints, rate-limited, documented) | Major | 2 |
| GDPR compliance (data export/delete) | Minor | 1 |
| Advanced search (filters, sorting, pagination) | Minor | 1 |
| PWA with offline support | Minor | 1 |
