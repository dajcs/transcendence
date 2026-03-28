# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Layered client-server with REST API, async service layer, and Zustand-driven frontend state

**Key Characteristics:**
- Backend follows a strict 3-tier layout: Routes → Services → Models/DB
- Frontend uses a 2-tier layout: Pages (React components) → Zustand stores (which call the API)
- All HTTP auth state travels through httpOnly cookies (no Authorization headers)
- No real-time push yet (WebSocket infrastructure exists via nginx proxy config, but not implemented); chat and notifications use polling
- Celery handles background/scheduled work, keeping FastAPI routes synchronous-safe
- All backend I/O is async (SQLAlchemy asyncpg, aioredis)

## Layers

**Route Layer (backend):**
- Purpose: HTTP request handling, auth cookie extraction, input/output schema validation
- Location: `backend/app/api/routes/`
- Contains: FastAPI `APIRouter` modules — one file per domain: `auth.py`, `bets.py`, `chat.py`, `comments.py`, `friends.py`, `markets.py`, `notifications.py`, `users.py`
- Depends on: Service layer, `backend/app/api/deps.py` for `get_db`, `auth_service` for token resolution
- Used by: FastAPI app registered in `backend/app/main.py`
- Auth pattern: Each protected router has a local `_get_current_user(request, db)` helper that reads the `access_token` cookie and delegates to `auth_service.get_current_user()`

**Service Layer (backend):**
- Purpose: Business logic, validation, cross-domain orchestration, notification dispatch
- Location: `backend/app/services/`
- Contains: `auth_service.py`, `bet_service.py`, `chat_service.py`, `comment_service.py`, `economy_service.py`, `email_service.py`, `friend_service.py`, `market_service.py`, `notification_service.py`, `profile_service.py`
- Depends on: DB models, schemas, `backend/app/utils/` (JWT, password hashing), `notification_service` for side-effects
- Used by: Route layer only
- Convention: Functions receive `AsyncSession` as first arg; raise `HTTPException` for business errors

**Data Layer (backend):**
- Purpose: SQLAlchemy ORM models and async session management
- Location: `backend/app/db/`
- Contains:
  - `backend/app/db/base.py` — `DeclarativeBase`
  - `backend/app/db/session.py` — `AsyncSessionLocal`, `get_db` dependency, `engine`
  - `backend/app/db/models/user.py` — `User`, `OauthAccount`
  - `backend/app/db/models/bet.py` — `Bet`, `BetPosition`, `PositionHistory`, `Resolution`, `Dispute`, `DisputeVote`, `Comment`, `CommentUpvote`, `BetUpvote`
  - `backend/app/db/models/social.py` — `FriendRequest`, `Message`, `Notification`
  - `backend/app/db/models/transaction.py` — `BpTransaction`, `KpEvent`
- Depends on: PostgreSQL via asyncpg
- Used by: Service layer

**Schema Layer (backend):**
- Purpose: Pydantic request/response models for validation and serialization
- Location: `backend/app/schemas/`
- Contains: `auth.py`, `bet.py`, `chat.py`, `comment.py`, `friends.py`, `market.py`, `notifications.py`, `profile.py`
- Depends on: Nothing (pure Pydantic)
- Used by: Route layer (type annotations), service layer (function signatures)

**Frontend Page Layer:**
- Purpose: Next.js App Router pages; render UI and wire user interactions to stores
- Location: `frontend/src/app/(protected)/` and `frontend/src/app/(auth)/`
- Contains: Route-grouped `page.tsx` files; all interactive pages use `"use client"`
- Depends on: Zustand stores, `@/lib/api`, `@tanstack/react-query` (markets and bets pages)
- Used by: Browser via Next.js routing

**Frontend Store Layer:**
- Purpose: Client-side state management; encapsulates all API calls
- Location: `frontend/src/store/`
- Contains: `auth.ts`, `chat.ts`, `friends.ts`, `market.ts`, `notifications.ts`
- Depends on: `@/lib/api` (axios singleton at `frontend/src/lib/api.ts`)
- Used by: Page components and shared components (TopNav, NotificationBell, AuthBootstrap)

## Data Flow

**HTTP Request (authenticated, e.g. send message):**

1. Page (`frontend/src/app/(protected)/chat/[userId]/page.tsx`) calls `useChatStore().sendMessage()`
2. Zustand store calls `api.post('/api/chat/{id}/messages', ...)` via `frontend/src/lib/api.ts` — cookies sent automatically via `withCredentials: true`
3. Nginx (`nginx/nginx.conf`) terminates HTTPS on port 8443 and proxies `/api/*` to `backend:8000`
4. FastAPI router (`backend/app/api/routes/chat.py`) extracts `access_token` cookie, calls `_get_current_user()`
5. `auth_service.get_current_user()` decodes JWT and queries `users` table
6. Router delegates to `chat_service.send_message()`, which validates friendship, inserts `Message` row
7. Response serialized as `MessageResponse` schema, returned as JSON

**Auth Bootstrap (on page load):**

1. `frontend/src/components/AuthBootstrap.tsx` mounts in root layout, calls `useAuthStore().bootstrap()`
2. Bootstrap hits `GET /api/auth/me` — FastAPI reads `access_token` cookie, returns user + balances
3. On success, `frontend/src/store/auth.ts` sets `user` and `isAuthenticated: true`
4. `AuthBootstrap` observes `isAuthenticated` and triggers `useFriendsStore().fetch()` to pre-load friends list for nav badge

**Notification Polling:**

