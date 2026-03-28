# External Integrations

**Analysis Date:** 2026-03-28

## APIs & External Services

**LLM / AI:**
- OpenRouter API - Market summarization, resolution assistance (planned)
  - SDK/Client: `httpx` async HTTP client (no wrapper file found yet — integration pending)
  - Auth: `OPENROUTER_API_KEY` env var (present in config, defaults to empty string)
  - Budget: `LLM_MONTHLY_BUDGET_USD` (default 20.0 USD) — configured in `backend/app/config.py`

**OAuth 2.0 Providers (model present, routes not yet implemented):**
- Google OAuth 2.0
  - Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - DB model: `OauthAccount` with `provider='google'` (`backend/app/db/models/user.py`)
- GitHub OAuth 2.0
  - Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - DB model: `OauthAccount` with `provider='github'`
- 42 School OAuth 2.0 (intra.42.fr)
  - Env vars: `FT_CLIENT_ID`, `FT_CLIENT_SECRET`
  - DB model: `OauthAccount` with `provider='42'`
  - Note: OAuth route implementation not found in `backend/app/api/routes/auth.py` as of Phase 3

## Data Storage

**Databases:**
- PostgreSQL 16-alpine (primary relational store)
  - Connection: `postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`
  - Client: SQLAlchemy 2 async engine via asyncpg driver (`backend/app/db/session.py`)
  - Env vars: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - Migrations: Alembic, 8 versions in `backend/alembic/versions/`
  - Tables: `users`, `oauth_accounts`, `friend_requests`, `messages`, `notifications`, `bets`, `markets`, `transactions`, `kp_events`

**File Storage:**
- Local filesystem only — no S3 or CDN integration detected
- Avatar URLs stored as plain text in `users.avatar_url` column

**Caching & Session Store:**
- Redis 7-alpine
  - Connection: `redis://redis:6379/0` (via `REDIS_URL`)
  - Client: `redis.asyncio` (lazy-loaded in `backend/app/services/auth_service.py`)
  - Uses:
    - Refresh token storage: `refresh:<token>` keys, 7-day TTL
    - Login rate limiting: `rate:login:<ip>` keys, 5 attempts / 15 min
    - Celery broker and result backend (same Redis instance)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based auth with httpOnly cookie transport
  - Access token: RS256-signed JWT, 5-hour expiry, stored in `access_token` httpOnly cookie (`backend/app/utils/jwt.py`)
  - Refresh token: opaque `secrets.token_urlsafe(64)`, stored in Redis, 7-day TTL
  - Refresh cookie restricted to path `/api/auth/refresh` (reduces XSS exposure)
  - Token rotation on refresh: old token deleted, new pair issued
  - Implementation: `backend/app/api/routes/auth.py`, `backend/app/services/auth_service.py`

**Password Management:**
- bcrypt via passlib — `backend/app/utils/password.py`
- OAuth users have `password_hash=None` (nullable column)

**Frontend Auth:**
- Axios client sends cookies automatically (`withCredentials: true`) — `frontend/src/lib/api.ts`
- Next.js middleware guards protected routes via `access_token` cookie presence — `frontend/src/middleware.ts`
- Auth state in Zustand `useAuthStore` (`frontend/src/store/auth.ts`), bootstrapped via `/api/auth/me`

**Password Reset:**
- HMAC-SHA256 signed token (email + expiry timestamp), 1-hour TTL
- Reset URL delivered via SMTP email (`backend/app/services/email_service.py`)
- Falls back to stdout logging if `smtp_host` is `localhost` (dev mode)

## Email

**Provider:**
- SMTP via `aiosmtplib` — configurable host/port/credentials
  - Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
  - Dev default: `SMTP_HOST=localhost` → logs reset URL to stdout instead of sending
- Implementation: `backend/app/services/email_service.py`
- Current use: password reset emails only

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry or equivalent integrated

**Logs:**
- Backend: Python `logging` module to stdout, captured by Docker
- Frontend: Browser console (must be warning/error free per 42 school requirements)
- Access logs: Nginx default access log format

## CI/CD & Deployment

**Hosting:**
- Docker Compose, self-hosted
- Single command: `docker compose up --build`
- HTTPS on port 8443

**CI Pipeline:**
- None — no GitHub Actions or equivalent configured

## Environment Configuration

**Required env vars (source of truth: `.env.example`):**
```
POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
SECRET_KEY                        # HMAC signing key, must be non-empty
JWT_PRIVATE_KEY_PATH              # path to RS256 private PEM
JWT_PUBLIC_KEY_PATH               # path to RS256 public PEM
OPENROUTER_API_KEY                # optional, defaults to ""
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
FT_CLIENT_ID, FT_CLIENT_SECRET
NEXT_PUBLIC_API_URL               # https://localhost:8443
NEXT_PUBLIC_SOCKET_URL            # https://localhost:8443
ALLOWED_HOSTS                     # comma-separated CORS allowed origins
```

**Secrets location:**
- `.env` file in project root (git-ignored)
- RS256 keys at `backend/keys/` (git-ignored)
- SSL cert/key at `nginx/ssl/` (git-ignored)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback routes planned but not yet implemented

**Outgoing:**
- None detected

## Background Tasks

**Celery Task Queue:**
- Broker: Redis (`redis://redis:6379/0`)
- Result backend: Redis (same instance)
- Worker: `celery` service in `docker-compose.yml`
- Scheduler: `celery-beat` service in `docker-compose.yml`
- Implemented tasks:
  - `app.workers.tasks.daily.daily_allocation` — runs daily at midnight UTC; converts KP to BP for all users (`backend/app/workers/tasks/daily.py`)
  - `ping` — health check task
- Task config: `backend/app/workers/celery_app.py`

## Real-time (WebSocket)

**Current state:**
- `socket.io-client` ^4.0.0 present in `frontend/package.json`
- Nginx configured to proxy `/socket.io/` to `backend:8000`
- No backend Socket.IO server (python-socketio) found in `backend/app/` — real-time not yet implemented
- Notifications currently polled via REST API (`/api/notifications/unread-count`)

---

*Integration audit: 2026-03-28*
