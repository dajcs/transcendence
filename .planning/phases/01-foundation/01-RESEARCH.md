# Phase 1: Foundation - Research

**Researched:** 2026-03-24
**Domain:** Docker Compose full-stack bootstrapping, FastAPI + SQLAlchemy 2 + Alembic, Next.js 15 App Router, JWT httpOnly cookie auth
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single `docker-compose.yml` is the eval-ready setup. `docker-compose.override.yml` adds hot-reload volume mounts for dev — picked up automatically by `docker compose up`, transparent to evaluators.
- **D-02:** Both backend (uvicorn --reload) and frontend (next dev) hot-reload in the override.
- **D-03:** Nginx stays in the loop even in dev — same HTTPS routing as eval. Catches SSL/proxy issues early.
- **D-04:** Makefile for common dev commands: `make dev`, `make test`, `make migrate`, `make seed`, `make logs`.
- **D-05:** Alembic migrations run automatically on backend startup (`alembic upgrade head` in entrypoint before uvicorn).
- **D-06:** Rootless Docker: document notes only (README). No non-root user setup in Dockerfiles.
- **D-07:** PostgreSQL data in named Docker volume (`postgres_data`). Wipe with `docker volume rm`.
- **D-08:** JWT tokens (access + refresh) stored in httpOnly cookies — XSS-proof, SameSite=Strict for CSRF protection.
- **D-09:** Zustand auth store holds `{user, isAuthenticated}` only — no tokens in JS. Auth state bootstrapped via `GET /api/auth/me` on app load.
- **D-10:** Phase 1 frontend includes: login page, register page, password reset page, minimal top nav (logo + login/logout button), route guards for protected pages, placeholder routing for future pages.
- **D-11:** Minimal landing page at `/` — brief pitch (what Vox Populi is, CTA to sign up). Gives evaluators context.
- **D-12:** Styling: functional with Tailwind utilities for layout and basic readability. Not polished — visual design in Phase 2+.
- **D-13:** One big initial migration: `001_initial_schema.py` creates ALL tables from DATABASE.md at once. Backend code only uses auth tables in Phase 1, but full schema is ready.
- **D-14:** Dev seed script: `scripts/seed_dev.py` creates test users (e.g., alice, bob with starting points). Run via `make seed`.

### Claude's Discretion

- Exact Dockerfile layer ordering and .dockerignore optimization
- Nginx SSL cipher configuration details
- Specific Tailwind classes and spacing for auth pages
- Alembic migration file naming beyond `001_initial_schema`
- JWT access token expiry (AUTH.md says short-lived; exact duration Claude decides)

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within Phase 1 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Single `docker compose up --build` starts all services | Docker Compose v5, healthcheck depends_on, service ordering |
| INFRA-02 | HTTPS on all endpoints via Nginx + self-signed cert | openssl req -x509, Nginx ssl_certificate, HSTS header |
| INFRA-03 | PostgreSQL 16 + Redis 7 running in containers | postgres:16-alpine, redis:7-alpine, named volumes |
| INFRA-04 | Secrets via `.env` (git-ignored); `.env.example` committed | Docker Compose env_file, .gitignore pattern |
| INFRA-05 | App validates required env vars at startup; fails loudly if missing | FastAPI lifespan startup hook, sys.exit(1) pattern |
| AUTH-01 | User can register with email and password | bcrypt cost=12, pydantic email validation, unique constraint |
| AUTH-02 | User can log in and receive JWT access + refresh tokens | PyJWT RS256 access / HS256 refresh, httpOnly cookie Set-Cookie |
| AUTH-03 | User can reset password via email link | HMAC-SHA256 signed token, aiosmtplib, 1-hour TTL |
| AUTH-04 | User session persists across browser refresh (refresh token rotation) | Redis-backed refresh token, rotate-on-use, `/api/auth/me` bootstrap |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield bootstrapping phase with no prior code to integrate. The entire codebase is created from scratch. The stack is fully decided in CONTEXT.md and the plan docs — research confirms current versions and identifies setup pitfalls specific to this stack combination.