1. `NotificationBell` component (`frontend/src/components/NotificationBell.tsx`) polls `GET /api/notifications/unread-count` every 10 seconds via `setInterval`
2. On bell open, fetches full list via `GET /api/notifications`
3. Backend reads from `notifications` table; notifications are written by `notification_service.notify_*` helpers called as fire-and-forget side-effects inside `friend_service` and `bet_service`

**Chat Polling:**

1. `frontend/src/app/(protected)/chat/[userId]/page.tsx` polls `GET /api/chat/{partnerId}/messages` every 3 seconds via `setInterval` while conversation is open
2. `POST /api/chat/{partnerId}/read` is called on open and on each poll to mark messages read
3. Backend returns messages ordered chronologically; client auto-scrolls to bottom

**Background Job (daily economy allocation):**

1. Celery Beat triggers `app.workers.tasks.daily.daily_allocation` at UTC midnight (`backend/app/workers/celery_app.py`)
2. Task runs async `_run_allocation()` via `asyncio.run()` with its own `AsyncSessionLocal`
3. Reads all users, computes `karma_bp = floor(log2(kp + 1))`, writes `BpTransaction` rows, resets KP via `KpEvent`

**State Management:**
- Zustand stores are the single source of truth for: auth user, friends list, chat conversations/messages, notification list + unread count
- `@tanstack/react-query` is used only in markets and betting pages (server-fetched, cache-invalidated on mutation)
- No SSR for protected routes; all data is fetched client-side on mount

## Key Abstractions

**FriendRequest (polymorphic relationship table):**
- Purpose: Single table represents pending/accepted/declined/blocked relationships; `status` field drives semantics
- Examples: `backend/app/db/models/social.py`, `backend/app/services/friend_service.py`
- Pattern: Symmetric pair queries use `or_(and_(...), and_(...))` throughout `friend_service.py` and `chat_service.py`
- States: `pending` → `accepted` | `declined` | `blocked`; declined can be re-requested by overwriting the record

**Notification (typed inbox entry):**
- Purpose: Inbox-style notification row; `type` field discriminates event kind; `payload` is a JSON string
- Examples: `backend/app/db/models/social.py`, `backend/app/services/notification_service.py`
- Pattern: Convenience helpers `notify_friend_request`, `notify_friend_accepted`, `notify_new_message`, `notify_bet_resolved`, `notify_bet_disputed` are called from services as fire-and-forget (wrapped in `try/except`)
- Types in use: `friend_request`, `friend_accepted`, `new_message`, `bet_resolved`, `bet_disputed`

**Economy (three currencies):**
- Purpose: Platform currency model — BP (Betting Points), KP (Karma Points, daily-reset), TP (Truth Points)
- Examples: `backend/app/services/economy_service.py`, `backend/app/db/models/transaction.py`
- Pattern: `get_balance(db, user_id)` aggregates `BpTransaction` and `KpEvent` tables on demand; no denormalized balance column on `User`

**API client (frontend singleton):**
- Purpose: Single configured axios instance for all backend calls
- Examples: `frontend/src/lib/api.ts`
- Pattern: `baseURL` from `NEXT_PUBLIC_API_URL` env var; `withCredentials: true` passes cookies; all stores import this singleton

## Entry Points

**Backend:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app` (via Docker entrypoint in `docker-compose.yml`)
- Responsibilities: Creates FastAPI app, registers CORS middleware, mounts all 8 routers under `/api/*`, exposes `GET /api/health`

**Frontend:**
- Location: `frontend/src/app/layout.tsx`
- Triggers: Next.js App Router render
- Responsibilities: Wraps all pages in `QueryProvider` (TanStack Query), mounts `AuthBootstrap` (silent auth check on load), renders `TopNav`

**Celery Worker:**
- Location: `backend/app/workers/celery_app.py`
- Triggers: `celery -A app.workers.celery_app worker` (Docker `celery` service) and `celery beat` (Docker `celery-beat` service)
- Responsibilities: Scheduled background tasks; `daily_allocation` runs at UTC midnight

**Database Migrations:**
- Location: `backend/alembic/versions/` (8 migrations: `001` through `008`)
- Triggers: `uv run alembic upgrade head` runs at backend container startup before uvicorn
- Latest migration: `008_add_user_bio.py`

## Error Handling

**Strategy:** Services raise `HTTPException` with appropriate status codes; routes do not catch these (FastAPI handles them). Fire-and-forget side-effects (notification dispatch) are wrapped in `try/except Exception: pass`.

**Patterns:**
- 401: `access_token` cookie missing or invalid
- 403: authorization failure (not your resource, blocked user, not friends)
- 404: queried entity does not exist
- 409: uniqueness conflicts (duplicate friend request, username taken)
- Frontend stores silently swallow errors from polling calls; user-initiated actions surface errors inline

## Cross-Cutting Concerns

**Logging:** Standard Python `logging` in `backend/app/services/auth_service.py`; no structured logging framework

**Validation:** Pydantic schemas handle input validation on all routes; DB-level constraints via `UniqueConstraint` and explicit migration indexes

**Authentication:** Cookie-based JWT; access token (5h, SameSite=Lax), refresh token (7d, SameSite=Strict, path-restricted to `/api/auth/refresh`); Redis stores revoked refresh tokens; no Bearer token auth anywhere

**Avatar storage:** Profile update accepts `avatar_url` as a plain URL string via `PUT /api/users/me`; no server-side file upload endpoint exists yet — avatar_url is expected to be an external URL

---

*Architecture analysis: 2026-03-28*
