---
phase: 01-foundation
plan: "01"
subsystem: infra
tags: [docker, docker-compose, nginx, postgres, redis, python, node, makefile, https]

requires: []

provides:
  - Docker Compose topology with 6 services: nginx, frontend, backend, db, redis, celery
  - HTTPS termination via Nginx on port 8443 with self-signed cert support
  - PostgreSQL 16 and Redis 7 with healthchecks and named volume
  - Backend Dockerfile (python:3.12-slim + uv) and frontend Dockerfile (two-stage node:20-alpine)
  - .env.example with all required keys; .env git-ignored
  - Makefile developer shortcuts including one-time key generation (gen-keys)

affects:
  - 01-02 (backend scaffold uses Dockerfile and compose service definition)
  - 01-03 (database service and postgres_data volume)
  - 01-04 (frontend Dockerfile and compose service)
  - all subsequent phases (consume docker-compose.yml topology)

tech-stack:
  added:
    - docker compose v2
    - nginx:alpine
    - postgres:16-alpine
    - redis:7-alpine
    - python:3.12-slim (backend base image)
    - node:20-alpine (frontend base image)
    - uv (Python package manager via pip install uv in Dockerfile)
  patterns:
    - healthcheck + condition:service_healthy dependency chain (db/redis -> backend/celery -> nginx)
    - docker-compose.override.yml for dev hot-reload, transparent to evaluators
    - entrypoint runs alembic migrations before uvicorn start
    - two-stage Dockerfile for frontend (builder + runtime)

key-files:
  created:
    - docker-compose.yml
    - docker-compose.override.yml
    - nginx/nginx.conf
    - nginx/ssl/.gitkeep
    - .env.example
    - .gitignore (extended)
    - backend/Dockerfile
    - backend/.dockerignore
    - frontend/Dockerfile
    - frontend/.dockerignore
    - Makefile
  modified:
    - .gitignore

key-decisions:
  - "docker-compose.override.yml for dev hot-reload; base compose is eval-ready without modification"
  - "Alembic migrations run automatically in backend entrypoint before uvicorn start"
  - "frontend production image uses npm start not next dev"
  - "gen-keys Makefile target generates both SSL cert and RSA JWT key pair in one command"
  - "nginx/ssl/.gitkeep tracks the directory; cert.pem and key.pem are git-ignored"

patterns-established:
  - "service_healthy dependency chain: all services wait for db+redis before starting"
  - "uv sync --frozen --no-dev in Dockerfile for reproducible, production-only deps"
  - "WebSocket upgrade headers in all nginx proxy_pass locations (future Socket.IO)"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04]

duration: 3min
completed: 2026-03-24
---

# Phase 01 Plan 01: Docker Infrastructure Summary

**Six-service Docker Compose stack with Nginx HTTPS on port 8443, PostgreSQL 16 + Redis 7 healthchecks, uv-based Python Dockerfile, two-stage Next.js Dockerfile, and Makefile with gen-keys for one-command environment setup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T21:26:42Z
- **Completed:** 2026-03-24T21:30:05Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Complete Docker Compose topology: nginx, frontend, backend, db, redis, celery with healthchecks and proper dependency ordering
- Nginx HTTPS proxy on port 8443 with WebSocket upgrade support for future Socket.IO
- Backend Dockerfile with uv package manager and layer-cached dependency install; frontend with two-stage build
- Developer Makefile with all 8 targets including gen-keys for one-time SSL cert and JWT RSA key pair generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Docker Compose services, Nginx, and environment files** - `e6446e1` (chore)
2. **Task 2: Backend and frontend Dockerfiles plus Makefile** - `5c78bb4` (chore)

## Files Created/Modified

- `docker-compose.yml` - 6 service definitions with healthchecks, condition:service_healthy deps, named volume
- `docker-compose.override.yml` - dev hot-reload: uvicorn --reload, npm run dev, volume mounts
- `nginx/nginx.conf` - HTTPS on 8443, proxy_pass to backend:8000 and frontend:3000, WebSocket upgrade headers
- `nginx/ssl/.gitkeep` - tracks ssl/ directory without committing cert files
- `.env.example` - 15+ required keys: DB, Redis, JWT paths, SMTP, LLM, OAuth, ALLOWED_HOSTS
- `.gitignore` - added nginx/ssl certs, JWT *.pem, Python/Node/Docker artifacts
- `backend/Dockerfile` - python:3.12-slim, pip install uv, uv sync --frozen --no-dev, EXPOSE 8000
- `backend/.dockerignore` - excludes .venv, __pycache__, tests, .env
- `frontend/Dockerfile` - two-stage: node:20-alpine builder (npm ci + npm run build), runtime CMD npm start
- `frontend/.dockerignore` - excludes node_modules, .next, .env files
- `Makefile` - dev, test, migrate, seed, logs, build, down, gen-keys targets

## Decisions Made

- Used docker-compose.override.yml for dev hot-reload so the base docker-compose.yml is eval-ready with no modifications; Docker Compose picks up the override automatically
- Backend entrypoint runs `uv run alembic upgrade head` before uvicorn so migrations are always current on container start
- Frontend production image CMD is `npm start` (not `next dev`) — two-stage build with builder stage running `npm run build`
- `gen-keys` target generates both the Nginx SSL cert and the RSA JWT key pair together — single command for developer onboarding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- nginx -t validation outside Compose network fails with "host not found: backend" because DNS resolution only works inside the Docker Compose network. This is expected behavior; the config is syntactically valid and will work correctly at runtime. Verified with `docker compose config --quiet` (exits 0, only deprecation warning about `version:` attribute).

## User Setup Required

Before running `docker compose up --build`, developer must run `make gen-keys` to generate SSL certificates and JWT key pair, then update `.env` with correct JWT key paths.

## Next Phase Readiness

- Docker infrastructure complete; backend scaffold (01-02) can now create FastAPI app and pyproject.toml
- Frontend scaffold (01-03) can create Next.js app using the frontend Dockerfile
- Database schema (01-04) can write Alembic migrations using the db service

---
*Phase: 01-foundation*
*Completed: 2026-03-24*
