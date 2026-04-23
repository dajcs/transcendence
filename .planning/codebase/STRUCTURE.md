# Codebase Structure

**Analysis Date:** 2026-03-28

## Directory Layout

```
transcendence/                        # Project root
├── backend/                          # FastAPI application
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Pydantic settings (reads .env)
│   │   ├── api/
│   │   │   ├── deps.py               # FastAPI dependencies (get_db)
│   │   │   └── routes/               # One router file per domain
│   │   │       ├── auth.py
│   │   │       ├── bets.py
│   │   │       ├── chat.py
│   │   │       ├── comments.py
│   │   │       ├── friends.py
│   │   │       ├── markets.py
│   │   │       ├── notifications.py
│   │   │       └── users.py
│   │   ├── db/
│   │   │   ├── base.py               # DeclarativeBase
│   │   │   ├── session.py            # AsyncSession factory + get_db
│   │   │   └── models/
│   │   │       ├── user.py           # User, OauthAccount
│   │   │       ├── bet.py            # Bet, BetPosition, PositionHistory,
│   │   │       │                     #   Resolution, Dispute, DisputeVote,
│   │   │       │                     #   Comment, CommentUpvote, BetUpvote
│   │   │       ├── social.py         # FriendRequest, Message, Notification
│   │   │       └── transaction.py    # BpTransaction, KpEvent
│   │   ├── schemas/                  # Pydantic I/O models (one per domain)
│   │   │   ├── auth.py
│   │   │   ├── bet.py
│   │   │   ├── chat.py
│   │   │   ├── comment.py
│   │   │   ├── friends.py
│   │   │   ├── market.py
│   │   │   ├── notifications.py
│   │   │   └── profile.py
│   │   ├── services/                 # Business logic (one per domain)
│   │   │   ├── auth_service.py
│   │   │   ├── bet_service.py
│   │   │   ├── chat_service.py
│   │   │   ├── comment_service.py
│   │   │   ├── economy_service.py
│   │   │   ├── email_service.py
│   │   │   ├── friend_service.py
│   │   │   ├── market_service.py
│   │   │   ├── notification_service.py
│   │   │   └── profile_service.py
│   │   ├── utils/                    # JWT, password hashing helpers
│   │   └── workers/
│   │       ├── celery_app.py         # Celery app + beat schedule
│   │       └── tasks/
│   │           └── daily.py          # Daily economy allocation task
│   ├── alembic/
│   │   └── versions/                 # 8 migration files (001–008)
│   ├── tests/                        # pytest test suite
│   ├── scripts/                      # One-off utility scripts
│   ├── keys/                         # JWT RSA key files (git-ignored)
│   └── Dockerfile
├── frontend/                         # Next.js 15 application
│   └── src/
│       ├── app/
│       │   ├── layout.tsx            # Root layout (QueryProvider, TopNav, AuthBootstrap)
│       │   ├── page.tsx              # Public landing page
│       │   ├── globals.css
│       │   ├── (auth)/               # Route group: unauthenticated pages
│       │   │   ├── login/page.tsx
│       │   │   ├── register/page.tsx
│       │   │   └── reset-password/page.tsx
│       │   ├── (protected)/          # Route group: authenticated pages
│       │   │   ├── markets/
│       │   │   │   ├── page.tsx      # Markets list
│       │   │   │   ├── [id]/page.tsx # Market detail + bet placement
│       │   │   │   └── new/page.tsx  # Create market form
│       │   │   ├── friends/page.tsx  # Friends list, requests, search, block
│       │   │   ├── chat/
│       │   │   │   ├── page.tsx      # Conversation list
│       │   │   │   └── [userId]/page.tsx # Chat thread with polling
│       │   │   └── profile/
│       │   │       └── [username]/page.tsx # Public profile + edit own profile
│       │   └── api/
│       │       └── health/route.ts   # Next.js health check endpoint
│       ├── components/
│       │   ├── AuthBootstrap.tsx     # Mounts in layout; bootstraps auth + friends on load
│       │   ├── NotificationBell.tsx  # Bell icon with dropdown; polls unread count
│       │   ├── QueryProvider.tsx     # TanStack Query client provider wrapper
│       │   ├── UserLink.tsx          # Reusable username → profile link component
│       │   ├── UserSearch.tsx        # Inline user search component (used in TopNav)
│       │   ├── auth/                 # Auth form components
│       │   └── nav/
│       │       └── TopNav.tsx        # Top navigation bar
│       ├── store/                    # Zustand stores
│       │   ├── auth.ts               # User identity, bootstrap, logout
│       │   ├── chat.ts               # Conversations, messages, send, markRead
│       │   ├── friends.ts            # Friends list, requests, block/unblock
│       │   ├── market.ts             # Market list/detail state
│       │   └── notifications.ts      # Notification list, unread count, mark read
│       └── lib/
│           ├── api.ts                # Axios singleton (baseURL + withCredentials)
│           ├── types.ts              # Shared TypeScript types (Market, etc.)
│           ├── friends-types.ts      # Friend-specific TypeScript types
│           ├── auth.ts               # Auth-related helpers
│           ├── chat.ts               # Chat-related helpers
│           ├── market.ts             # Market-related helpers
│           └── notifications.ts      # Notification-related helpers
├── nginx/
│   ├── nginx.conf                    # HTTPS reverse proxy; routes /api/ and /socket.io/ to backend, / to frontend
│   └── ssl/                          # TLS certificate and key (git-ignored)
├── docker-compose.yml                # 6 services: db, redis, backend, celery, celery-beat, frontend, nginx
├── docker-compose.override.yml       # Local dev overrides
├── Makefile
├── .env.example                      # Required env var template
├── .planning/                        # GSD planning artifacts
│   ├── codebase/                     # Codebase analysis documents (this file)
│   └── phases/                       # Phase plans (01-foundation, 02-core-betting, 03-social)
└── plan/                             # Human-readable project planning docs
```

