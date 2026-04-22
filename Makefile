.PHONY: dev test migrate seed logs build down gen-keys e2e e2e-list

# Start all services with hot-reload (docker-compose.override.yml picked up automatically)
dev:
	docker compose up --build

# Run backend tests inside the container
test:
	docker compose exec backend uv run pytest tests/ -v

# Run Playwright E2E against the Docker stack
e2e:
	cd frontend && npm run test:e2e

# List Playwright tests without executing them
e2e-list:
	cd frontend && npm run test:e2e:list

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


# Generate SSL cert + RSA key pair for JWT (run once)
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
