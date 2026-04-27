# Deployment

## Architecture

```
Internet → Nginx (HTTPS :8443) → FastAPI (uvicorn :8000)
                               → Next.js (node :3000)
                               → PostgreSQL (:5432)
                               → Redis (:6379)
                               → Celery worker (no port)
```

Single `docker compose up --build` starts everything.

---

## Docker Services

### docker-compose.yml services

| Service | Image | Port |
|---|---|---|
| `nginx` | nginx:alpine | 8443 (HTTPS) |
| `frontend` | node:20-alpine | 3000 (internal) |
| `backend` | python:3.12-slim | 8000 (internal) |
| `db` | postgres:16-alpine | 5432 (internal) |
| `redis` | redis:7-alpine | 6379 (internal) |
| `celery` | (same as backend image) | none |

All internal ports: not exposed to host in production; only Nginx is public.

### Healthchecks
Each service defines a healthcheck:
- `db`: `pg_isready -U $POSTGRES_USER`
- `redis`: `redis-cli ping`
- `backend`: `curl -f http://localhost:8000/health`
- `frontend`: `curl -f http://localhost:3000/api/health`

Backend and frontend wait for `db` and `redis` to be healthy before starting (`depends_on: condition: service_healthy`).

---

## Environment Variables

All secrets in `.env` (git-ignored). `.env.example` committed with placeholder values.

```bash
# Database
POSTGRES_DB=voxpopuli
POSTGRES_USER=vox
POSTGRES_PASSWORD=changeme

# Redis
REDIS_URL=redis://redis:6379/0

# Backend
SECRET_KEY=change-this-secret-key
JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public.pem
OPENROUTER_API_KEY=sk-...
LLM_MONTHLY_BUDGET_USD=20

# Frontend
NEXT_PUBLIC_API_URL=https://localhost:8443
NEXT_PUBLIC_SOCKET_URL=https://localhost:8443

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
FT_CLIENT_ID=...
FT_CLIENT_SECRET=...
OAUTH_REDIRECT_BASE=

# 42 school
ALLOWED_HOSTS=localhost,127.0.0.1,voxpopuli.local
```

Leave `OAUTH_REDIRECT_BASE` empty during local/LAN development so OAuth callbacks use the host that initiated the flow. Set it explicitly only when you need a fixed canonical URL.

### Startup Validation
Backend validates all required env vars at startup. Missing vars → log error + exit 1.

```python
REQUIRED_ENV_VARS = [
    "POSTGRES_DB", "SECRET_KEY", "OPENROUTER_API_KEY",
    "GOOGLE_CLIENT_ID", "GITHUB_CLIENT_ID", "FT_CLIENT_ID",
]
for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise SystemExit(f"Required env var missing: {var}")
```

---

## HTTPS Setup

42 school requirement: HTTPS on all backend endpoints.

### Self-Signed Certificate (development / evaluation)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

Certificates mounted into Nginx container via Docker volume.

### JWT Signing Keys

Access tokens are signed with an RSA key pair. The key files are deployment-local
secrets and are ignored by git (`*.pem`), but the `backend/keys/` directory is
tracked so Docker does not create the bind-mount source as `root`.

Generate the key pair before starting Compose on a fresh server:

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/jwt_private.pem 2048
openssl rsa -in backend/keys/jwt_private.pem -pubout -out backend/keys/jwt_public.pem
chmod 600 backend/keys/jwt_private.pem
chmod 644 backend/keys/jwt_public.pem
```

The default `.env` paths are relative to the backend working directory:

```bash
JWT_PRIVATE_KEY_PATH=keys/jwt_private.pem
JWT_PUBLIC_KEY_PATH=keys/jwt_public.pem
```

If `backend/keys/` was created by Docker as `root:root`, fix ownership before
generating keys:

```bash
sudo chown -R "$USER:$USER" backend/keys
```

Verify the running backend can read the private key:

```bash
docker compose exec backend sh -c 'test -r keys/jwt_private.pem && echo private-readable || echo private-missing'
```

### Nginx Config
```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /socket.io/ {
        proxy_pass http://backend:8000;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://frontend:3000;
    }
}
```

---

## Database Migrations

Run migrations automatically on backend startup:

```python
# In FastAPI lifespan:
async def lifespan(app):
    await run_migrations()  # alembic upgrade head
    yield
```

Or via docker-compose entrypoint:
```bash
entrypoint: ["sh", "-c", "uv run alembic upgrade head && uvicorn app.main:app ..."]
```

---

## Build Process

### Backend
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen
COPY . .
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
CMD ["npm", "start"]
```

---

## CI/CD (GitHub Actions)

```yaml
on:
  push:
    branches: [main]

jobs:
  test:
    # Run all tests (see TESTING.md)

  build:
    needs: test
    steps:
      - docker compose build
      - docker compose up -d
      - docker compose exec backend uv run pytest
      - docker compose down
```

No automatic deployment — 42 school projects are evaluated locally by `docker compose up --build`.

---

## Chrome Compatibility

42 requirement: no console errors/warnings in latest stable Chrome.

Checklist before evaluation:
- [ ] Open Chrome DevTools → Console tab
- [ ] Navigate all pages: no errors, no warnings
- [ ] WebSocket connection: no failed handshake messages
- [ ] HTTPS: certificate accepted (self-signed warning expected, can be bypassed)
- [ ] No mixed content (HTTP resources on HTTPS page)

---

## Single-Command Start

The evaluator runs one command:
```bash
cp .env.example .env  # fill in OAuth keys
docker compose up --build
```

App is available at `https://localhost:8443`.

---

*Last updated: 2026-03-24*