## Directory Purposes

**`backend/app/api/routes/`:**
- Purpose: HTTP surface of the application; one file per domain
- Contains: FastAPI `APIRouter` instances; route handlers that are thin wrappers over service calls
- Key files: `auth.py` (register/login/refresh/logout/me), `chat.py` (conversations/messages), `friends.py` (request/accept/block), `notifications.py` (list/mark-read), `users.py` (profile/search)

**`backend/app/services/`:**
- Purpose: All business logic lives here; the only place that mutates data
- Contains: Domain service modules; each imports models and schemas directly
- Key files: `friend_service.py` (friendship state machine), `chat_service.py` (friend-gated messaging), `notification_service.py` (typed notification creation + convenience helpers), `economy_service.py` (balance queries + credit/debit helpers)

**`backend/app/db/models/`:**
- Purpose: SQLAlchemy ORM model definitions; all use `Mapped` typed columns
- Contains: 4 model files grouping related tables
- Key files: `social.py` (contains `FriendRequest`, `Message`, `Notification` — all Phase 3 models)

**`backend/alembic/versions/`:**
- Purpose: Ordered schema migrations; applied automatically at container startup
- Contains: 8 migration files; files are prefixed with 3-digit sequence numbers
- Key files: `005_friend_request_unique_constraint.py`, `006_symmetric_friend_constraint.py`, `007_friend_request_query_indexes.py`, `008_add_user_bio.py`

**`frontend/src/app/(protected)/`:**
- Purpose: All authenticated pages; Next.js route group (no URL impact)
- Contains: `markets`, `friends`, `chat`, `profile`, `hall-of-fame`, and `settings` page directories
- Note: Route protection is enforced by `frontend/src/proxy.ts`; the old `/dashboard` route has been removed and profile tabs cover its former personal portfolio workflows

**`frontend/src/store/`:**
- Purpose: Zustand state atoms; each store owns one domain's data + API calls
- Contains: 5 store files; all use `create<T>()` from zustand
- Key pattern: stores call `api.*` from `@/lib/api` directly; no separate API layer module

**`frontend/src/components/`:**
- Purpose: Reusable UI components shared across multiple pages
- Contains: `AuthBootstrap.tsx`, `NotificationBell.tsx`, `QueryProvider.tsx`, `UserLink.tsx`, `UserSearch.tsx`, `auth/`, `nav/`
- Note: `NotificationBell.tsx` is a self-contained widget with its own polling logic

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app factory; router registration
- `frontend/src/app/layout.tsx`: Next.js root layout; provider + nav setup
- `backend/app/workers/celery_app.py`: Celery app + beat schedule

