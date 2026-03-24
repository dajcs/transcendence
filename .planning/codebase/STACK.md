# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- **TypeScript** (Frontend) - Used across Next.js frontend for type safety
- **Python 3.12** (Backend) - FastAPI backend with async support

**Secondary:**
- **Bash** - Docker configuration and deployment scripts

## Runtime

**Environment:**
- **Node.js** (latest stable) - Frontend/Next.js runtime
- **Python 3.12** - Backend runtime via Docker

**Package Manager:**
- **npm** (Node.js) - Frontend dependency management (Next.js, React, etc.)
  - Lockfile: `package-lock.json` (managed by npm)
- **uv** - Python dependency management (fast, modern replacement for pip)
  - Lockfile: `uv.lock` (explicit dependency pinning)

## Frameworks

**Core:**
- **Next.js 15** - Frontend framework with React 19, App Router, SSR + SPA
  - `frontend/next.config.ts` - Configuration file
  - `frontend/package.json` - Dependencies and scripts
- **FastAPI** (Python 3.12) - Backend REST API framework with WebSocket support
  - `backend/pyproject.toml` - Project config and dependencies
  - `backend/app/main.py` - Application entry point

**UI & Styling:**
- **React 19** - Component library paired with Next.js
- **Tailwind CSS 4** - Utility-first CSS framework for styling
  - `frontend/tailwind.config.ts` - Tailwind configuration
- **TypeScript** - Type system for React components and utilities

**State Management:**
- **Zustand** - Lightweight state management for frontend (React stores)

**Form Handling & Validation:**
- **React Hook Form** - Form state and validation
- **Zod** - Schema validation library (shared with backend schemas)

**Real-time Communication:**
- **Socket.IO client** (JavaScript) - Frontend WebSocket client for real-time updates
- **python-socketio** - Backend Socket.IO server for WebSocket connections

**ORM & Database:**
- **SQLAlchemy 2** (Python) - Async ORM with support for PostgreSQL
  - `backend/app/models/` - SQLAlchemy model definitions
- **Alembic** - Database migration tool
  - `backend/alembic/` - Migration version control
  - `backend/alembic.ini` - Alembic configuration

**Testing:**
- Not yet implemented (planned: pytest for backend, Jest/Vitest for frontend)

**Build/Dev:**
- **Docker** - Containerization for all services
  - `docker-compose.yml` - Multi-container orchestration
  - `frontend/Dockerfile` - Next.js container build
  - `backend/Dockerfile` - FastAPI container build
- **Nginx** - Reverse proxy, HTTPS termination, static file serving
  - `nginx/nginx.conf` - Server configuration
  - `nginx/certs/` - SSL certificates (self-signed for dev)

## Key Dependencies

**Critical - Frontend:**
- **next** v15 - React framework with SSR
- **react** v19 - Component library
- **react-dom** v19 - React rendering for DOM
- **typescript** - Type system
- **tailwindcss** v4 - Styling framework
- **zustand** - State management library
- **react-hook-form** - Form state management
- **zod** - Schema validation
- **socket.io-client** - WebSocket client for real-time updates

**Critical - Backend:**
- **fastapi** - REST API framework
- **sqlalchemy** v2.x - ORM with async support
- **asyncpg** - PostgreSQL async driver
- **alembic** - Database migrations
- **python-socketio** - WebSocket server implementation
- **redis** (redis-py) - Session cache, Celery broker, rate limiting
- **pydantic** - Data validation for request/response schemas
- **python-jose** - JWT token handling
- **passlib** + **bcrypt** - Password hashing and verification
- **httpx** - Async HTTP client for external APIs
- **celery** - Background task queue for async work

**Infrastructure:**
- **postgresql:16** - Relational database (containerized)
- **redis:7** - In-memory cache and message broker (containerized)
- **nginx:latest** - Reverse proxy and static file server (containerized)

## Configuration

**Environment:**
- Configuration via `.env` file (git-ignored per `.gitignore`)
- `.env.example` provided as template for required variables
- Key environment variables:
  - Database: `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - Redis: `REDIS_URL`
  - Backend: `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`
  - OAuth: `OAUTH_GOOGLE_CLIENT_ID/SECRET`, `OAUTH_GITHUB_CLIENT_ID/SECRET`, `OAUTH_42_CLIENT_ID/SECRET`
  - LLM: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`
  - Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`
  - Domain: `DOMAIN` (for Nginx SSL certs)

**Build:**
- `frontend/tsconfig.json` - TypeScript compiler options for Next.js
- `backend/pyproject.toml` - Python project metadata and dependencies
- `docker-compose.yml` - Service orchestration and networking
- Nginx SSL certificates at `nginx/certs/cert.pem` and `nginx/certs/key.pem`

## Platform Requirements

**Development:**
- Docker Engine (with docker-compose support)
- Node.js (for frontend development)
- Python 3.12 (for backend development)
- Modern browser (Google Chrome latest stable)

**Production:**
- Docker and Docker Compose for containerized deployment
- Linux host with HTTPS support
- PostgreSQL 16 database
- Redis 7 instance
- Nginx reverse proxy with SSL termination

## Architecture Notes

- **Frontend**: Runs on `:3000` internally (exposed via Nginx on `:8443`)
- **Backend**: FastAPI REST API on `:8000`, WebSocket (Socket.IO) on same port
- **Database**: PostgreSQL on `:5432` (internal Docker network)
- **Cache/PubSub**: Redis on `:6379` (internal Docker network)
- **All traffic**: HTTPS via Nginx on `:8443`
- **CORS**: Configured for `https://localhost:8443` in backend

---

*Stack analysis: 2026-03-24*