The most important integration points to get right are: (1) SQLAlchemy 2 async engine with asyncpg, using the `async_sessionmaker` pattern rather than the legacy `Session` pattern; (2) Next.js 15 App Router middleware for cookie-based auth using `cookies()` from `next/headers`; (3) Docker Compose healthcheck ordering to avoid race conditions where backend starts before PostgreSQL is ready; (4) Nginx proxying WebSocket upgrades from day one, even though WebSockets are used only in later phases.

The `python-jose` library has known CVEs and is effectively unmaintained. The plan should use `PyJWT` instead — it is actively maintained, supports RS256, and has no outstanding CVEs.

**Primary recommendation:** Use PyJWT (not python-jose) for JWT. Use asyncpg as the SQLAlchemy 2 async driver. Wire Docker healthchecks before any other service dependency.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 | Frontend framework (App Router) | Locked by project; React 19, SSR + SPA |
| react | 19.2.4 | UI rendering | Locked by project |
| tailwindcss | 4.2.2 | Utility CSS | Locked by project |
| zustand | 5.0.12 | Frontend state | Locked by project |
| react-hook-form | 7.72.0 | Form management | Locked by project |
| zod | 4.3.6 | Schema validation (shared) | Locked by project |
| fastapi | 0.135.2 | Backend API framework | Locked by project |
| uvicorn | 0.42.0 | ASGI server | Standard FastAPI server |
| sqlalchemy | 2.0.48 | ORM + async sessions | Locked by project |
| alembic | 1.18.4 | Database migrations | Locked by project |
| pydantic | 2.12.5 | FastAPI request/response models | Built-in with FastAPI |
| asyncpg | 0.31.0 | Async PostgreSQL driver | Required for SQLAlchemy 2 async |
| PyJWT | 2.x (see note) | JWT access + refresh tokens | See security note below |
| passlib[bcrypt] | 1.7.4 | bcrypt password hashing | Standard; bcrypt cost=12 as specified |
| aiosmtplib | 5.1.0 | Async email for password reset | Async-native, no sync blocking |
| httpx | 0.28.1 | HTTP client (OAuth token exchange) | Async-first, replaces requests |
| python-multipart | 0.0.22 | FastAPI form parsing | Required for OAuth form posts |
| celery | 5.6.2 | Background task queue | Locked by project |
| redis-py (async) | 5.x | Redis client (rate limiting, token store) | `redis[asyncio]` for async FastAPI |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| socket.io-client | 4.8.3 | WebSocket client | Phase 4; declare dependency in Phase 1 |
| @tanstack/react-query | 5.95.2 | Server state caching | Useful from Phase 2 onwards |
| axios | 1.13.6 | HTTP client (frontend) | Fetch wrapper with interceptors for cookie refresh |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | python-jose | python-jose has known CVEs (GHSA-cjwg-qfpm-7377, others); PyJWT is actively maintained |
| asyncpg | psycopg3 | Both work; asyncpg is faster for pure-async; psycopg3 supports both sync/async; asyncpg is the de-facto default for SQLAlchemy 2 async |
| passlib | bcrypt directly | passlib wraps bcrypt with a cleaner API; deprecation warnings on Python 3.13+ (suppress with `PYTHONWARNINGS`) |

**Security note on python-jose:** Do not use. It has multiple unfixed CVEs related to algorithm confusion attacks. PyJWT 2.x with explicit `algorithms=["RS256"]` is the correct choice for 2026.

**Installation (backend):**
```bash
uv add fastapi uvicorn[standard] sqlalchemy[asyncio] alembic asyncpg pydantic \
       PyJWT passlib[bcrypt] aiosmtplib httpx python-multipart celery "redis[asyncio]"
```

**Installation (frontend):**
```bash
npm install next@latest react@latest react-dom@latest
npm install tailwindcss@latest @tailwindcss/postcss
npm install zustand react-hook-form zod
npm install socket.io-client axios @tanstack/react-query
npm install -D typescript @types/react @types/node
```

