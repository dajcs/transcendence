# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-foundation
**Areas discussed:** Docker setup, JWT token storage, Frontend app shell, DB migration strategy

---

## Docker Setup

### Compose structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single compose + overrides | docker-compose.yml (eval) + docker-compose.override.yml (dev hot-reload) | ✓ |
| Single compose only | One file, no hot-reload | |
| Separate dev + prod files | Explicit -f flags required | |

**User's choice:** Single compose + overrides

---

### Hot-reload scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both backend and frontend | FastAPI --reload + next dev | ✓ |
| Backend only | Frontend rebuilds on change | |
| Frontend only | Backend requires rebuild | |

**User's choice:** Both

---

### Nginx in dev

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Nginx in dev | Same HTTPS routing as eval | ✓ |
| Bypass Nginx in dev | Direct :3000 / :8000 access | |

**User's choice:** Keep Nginx in dev

---

### Makefile

| Option | Description | Selected |
|--------|-------------|----------|
| Makefile | make dev, test, migrate, seed, logs | ✓ |
| No Makefile | Raw docker compose commands | |

**User's choice:** Makefile

---

### Migration timing

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on backend startup | alembic upgrade head in entrypoint | ✓ |
| Manual via make/script | Explicit control | |

**User's choice:** Auto on startup

---

### Rootless Docker

| Option | Description | Selected |
|--------|-------------|----------|
| Non-root users in all images | adduser in each Dockerfile | |
| Document rootless notes only | README note, standard Dockerfiles | ✓ |

**User's choice:** Document only

---

### PostgreSQL persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Named Docker volume | postgres_data volume | ✓ |
| Bind mount to ./data/ | Local folder visibility | |

**User's choice:** Named Docker volume

---

## JWT Token Storage

### Token location

| Option | Description | Selected |
|--------|-------------|----------|
| httpOnly cookies | XSS-proof, SameSite=Strict CSRF protection | ✓ |
| localStorage | Simpler, XSS-vulnerable | |
| Memory (access) + httpOnly (refresh) | Most secure, complex silent refresh | |

**User's choice:** httpOnly cookies

---

### Zustand auth store

| Option | Description | Selected |
|--------|-------------|----------|
| Store user profile only | {user, isAuthenticated}, bootstrapped via /api/auth/me | ✓ |
| Store access token in Zustand | Duplicate token in memory | |
| No Zustand auth store | Server-side only | |

**User's choice:** Store user profile only

---

## Frontend App Shell

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Auth + minimal nav | Login/register/reset + top nav + route guards | ✓ |
| Auth pages only | Just login and register | |
| Full shell with placeholders | All nav, sidebar, stub pages | |

**User's choice:** Auth + minimal nav

---

### Polish level

| Option | Description | Selected |
|--------|-------------|----------|
| Functional but unstyled | Tailwind utilities, readable but not polished | ✓ |
| Polished from day 1 | Full design system | |
| Completely bare | No styling | |

**User's choice:** Functional but unstyled

---

### Landing page

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal pitch page | Brief explanation + sign up CTA | ✓ |
| Redirect to login | / goes to /login directly | |

**User's choice:** Minimal pitch page

---

## DB Migration Strategy

### Migration structure

| Option | Description | Selected |
|--------|-------------|----------|
| One big initial migration | 001_initial_schema.py — all tables at once | ✓ |
| Per-domain migrations | Separate files per domain | |

**User's choice:** One big initial migration

---

### Seed data

| Option | Description | Selected |
|--------|-------------|----------|
| Dev seed script | scripts/seed_dev.py, make seed, test users | ✓ |
| No seed data | Clean schema only | |

**User's choice:** Dev seed script

---

### Schema scope

| Option | Description | Selected |
|--------|-------------|----------|
| All tables at once | Complete DATABASE.md schema in Phase 1 | ✓ |
| Auth tables only | Just users and oauth_accounts | |
| Core tables only | Users + bets + transactions | |

**User's choice:** All tables at once — full DATABASE.md schema

---

## Claude's Discretion

- Dockerfile layer ordering and .dockerignore
- Nginx SSL cipher details
- Tailwind classes/spacing for auth pages
- JWT access token expiry duration
- Alembic migration file naming

## Deferred Ideas

None — discussion stayed within Phase 1 scope.