**Configuration:**
- `backend/app/config.py`: All backend settings via pydantic-settings; reads `.env`
- `docker-compose.yml`: Service topology, port mapping, health checks
- `nginx/nginx.conf`: TLS termination, proxy routing rules

**Core Domain Logic:**
- `backend/app/services/friend_service.py`: Friend request state machine
- `backend/app/services/chat_service.py`: Friend-gated direct messaging
- `backend/app/services/notification_service.py`: Notification creation + helpers
- `backend/app/services/profile_service.py`: Public profile, user search, profile update
- `backend/app/services/economy_service.py`: Balance calculations, BP/KP/TP operations

**Social Models:**
- `backend/app/db/models/social.py`: `FriendRequest`, `Message`, `Notification`

**Frontend State:**
- `frontend/src/store/auth.ts`: Auth user identity
- `frontend/src/store/friends.ts`: Friends + pending requests + blocked list
- `frontend/src/store/chat.ts`: Conversations + messages
- `frontend/src/store/notifications.ts`: Notification inbox + unread count

**Testing:**
- `backend/tests/`: pytest suite (backend only)

## Naming Conventions

**Files (backend):**
- Models: `{domain}.py` (noun, singular or plural group) — `user.py`, `social.py`, `bet.py`
- Services: `{domain}_service.py` — `friend_service.py`, `notification_service.py`
- Routes: `{domain}.py` (matches API tag) — `friends.py`, `notifications.py`
- Schemas: `{domain}.py` — `friends.py`, `chat.py`

**Files (frontend):**
- Stores: `{domain}.ts` — `friends.ts`, `notifications.ts`
- Components: `PascalCase.tsx` — `NotificationBell.tsx`, `AuthBootstrap.tsx`
- Pages: `page.tsx` (Next.js convention)
- Lib helpers: `{domain}.ts` — `api.ts`, `types.ts`, `friends-types.ts`

**Directories:**
- Backend: `snake_case/`
- Frontend app routes: `kebab-case/` (Next.js convention); route groups in `(parentheses)`

## Where to Add New Code

**New API domain (backend):**
1. Model: add classes to an existing `backend/app/db/models/{domain}.py` or create a new file
2. Schema: create `backend/app/schemas/{domain}.py`
3. Service: create `backend/app/services/{domain}_service.py`
4. Router: create `backend/app/api/routes/{domain}.py`, register in `backend/app/main.py`
5. Migration: `uv run alembic revision --autogenerate -m "description"`

**New frontend page:**
1. Create `frontend/src/app/(protected)/{route}/page.tsx` (for authenticated pages)
2. If the page needs state, create `frontend/src/store/{domain}.ts`
3. Add nav link to `frontend/src/components/nav/TopNav.tsx`

**New notification type:**
1. Add a `notify_{event}` helper in `backend/app/services/notification_service.py`
2. Call it from the relevant service (fire-and-forget inside `try/except`)
3. Add a display label in `frontend/src/components/NotificationBell.tsx` `TYPE_LABELS` dict

**New shared UI component:**
- Add to `frontend/src/components/` as `PascalCase.tsx`

**New background task:**
- Add task function to `backend/app/workers/tasks/` (existing or new file)
- Register schedule in `celery_app.conf.beat_schedule` in `backend/app/workers/celery_app.py`

## Special Directories

**`backend/keys/`:**
- Purpose: JWT RSA private/public key pair for token signing
- Generated: Manually (not committed); required at runtime
- Committed: No (git-ignored)

**`nginx/ssl/`:**
- Purpose: TLS certificate (`cert.pem`) and key (`key.pem`) for HTTPS
- Generated: Manually (self-signed for dev); required at runtime
- Committed: No (git-ignored)

**`backend/alembic/versions/`:**
- Purpose: Sequential DB migration scripts
- Generated: Via `uv run alembic revision --autogenerate`
- Committed: Yes — all migration files are committed

**`frontend/.next/`:**
- Purpose: Next.js build output
- Generated: By `next build`
- Committed: No

**`.planning/`:**
- Purpose: GSD workflow planning artifacts (codebase docs, phase plans)
- Generated: By GSD map-codebase and plan-phase commands
- Committed: Yes

---

*Structure analysis: 2026-03-28*