**Version verification:** All versions above verified via `npm view` and `uv run pip index versions` on 2026-03-24.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan hook
│   ├── config.py            # Settings (pydantic-settings, validates env vars)
│   ├── db/
│   │   ├── session.py       # async_engine, async_sessionmaker
│   │   ├── base.py          # DeclarativeBase
│   │   └── models/          # one file per domain (user.py, bet.py, …)
│   ├── api/
│   │   ├── deps.py          # get_db, get_current_user dependencies
│   │   └── routes/
│   │       └── auth.py      # /auth/register, /auth/login, /auth/me, /auth/refresh, /auth/logout
│   ├── schemas/             # Pydantic request/response models
│   ├── services/            # business logic (auth_service.py, email_service.py)
│   └── workers/             # Celery app + tasks
├── alembic/
│   ├── env.py               # async migration runner
│   └── versions/
│       └── 001_initial_schema.py
├── scripts/
│   └── seed_dev.py
├── pyproject.toml
└── Dockerfile

frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # root layout, Zustand provider
│   │   ├── page.tsx         # landing page (/)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   └── (protected)/     # route group — needs middleware guard
│   ├── components/
│   │   ├── nav/TopNav.tsx
│   │   └── auth/            # LoginForm, RegisterForm, ResetForm
│   ├── store/
│   │   └── auth.ts          # Zustand: { user, isAuthenticated }
│   ├── lib/
│   │   ├── api.ts           # axios instance with baseURL + credentials
│   │   └── auth.ts          # bootstrapAuth() calls /api/auth/me
│   └── middleware.ts        # Next.js edge middleware for route guards
├── package.json
└── Dockerfile

nginx/
├── nginx.conf
└── ssl/
    ├── cert.pem             # generated, git-ignored
    └── key.pem              # generated, git-ignored

docker-compose.yml
docker-compose.override.yml
.env.example
Makefile
```

### Pattern 1: SQLAlchemy 2 Async Session

**What:** Use `async_sessionmaker` with `AsyncSession`, injected via FastAPI dependency.
**When to use:** All database access in FastAPI route handlers.

```python
# Source: SQLAlchemy 2 docs — https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine("postgresql+asyncpg://...", pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

### Pattern 2: FastAPI Lifespan for Startup Validation

**What:** Use the `lifespan` context manager (not deprecated `on_event`) for startup.
**When to use:** Env var validation + Alembic migration run.

```python
# Source: FastAPI docs — https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate env vars (fail loud)
    validate_config()
    # Run migrations
    await run_alembic_upgrade()
    yield
    # Cleanup on shutdown (close DB pool)
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

### Pattern 3: JWT httpOnly Cookie Auth

**What:** Access token (RS256, 15 min) + refresh token (HS256, 7 days) both in httpOnly cookies. No tokens in JS state.
**When to use:** All auth endpoints.

```python
# Source: FastAPI docs on Response/Cookie
from fastapi import Response

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,          # HTTPS only
        samesite="strict",
        max_age=900,          # 15 minutes
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=604800,       # 7 days
        path="/api/auth/refresh",  # restrict refresh token to refresh endpoint
    )
```

### Pattern 4: Next.js 15 App Router Middleware Route Guard

**What:** Edge middleware reads the `access_token` cookie and redirects unauthenticated users.
**When to use:** Protecting all routes under `/(protected)/`.

```typescript
// Source: Next.js docs — https://nextjs.org/docs/app/building-your-application/routing/middleware
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/markets/:path*'],
}
```

### Pattern 5: Alembic Async env.py

**What:** Alembic's `env.py` must use async engine when the app uses SQLAlchemy async.
**When to use:** Required for `alembic upgrade head` to work with asyncpg.

```python
# Standard async env.py pattern for Alembic
from sqlalchemy.ext.asyncio import async_engine_from_config
import asyncio

