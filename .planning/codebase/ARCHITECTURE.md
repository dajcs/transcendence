# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Microservices-inspired distributed architecture with clear separation between stateless API backend, real-time WebSocket layer, frontend SPA, and async task processing.

**Key Characteristics:**
- **Frontend-backend decoupling**: Next.js frontend and FastAPI backend communicate via REST API + WebSocket (Socket.IO)
- **Async-first**: All I/O operations use async patterns (asyncpg, redis-py, httpx)
- **Event-driven real-time**: Socket.IO provides real-time market updates, chat, and notifications
- **Background job queue**: Celery handles scheduled tasks (market resolution, API polling, notifications)
- **State separation**: Session/cache in Redis, persistent data in PostgreSQL, transient state in Zustand/Zustand stores

## Layers

**Presentation (Frontend):**
- Purpose: User-facing web interface with real-time updates
- Location: `frontend/src/`
- Contains: React 19 components, pages (App Router), hooks, stores (Zustand), API client, Socket.IO client
- Depends on: Backend REST API, Socket.IO WebSocket endpoint
- Used by: Web browsers (Chrome)

**API Gateway / Reverse Proxy:**
- Purpose: HTTPS termination, static file serving, request routing
- Location: `nginx/nginx.conf`
- Contains: Nginx configuration, self-signed certificates for development
- Depends on: Nothing
- Used by: All external traffic (browsers, clients)

**Business Logic API:**
- Purpose: REST API endpoints for all core operations (auth, markets, bets, comments, chat)
- Location: `backend/app/routers/`, `backend/app/services/`
- Contains: Route handlers (FastAPI routers), business service classes
- Depends on: Database, Redis, Celery, OpenRouter API
- Used by: Frontend, Socket.IO event handlers, Celery tasks

**Real-time Communication:**
- Purpose: WebSocket server for live updates (market movements, chat, friend activity, notifications)
- Location: `backend/app/socket/`
- Contains: Socket.IO event handlers, namespace management, room broadcasting
- Depends on: Database, Redis (for pub/sub across workers)
- Used by: Frontend Socket.IO client, web browsers

**Data Access (ORM):**
- Purpose: Data persistence with type-safe queries
- Location: `backend/app/models/`, `backend/app/database.py`
- Contains: SQLAlchemy 2 models (User, Market, Bet, Comment, etc.), session management, async engine
- Depends on: PostgreSQL via asyncpg
- Used by: Routers, services, Socket.IO handlers, Celery tasks

**Background Jobs:**
- Purpose: Async task processing for time-consuming or scheduled operations
- Location: `backend/app/tasks/`
- Contains: Celery tasks for market resolution, notification delivery, API data fetching
- Depends on: Redis (message broker), Database, OpenRouter API
- Used by: Services that need async execution

**Authentication & Security:**
- Purpose: User identity verification, authorization, OAuth integration
- Location: `backend/app/utils/security.py`, `backend/app/routers/auth.py`
- Contains: JWT token generation/validation, password hashing (bcrypt), OAuth 2.0 flows (Google, GitHub, 42)
- Depends on: Database (user lookups), external OAuth providers
- Used by: All routers via middleware, Socket.IO connection handlers

**LLM Interface:**
- Purpose: External API calls to OpenRouter for market summarization, resolution assistance, chat enhancement
- Location: `backend/app/utils/openrouter.py`, `backend/app/services/llm.py`
- Contains: OpenRouter client wrapper, prompt engineering, response parsing
- Depends on: OpenRouter API via httpx
- Used by: Routers (market detail), services (resolution), Socket.IO handlers (chat)

## Data Flow

**User Login Flow:**
1. Frontend submits credentials or OAuth token to `POST /api/auth/login`
2. Auth router validates credentials or verifies OAuth with external provider
3. Auth service generates JWT access + refresh tokens
4. Frontend stores tokens in secure storage, adds to subsequent requests
5. Backend validates JWT on each request via middleware
6. Socket.IO connection validates token handshake, maintains authenticated socket

**Market Creation & Betting:**
1. User submits market form via frontend
2. `POST /api/markets/` receives request with market details
3. Market service creates Market record in PostgreSQL
4. Market service publishes "market_created" event via Socket.IO broadcast
5. All connected clients receive real-time update via `on_market_created` handler
6. User places bet: `POST /api/markets/{id}/bets/`
7. Betting service validates position (prevents duplicate bets), updates pools
8. Bet recorded in PostgreSQL, probability recalculated
9. Socket.IO broadcasts `bet_placed` event to all market subscribers
10. All users see live odds update in real-time

**Market Resolution:**
1. Resolution deadline reached (timestamp check)
2. Celery task `resolve_market` triggers (scheduled or event-driven)
3. Resolution service attempts automatic resolution (API data lookup)
4. If manual resolution needed: proposer views `PUT /api/markets/{id}/resolve` endpoint
5. On resolution, settlement service calculates payouts, updates user karma/truth scores
6. Socket.IO broadcasts `market_resolved` event
7. Affected users receive notification via Celery task → notification service → Socket.IO

**Real-time Chat:**
1. User connects Socket.IO, joins chat room (e.g., `chat:user_id`)
2. Sends message via Socket.IO event `send_message`
3. Socket.IO handler validates, stores message in PostgreSQL (via ORM)
4. Broadcasts `new_message` event to room subscribers
5. All connected browsers in chat receive update instantly

