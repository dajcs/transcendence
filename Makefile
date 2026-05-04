.PHONY: dev main main-down test migrate seed logs build down gen-keys gen-keys-main \
	e2e e2e-list \
	phase7-backend-sync phase7-frontend-install phase7-e2e-install phase7-proof-backend \
	phase7-proof-frontend phase7-proof-e2e-list phase7-proof phase7-heavy \
	restart reload

UV_CACHE_DIR := $(CURDIR)/.cache/uv

# Start all services with hot-reload (docker-compose.override.yml picked up automatically)
dev:
	docker compose up --build

# Start all services in PRODUCTION mode (https://voxpo.me, no hot-reload)
main:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Stop production services
main-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Run backend tests inside the container
test:
	docker compose exec backend uv run pytest tests/ -v

# Run Playwright E2E against the Docker stack
e2e:
	cd frontend && npm run test:e2e

# List Playwright tests without executing them
e2e-list:
	cd frontend && npm run test:e2e:list

# phase7-frontend-install
#         │
#         ├──> phase7-e2e-install
#         │
#         ├──> phase7-proof-frontend
#         │
#         ├──> phase7-proof-e2e-list
#         │
#         └──> phase7-proof ──> phase7-proof-backend
#                           ──> phase7-proof-frontend
#                           ──> phase7-proof-e2e-list

# Install frontend dependencies for the Phase 7 proof path
phase7-frontend-install:
	cd frontend && npm ci

# Install Playwright browsers into the repo-local path configured by the package script
phase7-e2e-install: phase7-frontend-install
	cd frontend && npm run test:e2e:install || PLAYWRIGHT_BROWSERS_PATH=.playwright npx playwright install chromium

# Sync backend dev dependencies for the Phase 7 proof path using a repo-local uv cache
phase7-backend-sync:
	mkdir -p $(UV_CACHE_DIR)
	cd backend && UV_CACHE_DIR="$(UV_CACHE_DIR)" uv sync --group dev

# Backend coverage proof using a repo-local uv cache instead of stale local state
phase7-proof-backend: phase7-backend-sync
	cd backend && UV_CACHE_DIR="$(UV_CACHE_DIR)" uv run pytest --cov=app --cov-report=term-missing --cov-fail-under=62 tests/ -q

# Frontend typecheck + Jest coverage proof using a clean npm install
phase7-proof-frontend: phase7-frontend-install
	cd frontend && npm run type-check
	cd frontend && npm run test:coverage -- --runInBand

# Prepare Playwright, then prove the command surface is installed and runnable
phase7-proof-e2e-list: phase7-e2e-install
	cd frontend && npm run test:e2e:list

# Aggregate light proof path used locally and by CI
phase7-proof: phase7-proof-backend phase7-proof-frontend phase7-proof-e2e-list

# Heavy Docker-backed E2E proof path for local runs and manual CI
phase7-heavy:
	@set -eu; \
	backup=""; \
	created_env="false"; \
	if [ -f .env ]; then \
		backup="$$(mktemp)"; \
		cp .env "$$backup"; \
	else \
		cp .env.example .env; \
		created_env="true"; \
	fi; \
	cleanup() { \
		status=$$?; \
		docker compose down -v >/dev/null 2>&1 || true; \
		if [ -n "$$backup" ]; then \
			cp "$$backup" .env; \
			rm -f "$$backup"; \
		elif [ "$$created_env" = "true" ]; then \
			rm -f .env; \
		fi; \
		exit $$status; \
	}; \
	trap cleanup EXIT INT TERM; \
	printf '\nENABLE_E2E_TEST_SUPPORT=true\nNEXT_PUBLIC_API_URL=https://localhost:8443\nNEXT_PUBLIC_SOCKET_URL=https://localhost:8443\n' >> .env; \
	$(MAKE) gen-keys; \
	$(MAKE) phase7-e2e-install; \
	docker compose up --build -d; \
	timeout 180 bash -c 'until curl -kfsS https://localhost:8443/api/health; do sleep 5; done'; \
	cd frontend && npm run test:e2e

# Run Alembic migrations (manually, outside normal startup)
migrate:
	docker compose exec backend uv run alembic upgrade head

# Seed dev database with test users
seed:
	docker compose exec -e PYTHONPATH=/app backend uv run python scripts/seed_dev.py

# Tail logs for all services
logs:
	docker compose logs -f

# Build images without starting
build:
	docker compose build

# Stop all services
down:
	docker compose down

# Restart all services
restart:
	docker compose down
	docker compose up

# Reload (Rebuild) all services
reload:
	docker compose down
	docker compose up --build


# Generate self-signed SSL cert + RSA key pair for JWT (dev mode)
gen-keys:
	mkdir -p nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/ssl/key.pem \
		-out nginx/ssl/cert.pem \
		-subj "/CN=localhost"
	mkdir -p backend/keys
	openssl genrsa -out backend/keys/jwt_private.pem 2048
	openssl rsa -in backend/keys/jwt_private.pem -pubout -out backend/keys/jwt_public.pem
	@echo "Keys generated. Update JWT_PRIVATE_KEY_PATH and JWT_PUBLIC_KEY_PATH in .env"

# Production nginx mounts Let's Encrypt certs directly from /etc/letsencrypt/live/voxpo.me.
gen-keys-main:
	@test -r /etc/letsencrypt/live/voxpo.me/fullchain.pem
	@test -r /etc/letsencrypt/live/voxpo.me/privkey.pem
	@echo "Production SSL fullchain and key available in /etc/letsencrypt/live/voxpo.me"