def run_async_migrations():
    connectable = async_engine_from_config(config.get_section(config.config_ini_section))
    async def run(connection):
        await connection.run_sync(do_run_migrations)
    asyncio.run(run(connectable))
```

### Anti-Patterns to Avoid

- **Sync SQLAlchemy in async FastAPI:** Using `Session` (sync) inside an async handler blocks the event loop. Always use `AsyncSession` with `async_sessionmaker`.
- **python-jose for JWT:** Has known CVEs. Use PyJWT.
- **Storing tokens in localStorage or Zustand:** Violates D-08. Cookies only.
- **Missing `path=` on refresh token cookie:** Without restricting the refresh token cookie to `/api/auth/refresh`, it gets sent on every request, expanding the attack surface.
- **Alembic autogenerate without importing models:** `env.py` must import all model modules so Alembic can detect the full schema. The `target_metadata = Base.metadata` line is useless if model files are not imported.
- **Not running `pg_isready` healthcheck before backend starts:** Without `depends_on: condition: service_healthy`, the backend container starts before PostgreSQL accepts connections, causing startup crash.
- **`next dev` in production Dockerfile:** The production Dockerfile must use `npm run build && npm start`, not `next dev`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | passlib[bcrypt] cost=12 | bcrypt includes salt, timing-safe comparison |
| JWT signing/verification | Manual HMAC or custom encode | PyJWT with explicit algorithms= | Algorithm confusion attacks if not constrained |
| Rate limiting | In-memory dict | Redis counter with INCR + EXPIRE | Survives restarts; works across multiple workers |
| Email SMTP | smtplib sync | aiosmtplib | Async-native; avoids blocking event loop |
| Env var validation | `os.getenv()` with manual checks | pydantic-settings `BaseSettings` | Declarative, type-coerced, fails loudly at startup |
| DB connection pooling | Manual pool | SQLAlchemy pool_pre_ping=True | Handles stale connections transparently |
| PKCE code challenge | Custom base64url + SHA256 | hashlib + base64 (stdlib) | PKCE is simple enough; no dedicated library needed |

**Key insight:** Auth and crypto primitives are where hand-rolling causes the most damage. Use battle-tested libraries for everything security-related.

---

## Common Pitfalls

### Pitfall 1: Alembic autogenerate produces empty migration
**What goes wrong:** `alembic revision --autogenerate` generates a migration with no operations.
**Why it happens:** Model files are not imported in `alembic/env.py` before `target_metadata = Base.metadata`, so Alembic sees an empty schema.
**How to avoid:** Add explicit imports of all model modules in `env.py`: `from app.db.models import user, bet, ...`
**Warning signs:** Migration file shows `def upgrade(): pass` and `def downgrade(): pass`.

### Pitfall 2: Docker healthcheck race condition
**What goes wrong:** Backend container crashes at startup with "could not connect to PostgreSQL".
**Why it happens:** Docker starts services in dependency order but does not wait for them to be *ready*, only *running* — unless `condition: service_healthy` is used.
**How to avoid:** Add a proper healthcheck to the `db` service using `pg_isready`, then use `depends_on: db: condition: service_healthy` on the backend.
**Warning signs:** First `docker compose up` fails; second attempt works (PostgreSQL warmed up).

### Pitfall 3: Nginx HTTPS with self-signed cert breaks frontend fetch
**What goes wrong:** Next.js SSR routes calling the backend over `https://nginx:8443` from inside Docker fail with a certificate error.
**Why it happens:** Node.js rejects self-signed certs by default.
**How to avoid:** Set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the frontend service environment (dev only), OR configure the backend URL to go through Nginx only for browser requests and use `http://backend:8000` for internal SSR calls.
**Warning signs:** 500 errors on SSR pages; client-side fetch works fine.

