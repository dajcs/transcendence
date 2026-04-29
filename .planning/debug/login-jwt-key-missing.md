---
status: investigating
trigger: "trying to login to another computer; POST /api/auth/login returns 500 because backend cannot open keys/jwt_private.pem"
created: 2026-04-28T00:20:13+02:00
updated: 2026-04-28T01:05:00+02:00
---

## Current Focus

hypothesis: Deployment backend container does not have the JWT key files mounted or copied at the configured path.
test: inspect JWT key config, Docker Compose volumes, backend Dockerfile, and generated key presence
expecting: .env points to keys/jwt_private.pem, host has backend/keys, but production compose does not mount ./backend/keys into /app/keys
next_action: verify live server has ~/transcendence/backend/keys/*.pem, then recreate backend container if keys were generated/copied

## Symptoms

expected: Login from another computer to https://voxpo.me/login should authenticate and return tokens.
actual: POST /api/auth/login returns 500 Internal Server Error.
errors: "FileNotFoundError: [Errno 2] No such file or directory: 'keys/jwt_private.pem'" from app/utils/jwt.py while creating access token.
reproduction: Submit login form from another computer through nginx public route; backend handles POST /api/auth/login and fails when reading the private JWT key.
started: Observed in backend/nginx logs on 2026-04-27 around 22:16 UTC.

## Eliminated

## Evidence

- timestamp: 2026-04-28T00:20:13+02:00
  checked: user-provided backend traceback
  found: login reaches auth_service.login, then create_access_token, then _read_private_key, then open(settings.jwt_private_key_path) fails for keys/jwt_private.pem
  implication: credentials were accepted far enough to issue tokens; failure is JWT key availability, not password validation

- timestamp: 2026-04-28T00:20:13+02:00
  checked: .env and .env.example JWT path values
  found: both set JWT_PRIVATE_KEY_PATH=keys/jwt_private.pem and JWT_PUBLIC_KEY_PATH=keys/jwt_public.pem
  implication: inside the backend container, the files must exist under /app/keys

- timestamp: 2026-04-28T00:20:13+02:00
  checked: docker-compose.yml and docker-compose.override.yml
  found: docker-compose.override.yml mounts ./backend:/app for local dev, but base docker-compose.yml has no backend key volume
  implication: local dev can see backend/keys via the broad source mount; production-style compose depends on keys being present at image build time

- timestamp: 2026-04-28T00:20:13+02:00
  checked: backend/keys on host
  found: jwt_private.pem and jwt_public.pem exist locally
  implication: wiring them into the running backend container should address the observed missing-file error

- timestamp: 2026-04-28T00:34:00+02:00
  checked: backend/.dockerignore and .gitignore
  found: backend/.dockerignore does not exclude keys, but .gitignore ignores *.pem so backend/keys files are local secrets and not versioned
  implication: relying only on image COPY is fragile for deployments; runtime compose should mount the host-generated key directory

- timestamp: 2026-04-28T00:34:00+02:00
  checked: docker-compose.yml backend, celery, and celery-beat service definitions
  found: added read-only ./backend/keys:/app/keys mounts for all backend-side containers
  implication: configured JWT_PRIVATE_KEY_PATH=keys/jwt_private.pem and JWT_PUBLIC_KEY_PATH=keys/jwt_public.pem resolve to mounted files at /app/keys/*.pem

- timestamp: 2026-04-28T00:48:00+02:00
  checked: live server backend logs supplied after the local compose mount patch
  found: live backend still raises FileNotFoundError for keys/jwt_private.pem and logs "Will watch for changes in these directories: ['/app']"
  implication: live server is running the dev override with ~/transcendence/backend mounted at /app; because *.pem files are git-ignored, the live server likely does not have ~/transcendence/backend/keys/jwt_private.pem even though the local workstation does

- timestamp: 2026-04-28T00:55:00+02:00
  checked: live server command output supplied by user
  found: backend/keys exists but is empty and owned by root:root, so openssl run as user neat cannot write jwt_private.pem
  implication: fix requires correcting host directory ownership or using sudo before generating the JWT key pair

- timestamp: 2026-04-28T01:05:00+02:00
  checked: prevention path for fresh deployments
  found: adding a tracked backend/keys/.gitkeep ensures the bind-mount source directory exists after clone with the deploy user's ownership
  implication: Docker will not create backend/keys as root on first compose up, while *.pem secret files remain git-ignored

## Resolution

root_cause: JWT signing keys are deployment-local secrets. The app is configured to read keys/jwt_private.pem relative to /app, and the live server runs with ~/transcendence/backend mounted at /app. The key files are git-ignored, so they exist on the local workstation but are absent on the live server. The live backend/keys directory is also root-owned, preventing user neat from generating the missing files.
fix: Added read-only ./backend/keys:/app/keys mounts to backend, celery, and celery-beat in docker-compose.yml so production-style containers can see host-generated keys. Added backend/keys/.gitkeep so the bind source directory exists with deploy-user ownership after clone. Documented JWT key generation, permissions, and runtime verification in plan/DEPLOYMENT.md.
verification: Local backend container can read /app/keys/jwt_private.pem and create an RS256 access token. Live server confirmed private-missing and key generation blocked by host permissions, then user reported login working after correcting keys. docker compose config --quiet passed locally.
files_changed: docker-compose.yml, backend/keys/.gitkeep, plan/DEPLOYMENT.md, .planning/debug/login-jwt-key-missing.md
