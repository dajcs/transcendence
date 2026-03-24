# Phase 1: Foundation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Working Docker stack with auth and complete database schema in place. Delivers: Docker Compose (Nginx HTTPS, FastAPI, Next.js, PostgreSQL, Redis, Celery), full database schema via Alembic migrations, email/password registration + login with JWT, and Next.js 15 app shell with auth pages and minimal nav.

Creating markets, placing bets, social features, real-time, and OAuth are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Docker Setup
- **D-01:** Single `docker-compose.yml` is the eval-ready setup. `docker-compose.override.yml` adds hot-reload volume mounts for dev — picked up automatically by `docker compose up`, transparent to evaluators.
- **D-02:** Both backend (uvicorn --reload) and frontend (next dev) hot-reload in the override.
- **D-03:** Nginx stays in the loop even in dev — same HTTPS routing as eval. Catches SSL/proxy issues early.
- **D-04:** Makefile for common dev commands: `make dev`, `make test`, `make migrate`, `make seed`, `make logs`.
- **D-05:** Alembic migrations run automatically on backend startup (`alembic upgrade head` in entrypoint before uvicorn).
- **D-06:** Rootless Docker: document notes only (README). No non-root user setup in Dockerfiles.
- **D-07:** PostgreSQL data in named Docker volume (`postgres_data`). Wipe with `docker volume rm`.

### Auth Token Storage
- **D-08:** JWT tokens (access + refresh) stored in httpOnly cookies — XSS-proof, SameSite=Strict for CSRF protection.
- **D-09:** Zustand auth store holds `{user, isAuthenticated}` only — no tokens in JS. Auth state bootstrapped via `GET /api/auth/me` on app load.

### Frontend App Shell
- **D-10:** Phase 1 frontend includes: login page, register page, password reset page, minimal top nav (logo + login/logout button), route guards for protected pages, placeholder routing for future pages.
- **D-11:** Minimal landing page at `/` — brief pitch (what Vox Populi is, CTA to sign up). Gives evaluators context.
- **D-12:** Styling: functional with Tailwind utilities for layout and basic readability. Not polished — visual design in Phase 2+.

### Database Migrations
- **D-13:** One big initial migration: `001_initial_schema.py` creates ALL tables from DATABASE.md at once (users, oauth_accounts, bets, bet_positions, transactions, social, etc). Backend code only uses auth tables in Phase 1, but full schema is ready.
- **D-14:** Dev seed script: `scripts/seed_dev.py` creates test users (e.g., alice, bob with starting points). Run via `make seed`. Not part of migrations, not run during eval.

### Claude's Discretion
- Exact Dockerfile layer ordering and .dockerignore optimization
- Nginx SSL cipher configuration details
- Specific Tailwind classes and spacing for auth pages
- Alembic migration file naming beyond `001_initial_schema`
- JWT access token expiry (AUTH.md says short-lived; exact duration Claude decides)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Infrastructure & Deployment
- `plan/DEPLOYMENT.md` — Docker service definitions, port mapping, env vars, HTTPS setup, healthchecks

### Database Schema
- `plan/DATABASE.md` — All table definitions, column types, indexes, concurrency model, Redis usage

### Authentication
- `plan/AUTH.md` — Email/password flow, PKCE OAuth flow, JWT token structure, password reset, rate limiting

### Stack Decisions
- `plan/TECH.md` — Framework choices with rationale, module targets, package manager conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code.

### Established Patterns
- Codebase maps exist in `.planning/codebase/` (ARCHITECTURE.md, CONVENTIONS.md, STACK.md, STRUCTURE.md) — these were pre-planned, not yet implemented.
- Frontend naming: PascalCase components, camelCase hooks/utils (`useAuth.ts`, `formatCurrency.ts`)
- Backend naming: snake_case everywhere (`auth_routes.py`, `validate_bet_input()`)
- Prettier (2-space, 100 chars, semicolons) for frontend; Black (88 chars) for backend

### Integration Points
- Auth cookies set by FastAPI, read by Next.js middleware for SSR route protection
- `/api/auth/me` is the bootstrap endpoint — Zustand hydrates from this on first load
- Nginx proxies `/api/` to backend:8000, everything else to frontend:3000

</code_context>

<specifics>
## Specific Ideas

- No specific UI references — "functional but unstyled" is the target for Phase 1
- Makefile is intentional developer UX, not just convenience

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-24*
