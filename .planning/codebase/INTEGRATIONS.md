# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**LLM / AI:**
- **OpenRouter API** - Market summarization, resolution assistance, chat support
  - SDK/Client: `httpx` async HTTP client (custom wrapper at `backend/app/utils/openrouter.py`)
  - Auth: `OPENROUTER_API_KEY` environment variable
  - Base URL: `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
  - Model: Configurable via `OPENROUTER_MODEL` (default: `anthropic/claude-sonnet-4`)

**OAuth 2.0 Providers:**
- **Google OAuth 2.0**
  - Client ID: `OAUTH_GOOGLE_CLIENT_ID`
  - Client Secret: `OAUTH_GOOGLE_CLIENT_SECRET`
  - Implementation: `backend/app/utils/security.py` (JWT + OAuth logic)

- **GitHub OAuth 2.0**
  - Client ID: `OAUTH_GITHUB_CLIENT_ID`
  - Client Secret: `OAUTH_GITHUB_CLIENT_SECRET`
  - Implementation: `backend/app/utils/security.py`

- **42 School OAuth 2.0** (intra.42.fr)
  - Client ID: `OAUTH_42_CLIENT_ID`
  - Client Secret: `OAUTH_42_CLIENT_SECRET`
  - Implementation: `backend/app/utils/security.py`

## Data Storage

**Databases:**
- **PostgreSQL 16** (Primary)
  - Connection: `postgresql+asyncpg://voxpopuli:changeme@db:5432/voxpopuli` (via `DATABASE_URL`)
  - ORM: SQLAlchemy 2 with asyncpg driver
  - Credentials: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` env vars
  - Models located in: `backend/app/models/` (user.py, market.py, bet.py, comment.py, friendship.py, notification.py, chat.py)

**File Storage:**
- **Local filesystem only** - User avatars and profile images served from frontend public directory
  - Frontend public path: `frontend/public/avatars/` (example structure, to be implemented)

**Caching & Session Store:**
- **Redis 7**
  - Connection: `redis://redis:6379/0` (via `REDIS_URL`)
  - Client: `redis-py` async client
  - Uses:
    - Session/token caching (expired tokens, user sessions)
    - Socket.IO adapter (pub/sub for WebSocket message broadcasting)
    - Rate limiting bucket storage
    - Celery message broker (task queue)
  - Configuration in `backend/app/config.py`

## Authentication & Identity

**Auth Provider:**
- **Custom JWT-based authentication** with OAuth 2.0 support
  - Implementation: `backend/app/utils/security.py`
  - Token types: Access tokens (short-lived) + Refresh tokens (long-lived)
  - Expiration: `ACCESS_TOKEN_EXPIRE_MINUTES` and `REFRESH_TOKEN_EXPIRE_DAYS`
  - Secret key: `SECRET_KEY` environment variable (should be a long random string)

**Password Management:**
- **bcrypt** + **passlib** for secure password hashing
  - Used for email/password signup and login
  - Optional for OAuth users (no password hash if OAuth-authenticated)

**Frontend Auth Flow:**
- JWT tokens stored in browser (typically httpOnly cookies or localStorage)
- Tokens sent with each API request via `Authorization: Bearer <token>` header
- Socket.IO authentication via JWT handshake

## Monitoring & Observability

**Error Tracking:**
- Not currently integrated (no Sentry, Rollbar, etc.)

**Logs:**
- Backend: Standard FastAPI logging to stdout (captured by Docker)
- Frontend: Browser console logs (must be clean for Chrome compatibility per 42 requirements)
- Approach: Docker container logs via `docker logs <container>`

## CI/CD & Deployment

**Hosting:**
- **Docker Compose** (local/self-hosted)
- Single command deployment: `docker compose up --build`
- HTTPS via Nginx reverse proxy on port `:8443`

**CI Pipeline:**
- Not yet implemented
- Planned: GitHub Actions for testing, linting (backend: `ruff check`, pytest; frontend: `npm run lint`, test)

## Environment Configuration

**Required env vars (see `.env.example` in root):**

Backend configuration:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Database credentials
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql+asyncpg://user:pass@db:5432/dbname`)
- `REDIS_URL` - Redis connection (e.g., `redis://redis:6379/0`)
- `SECRET_KEY` - JWT signing key (generate with `openssl rand -hex 32`)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT access token lifetime (e.g., 30)
- `REFRESH_TOKEN_EXPIRE_DAYS` - Refresh token lifetime (e.g., 7)
- `BACKEND_CORS_ORIGINS` - Allowed origins (e.g., `https://localhost:8443`)

OAuth configuration:
- `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`
- `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`
- `OAUTH_42_CLIENT_ID`, `OAUTH_42_CLIENT_SECRET`

LLM configuration:
- `OPENROUTER_API_KEY` - API key for OpenRouter
- `OPENROUTER_BASE_URL` - Defaults to `https://openrouter.ai/api/v1`
- `OPENROUTER_MODEL` - Model identifier (e.g., `anthropic/claude-sonnet-4`)

Frontend configuration:
- `NEXT_PUBLIC_API_URL` - Backend API endpoint (e.g., `https://localhost:8443/api`)
- `NEXT_PUBLIC_WS_URL` - WebSocket endpoint (e.g., `wss://localhost:8443`)

Nginx configuration:
- `DOMAIN` - Hostname for SSL certificate generation (e.g., `localhost`)

**Secrets location:**
- `.env` file in project root (git-ignored)
- Must be manually created from `.env.example` template
- Secrets are NOT committed to repository

## Webhooks & Callbacks

**Incoming:**
- **None detected** - Platform does not currently receive webhooks from external services

**Outgoing:**
- **None detected** - Background task execution handled internally via Celery

**Future possibilities (Phase 2):**
- Real-money transaction webhooks (when Spice payments are integrated)
- External data API polling for automatic bet resolution (sports scores, weather, etc.)

## WebSocket / Real-time Communication

**Socket.IO Integration:**
- Server: `python-socketio` on FastAPI (mounted on same ASGI app)
- Client: `socket.io-client` in Next.js frontend
- Events defined in: `backend/app/socket/events.py`
- Manager: `backend/app/socket/manager.py`
- Adapter: Redis (for multi-instance broadcasting)
- Connection endpoints: WebSocket via Nginx proxy at `/socket.io/`

**Real-time Features:**
- Live bet probability updates across users
- Chat message delivery
- Notification broadcasts
- Market resolution status updates
- User online/offline status

## Task Queue

**Background Job Processing:**
- Framework: **Celery** (Python distributed task queue)
- Broker: **Redis** (message queue)
- Worker: `celery -A app.tasks worker` (runs background tasks)
- Tasks: `backend/app/tasks/` (resolution scheduling, notifications, API polling)

---

*Integration audit: 2026-03-24*
