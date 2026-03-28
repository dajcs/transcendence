# Technology Stack

**Analysis Date:** 2026-03-28

## Languages

**Primary:**
- TypeScript 5.x - All frontend code (`frontend/src/`)
- Python 3.12 - All backend code (`backend/app/`)

**Secondary:**
- SQL (via SQLAlchemy/Alembic) - Database schema (`backend/alembic/versions/`)

## Runtime

**Environment:**
- Node.js 20-alpine - Frontend container (`frontend/Dockerfile`)
- Python 3.12-slim - Backend container (`backend/Dockerfile`)

**Package Manager:**
- npm - Node; lockfile `frontend/package-lock.json` present; Docker build uses `npm ci`
- uv - Python; lockfile `backend/uv.lock` present; Docker build uses `uv sync --frozen --no-dev`

## Frameworks

**Core:**
- Next.js ^16.0.0 (App Router) - Frontend framework (`frontend/`)
- React ^19.0.0 - UI library
- FastAPI ^0.115.0 - Backend REST API (`backend/app/main.py`)
- Uvicorn ^0.32.0 [standard] - ASGI server for FastAPI

**State Management:**
- Zustand ^5.0.0 - Client-side state stores (`frontend/src/store/`)
- TanStack React Query ^5.0.0 - Server state and data fetching

**Forms & Validation:**
- react-hook-form ^7.0.0 + @hookform/resolvers ^3.0.0 - Form state
- zod ^4.0.0 - Frontend schema validation
- pydantic ^2.10.0 - Backend schema validation (`backend/app/schemas/`)
- pydantic-settings ^2.6.0 - Environment config (`backend/app/config.py`)

**Styling:**
- Tailwind CSS ^4.0.0 - Utility-first CSS (`frontend/tailwind.config.ts`)
- @tailwindcss/postcss ^4.0.0 - PostCSS integration (`frontend/postcss.config.mjs`)

**ORM & Migrations:**
- SQLAlchemy[asyncio] ^2.0.36 - Async ORM (`backend/app/db/`)
- asyncpg ^0.30.0 - Async PostgreSQL driver
- Alembic ^1.14.0 - Migrations (`backend/alembic/versions/`, 8 migrations as of Phase 3)

**Background Tasks:**
- Celery ^5.4.0 - Task queue (`backend/app/workers/celery_app.py`)
- Celery Beat - Scheduler (daily allocation task, midnight UTC cron)

**Authentication:**
- PyJWT[crypto] ^2.10.0 - RS256 JWT tokens (`backend/app/utils/jwt.py`)
- passlib[bcrypt] ^1.7.4 + bcrypt <4.0.0 - Password hashing (`backend/app/utils/password.py`)

**HTTP Client:**
- axios ^1.0.0 - Frontend HTTP calls, withCredentials for cookies (`frontend/src/lib/api.ts`)
- httpx ^0.28.0 - Backend async HTTP (OAuth callbacks, external APIs)

**Real-time (declared, pending backend implementation):**
- socket.io-client ^4.0.0 - Listed in `frontend/package.json`
- No python-socketio or backend Socket.IO server found as of Phase 3

**Testing (backend only):**
- pytest ^8.3.0 + pytest-asyncio ^0.24.0 - Test runner
- httpx ^0.28.0 - Test HTTP client
- aiosqlite ^0.22.1 - In-memory DB for tests
- fakeredis ^2.34.1 - Redis mock

## Key Dependencies

**Critical:**
- `next` ^16 + `react` ^19 - Frontend rendering
- `fastapi` ^0.115.0 - API layer
- `sqlalchemy[asyncio]` ^2.0.36 - Data persistence
- `PyJWT[crypto]` ^2.10.0 - Auth tokens (RS256 asymmetric signing)
- `redis[asyncio]` ^5.2.0 - Refresh token store, login rate-limiting, Celery broker
- `celery` ^5.4.0 - Daily economy allocation task

**Infrastructure:**
- `aiosmtplib` ^3.0.0 - Email delivery for password reset (`backend/app/services/email_service.py`)
- `python-multipart` ^0.0.18 - Multipart form parsing

## Configuration

**Environment:**
- All runtime config comes from `.env` (loaded via `env_file: .env` in `docker-compose.yml`)
- Backend validates all settings on startup via pydantic-settings `BaseSettings` (`backend/app/config.py`)
- Template at `.env.example` documents all required keys

**Key required env vars:**
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — DB credentials
- `DATABASE_URL`, `REDIS_URL` — injected by Docker Compose (not in `.env`)
- `SECRET_KEY` — HMAC key for password reset tokens; validated non-empty on startup
- `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` — paths to RS256 PEM files
- `OPENROUTER_API_KEY` — LLM API key (optional; defaults to empty string)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` — email
- `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `FT_CLIENT_ID/SECRET` — OAuth (planned Phase 6)
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` — frontend env vars
- `ALLOWED_HOSTS` — comma-separated CORS origins

**Build:**
- `frontend/tsconfig.json` — strict mode, path alias `@/*` → `./src/*`, target ES2017
- `frontend/next.config.ts` — minimal, no custom config
- `frontend/tailwind.config.ts` — scans `src/pages`, `src/components`, `src/app`
- `backend/pyproject.toml` — Black formatter at 88 chars, pytest config

## Platform Requirements

**Development:**
- Docker + Docker Compose
- Self-signed SSL cert at `nginx/ssl/cert.pem` + `nginx/ssl/key.pem` (Nginx HTTPS)
- RS256 key pair at `backend/keys/jwt_private.pem` + `backend/keys/jwt_public.pem`

**Production:**
- Single-command start: `docker compose up --build`
- Services: `db` (Postgres 16-alpine), `redis` (Redis 7-alpine), `backend`, `celery`, `celery-beat`, `frontend`, `nginx`
- HTTPS on port 8443 via Nginx; HSTS + X-Content-Type-Options + X-Frame-Options headers applied
- Nginx routes: `/api/` and `/socket.io/` → `backend:8000`; all else → `frontend:3000`
- Backend runs DB migrations (`alembic upgrade head`) before starting uvicorn

---

*Stack analysis: 2026-03-28*