### Pitfall 4: SameSite=Strict blocks OAuth callback cookies
**What goes wrong:** After OAuth redirect back to the app, the session cookie is not sent, and the user appears unauthenticated.
**Why it happens:** `SameSite=Strict` prevents cookies from being sent on cross-site navigations, including OAuth redirects.
**How to avoid:** Use `SameSite=Lax` for the access token cookie. The refresh token can remain Strict since it is not involved in redirects. (This is relevant in Phase 6 for OAuth, but the cookie policy must be set correctly now.)
**Warning signs:** Login works but OAuth flow leaves user logged out after callback.

### Pitfall 5: Celery worker cannot find app module
**What goes wrong:** Celery worker exits with `ModuleNotFoundError`.
**Why it happens:** The Celery worker container shares the backend image but runs from a different working directory or with a different command, missing the Python path.
**How to avoid:** Define the Celery worker service in docker-compose with `command: uv run celery -A app.workers.celery_app worker` and the same `WORKDIR /app` as the backend. Ensure `pyproject.toml` makes the `app` package importable.
**Warning signs:** `docker compose logs celery` shows import errors immediately on startup.

### Pitfall 6: Next.js 15 App Router — `cookies()` is async
**What goes wrong:** `cookies().get('access_token')` throws a type error or returns undefined.
**Why it happens:** In Next.js 15, `cookies()` from `next/headers` returns a Promise and must be awaited.
**How to avoid:** `const cookieStore = await cookies(); cookieStore.get('access_token')`.
**Warning signs:** Server component compiles but auth check silently returns null.

---

## Code Examples

### FastAPI pydantic-settings for env var validation (INFRA-05)
```python
# Source: Pydantic docs — https://docs.pydantic.dev/latest/concepts/pydantic_settings/
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    postgres_db: str
    postgres_user: str
    postgres_password: str
    redis_url: str
    secret_key: str
    jwt_private_key_path: str
    jwt_public_key_path: str
    openrouter_api_key: str
    google_client_id: str
    github_client_id: str
    ft_client_id: str

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

settings = Settings()  # Raises ValidationError at import time if vars missing
```

### PyJWT RS256 token generation (AUTH-02)
```python
# Source: PyJWT docs — https://pyjwt.readthedocs.io/en/stable/usage.html
import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str, email: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    with open(settings.jwt_private_key_path, "rb") as f:
        private_key = f.read()
    return jwt.encode(payload, private_key, algorithm="RS256")

def decode_access_token(token: str) -> dict:
    with open(settings.jwt_public_key_path, "rb") as f:
        public_key = f.read()
    return jwt.decode(token, public_key, algorithms=["RS256"])
    # algorithms= list is REQUIRED — prevents algorithm confusion attacks
```

### Docker Compose healthcheck + depends_on (INFRA-01, INFRA-03)
```yaml
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    entrypoint: ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### Zustand auth store with bootstrap (D-09)
```typescript
// src/store/auth.ts
import { create } from 'zustand'
import { api } from '@/lib/api'