**State Management:**

**Frontend state (Zustand stores):**
- User auth state (token, profile)
- Current market details (prices, bets)
- Chat messages (paginated window)
- Friend list / online status
- Notifications (toast queue)

**Backend state (Redis):**
- Session tokens (for revocation)
- WebSocket room membership (pub/sub for multi-worker deployments)
- Rate-limit counters
- Cache: market summaries (LLM results), user stats

**Persistent state (PostgreSQL):**
- All user data (profiles, credentials, relationships)
- All markets, bets, comments, settlements
- Chat message history
- Notification records
- Friendship records

## Key Abstractions

**Market:**
- Purpose: Core betting entity; represents a prediction question with YES/NO binary outcome
- Examples: `backend/app/models/market.py`, `backend/app/schemas/market.py`, `backend/app/services/market.py`
- Pattern: SQLAlchemy model + Pydantic schema + service layer for business logic

**Bet:**
- Purpose: User's position in a market (YES or NO for a given amount)
- Examples: `backend/app/models/bet.py`, `backend/app/routers/bets.py`
- Pattern: One bet per user per market; immutable once placed; settlement happens after resolution

**User Reputation (Karma, Truth, Spice):**
- Purpose: Quantify user influence and track record
- Examples: `backend/app/services/karma.py`, user model fields (karma, truth_score, spice)
- Pattern: Karma increased by comment upvotes, used to cap bet sizes via log(karma); Truth tracks forecast accuracy; Spice is Phase 2 real-money signal

**Comment / Discussion Thread:**
- Purpose: Discourse layer on top of markets; enables evidence presentation and debate
- Examples: `backend/app/models/comment.py`, comment voting system
- Pattern: Threaded tree structure (parent_id for nesting); upvotes influence user karma

**WebSocket Room (Socket.IO):**
- Purpose: Pub/sub namespace for broadcasting real-time updates
- Examples: `backend/app/socket/events.py` (market rooms, chat rooms, notification rooms)
- Pattern: Rooms named by entity (e.g., `market:{id}`, `chat:{user_id}`); event-based messaging

## Entry Points

**Frontend:**
- Location: `frontend/src/app/page.tsx` (home/landing)
- Triggers: User opens https://localhost:8443 in browser
- Responsibilities: Render landing page, feed of active markets, auth redirects; hydrate Zustand stores from API; connect Socket.IO

**Backend API:**
- Location: `backend/app/main.py`
- Triggers: Nginx forwards requests to backend:8000
- Responsibilities: FastAPI app initialization, middleware setup, route registration, database connection pooling, Socket.IO mount

**Socket.IO Server:**
- Location: `backend/app/main.py` (mounted on FastAPI ASGI app), `backend/app/socket/events.py`
- Triggers: Frontend `socket.connect()` after auth
- Responsibilities: Handle WebSocket handshake, authenticate client, manage room subscriptions, broadcast real-time events

**Background Jobs:**
- Location: `backend/app/tasks/resolution.py`, `backend/app/tasks/notifications.py`
- Triggers: Celery beat schedule or service layer enqueues tasks
- Responsibilities: Execute long-running operations asynchronously (market resolution, notification dispatch)

## Error Handling

**Strategy:** Three-tier approach

**Frontend:**
- API error responses captured in try-catch, displayed as toast notifications
- Validation errors from Zod schemas show inline feedback
- Network errors trigger retry logic with exponential backoff

**Backend REST API:**
- FastAPI auto-generates HTTP status codes (400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error)
- Pydantic validation failures return 422 Unprocessable Entity with field errors
- Custom exception handlers in `backend/app/main.py` translate domain errors to HTTP responses

**Socket.IO Events:**
- Event handlers wrap in try-catch, send error event back to client (e.g., `error: {code, message}`)
- No connection crash on event error (resilient)

**Patterns:**
- Explicit error types: `ValidationError`, `AuthenticationError`, `NotFoundError`, `ConflictError`
- Stack traces logged to stderr for debugging; never sent to client
- Rate limiting errors (429) trigger client-side backoff

## Cross-Cutting Concerns

**Logging:**
- Backend: Python logging module, structured JSON output for production
- Frontend: console.log (Chrome DevTools), bundled in production (no PII)
- Socket.IO: event logging via FastAPI middleware

**Validation:**
- Frontend: Zod schemas (React Hook Form integration)
- Backend: Pydantic 2 schemas (auto OpenAPI documentation)
- Database: PostgreSQL constraints (UNIQUE, NOT NULL, foreign keys)

**Authentication:**
- JWT access tokens (30 min expiry) + refresh tokens (7 day expiry)
- Refresh endpoint `POST /api/auth/refresh` issues new access token
- Socket.IO validates JWT on connection handshake
- OAuth flows redirect to `/api/auth/oauth/{provider}/callback`

**Authorization:**
- Role-based access control (user can only modify own profile, proposer can resolve own markets)
- Middleware checks ownership before allowing PUT/DELETE operations
- Community vote requires 1% participation (hardcoded threshold)

**Caching:**
- Redis stores: session tokens, rate-limit counters, LLM result cache
- Cache invalidation on data mutation (service layer responsibility)
- TTL: 1 hour for LLM results, 7 days for user session

---

*Architecture analysis: 2026-03-24*