interface User { id: string; email: string; username: string; avatar_url: string | null }
interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  bootstrap: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  bootstrap: async () => {
    try {
      const { data } = await api.get<User>('/api/auth/me')
      set({ user: data, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
    }
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `on_event("startup")` FastAPI | `lifespan` context manager | FastAPI 0.93 | `on_event` deprecated; lifespan is the standard |
| SQLAlchemy Session (sync) | AsyncSession + async_sessionmaker | SQLAlchemy 2.0 | sync session blocks event loop in async app |
| python-jose | PyJWT | python-jose abandoned ~2023 | CVEs unfixed; PyJWT is the maintained alternative |
| Next.js `cookies()` sync | `await cookies()` async | Next.js 15 | Failing to await causes silent auth failures |
| `next-auth` v4 | `next-auth` v5 (Auth.js) | 2024 | v5 supports App Router; v4 does not |
| Pydantic v1 BaseModel | Pydantic v2 BaseModel | 2023 | Different validator API; `@validator` → `@field_validator` |
| Tailwind CSS `@apply` heavy | Tailwind CSS 4 direct utility classes | Tailwind 4 | `@apply` is discouraged in v4; write classes inline |

**Deprecated/outdated:**
- `python-jose`: Do not use. CVE-2024-33663 and others. Use PyJWT.
- `next-auth` v4: Does not support Next.js 15 App Router properly. If auth middleware is needed beyond simple cookie check, use Auth.js v5 (but Phase 1 does not need it — manual JWT cookie pattern is sufficient).
- `passlib` with Python 3.13: Emits deprecation warnings from the `crypt` module. Suppress with `PYTHONWARNINGS=ignore::DeprecationWarning` or pin Python 3.12 (already pinned in this project).

---

## Open Questions

1. **RS256 key pair generation and mounting**
   - What we know: AUTH.md specifies RS256; DEPLOYMENT.md shows `JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private.pem`
   - What's unclear: Docker secrets vs. volume mount. DEPLOYMENT.md uses `/run/secrets/` path (Docker Swarm secrets syntax) but Docker Compose standalone does not support secrets the same way.
   - Recommendation: For Phase 1, generate key pair with `openssl genrsa` and mount via Docker Compose volume (same as SSL cert pattern). Document the generate-once flow in the Makefile as `make gen-keys`. Do not use Docker Swarm secrets for a single-node eval setup.

2. **Password reset email delivery**
   - What we know: AUTH-03 requires email link; aiosmtplib is chosen; no external email service is defined.
   - What's unclear: In eval environment (localhost), there is no SMTP server. Will password reset be manually testable?
   - Recommendation: Default to `SMTP_HOST=localhost` and use Mailpit (a local SMTP test server) in dev (`docker compose` service). For eval, document that the reset token is logged to stdout if `SMTP_HOST` is unset. This avoids failing AUTH-03 entirely during eval.

3. **Celery in Phase 1 scope**
   - What we know: Celery is part of the Docker stack (D-01). Phase 1 delivers the full Docker stack.
   - What's unclear: Does Celery need any actual tasks in Phase 1, or just a running worker?
   - Recommendation: Phase 1 should start the Celery worker with a `ping` beat task (proves the worker is running). No real tasks needed until Phase 2+. This satisfies INFRA-01 without over-engineering.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | INFRA-01 | ✓ | 29.3.0 | — |
| Docker Compose | INFRA-01 | ✓ | v5.1.0 | — |
| Node.js | Frontend build | ✓ | v24.14.0 | — |
| npm | Frontend packages | ✓ | 11.9.0 | — |
| uv | Backend packages | ✓ | 0.10.9 | — |
| OpenSSL | HTTPS cert generation | ✓ | 3.0.2 | — |
| Python 3.12 | Backend runtime | ✗ (host has 3.10) | 3.10.12 | Python 3.12 runs inside Docker container — no issue |
| PostgreSQL (host) | — | ✗ | — | Runs inside Docker only — no host install needed |
| Redis (host) | — | ✗ | — | Runs inside Docker only — no host install needed |

**Missing dependencies with no fallback:** None — all missing tools are either handled inside Docker or not needed on the host.

**Missing dependencies with fallback:** None.

**Note:** Python 3.10 is installed on the host but the project targets Python 3.12 inside the Docker container. This is expected and correct — host Python is not used.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (backend); jest / vitest (frontend — TBD in Phase 7) |
| Config file | `backend/pyproject.toml` (pytest section) — Wave 0 creates it |
| Quick run command | `docker compose exec backend uv run pytest tests/ -x -q` |
| Full suite command | `docker compose exec backend uv run pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `docker compose up --build` exits 0, all services healthy | smoke | `docker compose ps` — all status "healthy" | ❌ Wave 0 |
| INFRA-02 | HTTPS responds on :8443 | smoke | `curl -k https://localhost:8443/api/health` | ❌ Wave 0 |
| INFRA-03 | PostgreSQL + Redis containers running | smoke | `docker compose exec db pg_isready` + `docker compose exec redis redis-cli ping` | ❌ Wave 0 |
| INFRA-04 | `.env.example` committed; `.env` git-ignored | manual | `git status .env` returns "ignored" | ❌ Wave 0 |
| INFRA-05 | Backend exits 1 when required env var missing | unit | `pytest tests/test_config.py::test_missing_env_var` | ❌ Wave 0 |
| AUTH-01 | POST /auth/register creates user, returns 201 | integration | `pytest tests/test_auth.py::test_register` | ❌ Wave 0 |
| AUTH-02 | POST /auth/login sets httpOnly cookies | integration | `pytest tests/test_auth.py::test_login_sets_cookies` | ❌ Wave 0 |
| AUTH-03 | POST /auth/reset-request returns 200 (no enumeration) | integration | `pytest tests/test_auth.py::test_password_reset_no_enumeration` | ❌ Wave 0 |
| AUTH-04 | POST /auth/refresh rotates refresh token | integration | `pytest tests/test_auth.py::test_refresh_rotation` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `docker compose exec backend uv run pytest tests/test_auth.py tests/test_config.py -x -q`
- **Per wave merge:** `docker compose exec backend uv run pytest tests/ -v`
- **Phase gate:** Full suite green + smoke tests pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/__init__.py` — test package
- [ ] `backend/tests/conftest.py` — shared fixtures (async DB session, test client)
- [ ] `backend/tests/test_config.py` — covers INFRA-05
- [ ] `backend/tests/test_auth.py` — covers AUTH-01 through AUTH-04
- [ ] `backend/pyproject.toml` `[tool.pytest.ini_options]` — asyncio_mode = "auto"
- [ ] Framework install: `uv add pytest pytest-asyncio httpx` (httpx for TestClient async)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|------------------|
| Use `uv` as Python package manager | All `pip install` commands become `uv add`; run commands via `uv run` |
| `uv run xxx` or `uv add xxx` always | Backend Dockerfile: `RUN pip install uv && uv sync --frozen`; entrypoint uses `uv run` |
| Do not overengineer / no defensive programming | No retry logic or connection poolers beyond SQLAlchemy's pool_pre_ping |
| Short modules, short functions | Auth routes split into thin route handlers + service functions |
| Black (88 chars) for backend | Dockerfile or Makefile lint step: `uv run black --check .` |
| Prettier (2-space, 100 chars, semicolons) for frontend | `.prettierrc` committed with these settings |
| Latest stable APIs as of now | Confirmed: Next.js 16.2.1, FastAPI 0.135.2, pydantic 2.12.5 are current |

---

## Sources

### Primary (HIGH confidence)

- Verified via `npm view` (2026-03-24) — all frontend package versions
- Verified via `uv run pip index versions` (2026-03-24) — all backend package versions
- Docker version confirmed via `docker --version` on host
- SQLAlchemy 2 async docs — https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- FastAPI lifespan docs — https://fastapi.tiangolo.com/advanced/events/
- PyJWT docs — https://pyjwt.readthedocs.io/en/stable/
- Next.js 15 middleware docs — https://nextjs.org/docs/app/building-your-application/routing/middleware
- pydantic-settings docs — https://docs.pydantic.dev/latest/concepts/pydantic_settings/

### Secondary (MEDIUM confidence)

- python-jose CVE status: multiple sources (GitHub advisories, PyPI, community) consistently report GHSA-cjwg-qfpm-7377 and related issues; library appears unmaintained as of 2024
- Next.js 15 `cookies()` async change: documented in Next.js 15 migration guide

### Tertiary (LOW confidence)

- Mailpit as local SMTP dev server for password reset testing — community recommendation, not officially endorsed by FastAPI or Next.js docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via package registry on 2026-03-24
- Architecture: HIGH — patterns sourced from official framework docs
- Pitfalls: MEDIUM — Docker/Nginx patterns from official docs; cookie/SameSite behavior from MDN and Next.js docs; python-jose CVE status from GitHub advisories

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable ecosystem; 30-day window is conservative)
