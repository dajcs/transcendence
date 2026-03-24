# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
transcendence/
├── .env.example                    # Template for required environment variables
├── .env                            # git-ignored, contains secrets
├── docker-compose.yml              # Single command to start all services
├── README.md                        # Project overview and quick start
├── CLAUDE.md                        # Guidance for Claude Code (this repo)
├── LICENSE                         # MIT or compatible
├── .gitignore                      # Git ignore rules
├── .github/                        # GitHub workflows (CI/CD when added)
├── .planning/
│   └── codebase/
│       ├── ARCHITECTURE.md         # This layer's architecture patterns
│       ├── STRUCTURE.md            # This file
│       ├── CONVENTIONS.md          # Coding style and naming conventions
│       ├── TESTING.md              # Test patterns and setup
│       ├── STACK.md                # Technology stack details
│       ├── INTEGRATIONS.md         # External service integrations
│       └── CONCERNS.md             # Technical debt and known issues
├── .subject/
│   └── transcendence_v21.0.md      # 42 school project specification
├── plan/
│   ├── TECH.md                     # Tech stack and module targets
│   ├── PLANNING.md                 # Full project plan (architecture, database, API)
│   └── WORKFLOW.md                 # Development workflow and processes
├── nginx/
│   ├── nginx.conf                  # Nginx reverse proxy configuration
│   ├── Dockerfile                  # Nginx container image
│   └── certs/
│       ├── cert.pem                # Self-signed certificate (development)
│       └── key.pem                 # Private key (development)
├── frontend/
│   ├── Dockerfile                  # Next.js container image
│   ├── package.json                # npm dependencies and scripts
│   ├── package-lock.json           # npm lockfile
│   ├── next.config.ts              # Next.js configuration
│   ├── tsconfig.json               # TypeScript compiler options
│   ├── tailwind.config.ts          # Tailwind CSS theme configuration
│   ├── .eslintrc.json              # ESLint rules (if added)
│   ├── .prettierrc                 # Prettier formatting config (if added)
│   ├── public/
│   │   ├── favicon.ico             # Browser tab icon
│   │   ├── robots.txt              # SEO crawling rules
│   │   └── locales/                # i18n translation files
│   │       ├── en/
│   │       │   ├── common.json     # Shared translations
│   │       │   ├── home.json       # Home page translations
│   │       │   ├── markets.json    # Markets page translations
│   │       │   └── ...
│   │       ├── fr/
│   │       └── de/
│   └── src/
│       ├── app/                    # Next.js App Router
│       │   ├── layout.tsx          # Root layout (header, sidebar, footer)
│       │   ├── page.tsx            # Home / feed page
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   │   └── page.tsx    # Login page
│       │   │   ├── register/
│       │   │   │   └── page.tsx    # Registration page
│       │   │   └── oauth/
│       │   │       └── [provider]/callback/
│       │   │           └── page.tsx # OAuth callback handler
│       │   ├── markets/
│       │   │   ├── page.tsx        # Markets list/browse page
│       │   │   ├── new/
│       │   │   │   └── page.tsx    # Create new market form
│       │   │   └── [id]/
│       │   │       └── page.tsx    # Market detail (bet interface + discussion thread)
│       │   ├── profile/
│       │   │   └── [username]/
│       │   │       └── page.tsx    # User profile page
│       │   ├── dashboard/
│       │   │   └── page.tsx        # Personal dashboard (active bets, portfolio, notifications)
│       │   ├── chat/
│       │   │   └── page.tsx        # Direct messaging interface
│       │   ├── friends/
│       │   │   └── page.tsx        # Friend list and online status
│       │   ├── leaderboard/
│       │   │   └── page.tsx        # Top users by Truth score
│       │   ├── settings/
│       │   │   └── page.tsx        # Account settings (language, notifications, privacy)
│       │   ├── privacy/
│       │   │   └── page.tsx        # Privacy Policy (required by 42)
│       │   ├── terms/
│       │   │   └── page.tsx        # Terms of Service (required by 42)
│       │   ├── error.tsx           # Error boundary
│       │   ├── loading.tsx         # Loading skeleton
│       │   └── not-found.tsx       # 404 page
│       ├── components/
│       │   ├── ui/                 # Reusable primitives
│       │   │   ├── Button.tsx      # Button variant (primary, secondary, danger)
│       │   │   ├── Input.tsx       # Text input with validation styling
│       │   │   ├── Card.tsx        # Card container
│       │   │   ├── Modal.tsx       # Modal dialog
│       │   │   ├── Badge.tsx       # Status/tag badge
│       │   │   ├── Avatar.tsx      # User avatar image
│       │   │   ├── Spinner.tsx     # Loading spinner
│       │   │   ├── Toast.tsx       # Toast notification
│       │   │   ├── Select.tsx      # Dropdown select
│       │   │   └── ...
│       │   ├── market/             # Market-specific components
│       │   │   ├── MarketCard.tsx  # Market preview card (feed)
│       │   │   ├── BetSlider.tsx   # Bet amount/odds slider
│       │   │   ├── ResolutionPanel.tsx # Resolution controls (for proposer)
│       │   │   ├── OddsDisplay.tsx # Live YES/NO odds
│       │   │   └── ...
│       │   ├── chat/               # Chat-specific components
│       │   │   ├── ChatWindow.tsx  # Chat container
│       │   │   ├── MessageBubble.tsx # Single message UI
│       │   │   ├── InputBox.tsx    # Message input
│       │   │   └── ...
│       │   ├── layout/             # Layout components
│       │   │   ├── Header.tsx      # Navigation header
│       │   │   ├── Sidebar.tsx     # Left sidebar with nav
│       │   │   ├── Footer.tsx      # Page footer
│       │   │   └── ...
│       │   ├── profile/            # User profile components
│       │   │   ├── StatsCard.tsx   # Karma/Truth/Spice display
│       │   │   ├── BetHistory.tsx  # User's past bets
│       │   │   ├── FriendsList.tsx # Friends panel
│       │   │   └── ...
│       │   └── ...
│       ├── hooks/                  # Custom React hooks
│       │   ├── useAuth.ts          # Auth state and login/logout
│       │   ├── useMarkets.ts       # Fetch and cache markets
│       │   ├── useSocket.ts        # Socket.IO connection wrapper
│       │   ├── useNotifications.ts # Toast notification queue
│       │   ├── useUser.ts          # Current user profile data
│       │   └── ...
│       ├── lib/
│       │   ├── api.ts              # Axios/fetch client with base URL, auth headers
│       │   ├── socket.ts           # Socket.IO client singleton
│       │   ├── utils.ts            # Utility functions (format, validate, etc.)
│       │   └── ...
│       ├── stores/                 # Zustand stores (global state)
│       │   ├── authStore.ts        # Auth token, current user
│       │   ├── uiStore.ts          # Theme, sidebar open/closed
│       │   ├── notificationStore.ts # Toast queue
│       │   ├── marketStore.ts      # Cached market data
│       │   └── ...
│       ├── types/                  # TypeScript type definitions
│       │   ├── index.ts            # Re-export all types
│       │   ├── user.ts             # User, Profile, Friend
│       │   ├── market.ts           # Market, Bet, Comment, Resolution
│       │   ├── api.ts              # API request/response shapes
│       │   └── ...
│       └── styles/
│           ├── globals.css         # Tailwind @import, custom utilities
│           └── ...
├── backend/
│   ├── Dockerfile                  # FastAPI container image
│   ├── pyproject.toml              # uv project config, dependencies, metadata
│   ├── uv.lock                     # uv lockfile (reproducible dependencies)
│   ├── alembic.ini                 # Alembic (database migration) configuration
│   ├── alembic/
│   │   ├── env.py                  # Migration environment setup
│   │   ├── script.py.mako          # Migration template
│   │   └── versions/
│   │       ├── 001_initial_schema.py  # First migration (create tables)
│   │       ├── 002_add_notifications.py
│   │       └── ...
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point, middleware, route mounting
│   │   ├── config.py               # Settings class, environment variable loading
│   │   ├── database.py             # SQLAlchemy async engine, session factory
│   │   ├── models/
│   │   │   ├── __init__.py         # Re-export all models
│   │   │   ├── user.py             # User model (credentials, profile, karma, truth)
│   │   │   ├── market.py           # Market model (question, terms, deadline, status)
│   │   │   ├── bet.py              # Bet model (user position, amount, timestamp)
│   │   │   ├── comment.py          # Comment model (threaded discussion)
│   │   │   ├── friendship.py       # Friendship model (friend relationship)
│   │   │   ├── notification.py     # Notification model (user notifications)
│   │   │   ├── chat.py             # ChatMessage model (direct messages)
│   │   │   ├── bet_settlement.py   # BetSettlement model (resolution payouts)
│   │   │   ├── community_vote.py   # CommunityVote model (dispute resolution voting)
│   │   │   └── ...
│   │   ├── schemas/
│   │   │   ├── __init__.py         # Re-export all schemas
│   │   │   ├── user.py             # UserCreate, UserResponse, ProfileUpdate
│   │   │   ├── market.py           # MarketCreate, MarketResponse, MarketUpdate
│   │   │   ├── bet.py              # BetCreate, BetResponse
│   │   │   ├── comment.py          # CommentCreate, CommentResponse
│   │   │   ├── chat.py             # ChatMessageCreate, ChatMessageResponse
│   │   │   └── ...
│   │   ├── routers/
│   │   │   ├── __init__.py         # Router aggregation
│   │   │   ├── auth.py             # POST /api/auth/login, /register, /refresh, /oauth/{provider}
│   │   │   ├── users.py            # GET/PUT /api/users/{id}, POST /api/users/{id}/avatar
│   │   │   ├── markets.py          # GET/POST /api/markets/, GET /api/markets/{id}, PUT /resolve
│   │   │   ├── bets.py             # POST /api/markets/{id}/bets, GET /api/users/{id}/bets
│   │   │   ├── comments.py         # POST /api/markets/{id}/comments, POST /api/comments/{id}/vote
│   │   │   ├── chat.py             # POST /api/chat/{user_id}/messages, GET /api/chat/{user_id}
│   │   │   ├── friends.py          # POST /api/friends/add, DELETE /api/friends/{id}
│   │   │   ├── notifications.py    # GET /api/notifications, PUT /api/notifications/{id}/read
│   │   │   ├── llm.py              # POST /api/llm/summarize, /resolve_hint
│   │   │   └── health.py           # GET /api/health (liveness check)
│   │   ├── services/
│   │   │   ├── __init__.py         # Service aggregation
│   │   │   ├── auth.py             # AuthService: login, register, OAuth, token validation
│   │   │   ├── user.py             # UserService: profile CRUD, friendship logic
│   │   │   ├── market.py           # MarketService: market CRUD, odds calculation
│   │   │   ├── betting.py          # BettingService: place bet, validate position, update pools
│   │   │   ├── resolution.py       # ResolutionService: resolve market, settle bets, distribute karma
│   │   │   ├── karma.py            # KarmaService: calculate karma changes, update user scores
│   │   │   ├── chat.py             # ChatService: message storage and retrieval
│   │   │   ├── notification.py     # NotificationService: create and dispatch notifications
│   │   │   ├── llm.py              # LLMService: call OpenRouter API for market summaries, resolution hints
│   │   │   └── ...
│   │   ├── socket/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py          # SocketManager: initialize Socket.IO namespace, middleware
│   │   │   └── events.py           # Event handlers: @sio.event decorators for all real-time events
│   │   ├── tasks/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py       # Celery app initialization, broker/backend config
│   │   │   ├── resolution.py       # Celery tasks: resolve_market, settle_bets
│   │   │   ├── notifications.py    # Celery tasks: send_notification, dispatch_notifications
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── security.py         # JWT encode/decode, password hash/verify, OAuth validation
│   │   │   ├── openrouter.py       # OpenRouter HTTP client, prompt formatting
│   │   │   ├── decorators.py       # @require_auth, @require_role, @rate_limit
│   │   │   └── ...
│   │   └── middleware.py           # CORS, auth, error handling middleware
│   └── tests/
│       ├── conftest.py             # pytest fixtures (db session, client, auth tokens)
│       ├── test_auth.py            # Auth endpoint tests
│       ├── test_markets.py         # Market CRUD and odds tests
│       ├── test_bets.py            # Betting logic tests
│       ├── test_resolution.py      # Market resolution and settlement tests
│       └── ...
└── tests/
    └── ...                         # E2E tests (if added)
```

## Directory Purposes

**`nginx/`:**
- Purpose: Reverse proxy and HTTPS termination
- Contains: Nginx configuration, self-signed certificates for development
- Key files: `nginx.conf` (routing rules), `certs/` (TLS certificates)

**`frontend/`:**
- Purpose: User-facing web application built with Next.js 15 and React 19
- Contains: Next.js App Router pages, React components, TypeScript types, Zustand stores, styling
- Key files: `next.config.ts` (Next.js settings), `tsconfig.json` (TypeScript config), `tailwind.config.ts` (design tokens)

**`frontend/src/app/`:**
- Purpose: Next.js App Router structure mapping URL routes to React pages
- Contains: Root layout, route segments (groups, dynamic routes), error boundaries
- Pattern: Directories with `page.tsx` are routes; `(auth)` is a non-URL route group

**`frontend/src/components/`:**
- Purpose: Reusable React components organized by domain
- Subdirectories: `ui/` (primitives), `market/` (market-specific), `chat/`, `layout/`, `profile/`

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks encapsulating API calls, Socket.IO listeners, state logic
- Examples: `useAuth` (manage login/logout), `useSocket` (connect and listen to WebSocket), `useMarkets` (fetch and cache)

**`frontend/src/stores/`:**
- Purpose: Zustand global state stores avoiding prop drilling
- Examples: `authStore` (current user, token), `marketStore` (cached market data), `uiStore` (theme, sidebar)

**`frontend/src/lib/`:**
- Purpose: Utility functions and client initialization
- Contains: API client setup, Socket.IO client singleton, helper functions

**`frontend/src/types/`:**
- Purpose: TypeScript type definitions shared across components
- Contains: Domain types (User, Market, Bet), API request/response shapes

**`backend/`:**
- Purpose: FastAPI REST API and WebSocket server
- Contains: Route handlers, business logic services, database models, background tasks
- Key files: `main.py` (app entry point), `config.py` (environment setup), `database.py` (SQLAlchemy setup)

**`backend/app/models/`:**
- Purpose: SQLAlchemy ORM models mapping to database tables
- Pattern: One file per entity (user.py, market.py, bet.py, etc.)
- Contains: Column definitions, relationships, validation, computed properties

**`backend/app/schemas/`:**
- Purpose: Pydantic 2 schemas for request/response validation and OpenAPI documentation
- Pattern: Multiple schemas per entity (e.g., UserCreate, UserResponse, UserUpdate)
- Used by: Route handlers to validate input and serialize output

**`backend/app/routers/`:**
- Purpose: FastAPI route handlers organized by resource domain
- Pattern: One router file per resource (auth.py, users.py, markets.py, etc.)
- Contains: @router.get/@router.post decorators, request validation, response formatting, delegation to services

**`backend/app/services/`:**
- Purpose: Business logic layer isolating domain operations from HTTP concerns
- Pattern: One service per major domain (AuthService, MarketService, BettingService, etc.)
- Contains: Core algorithms (odds calculation, karma distribution), database queries, external API calls

**`backend/app/socket/`:**
- Purpose: Socket.IO WebSocket event handlers for real-time communication
- Files: `manager.py` (initialization and middleware), `events.py` (event handlers)
- Pattern: @sio.event decorators for namespaced rooms (e.g., `market:{id}`, `chat:{user_id}`)

**`backend/app/tasks/`:**
- Purpose: Celery background job definitions
- Pattern: One module per task type (resolution.py, notifications.py)
- Contains: @celery_app.task decorated functions for async execution

**`backend/app/utils/`:**
- Purpose: Shared utility modules and helpers
- Contains: Security (JWT, bcrypt), external API clients (OpenRouter), decorators, validators

**`backend/alembic/`:**
- Purpose: Database schema version control via Alembic migrations
- Files: `versions/` contains timestamped migration files (e.g., `001_initial_schema.py`)
- Pattern: Each migration is reversible (upgrade/downgrade functions)

**`backend/tests/`:**
- Purpose: Test suite for backend functionality
- Pattern: `test_*.py` files mirror `app/routers/` or `app/services/`
- Contains: pytest tests with fixtures (db session, authenticated client)

**`plan/`:**
- Purpose: Project planning and documentation
- Files: `TECH.md` (tech stack), `PLANNING.md` (full architecture and database schema), `WORKFLOW.md` (development processes)

**`.planning/codebase/`:**
- Purpose: Generated codebase analysis documents
- Files: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `STACK.md`, `INTEGRATIONS.md`, `CONCERNS.md`

## Key File Locations

**Entry Points:**
- `frontend/src/app/page.tsx`: React home page component (landing, market feed)
- `frontend/src/app/layout.tsx`: Root layout (header, sidebar, providers)
- `backend/app/main.py`: FastAPI application initialization (routers, middleware, Socket.IO mount)
- `nginx/nginx.conf`: Nginx configuration (reverse proxy rules, SSL setup)

**Configuration:**
- `.env.example`: Template for required environment variables
- `.env`: git-ignored file containing secrets (DATABASE_URL, OPENROUTER_API_KEY, etc.)
- `frontend/next.config.ts`: Next.js settings (redirects, headers, i18n config)
- `backend/app/config.py`: Pydantic settings class loading environment variables
- `docker-compose.yml`: Service definitions (frontend, backend, postgres, redis, nginx)

**Core Logic:**
- `backend/app/services/market.py`: Market creation, odds calculation, listing
- `backend/app/services/betting.py`: Bet placement, position validation, pool updates
- `backend/app/services/resolution.py`: Market resolution, settlement, karma distribution
- `backend/app/services/llm.py`: OpenRouter API integration for summarization and hints

**Authentication:**
- `backend/app/routers/auth.py`: Login, register, OAuth callback, token refresh endpoints
- `backend/app/utils/security.py`: JWT encoding/decoding, password hashing, OAuth validation
- `frontend/src/hooks/useAuth.ts`: Auth state hook, login/logout/register
- `frontend/src/stores/authStore.ts`: Global auth state (token, user, loading)

**Real-time:**
- `backend/app/socket/events.py`: Socket.IO event handlers (bet_placed, market_updated, new_message, etc.)
- `frontend/src/hooks/useSocket.ts`: Socket.IO connection and event listener wrapper
- `frontend/src/stores/notificationStore.ts`: Toast notification queue managed via Socket.IO

**Database:**
- `backend/app/database.py`: SQLAlchemy async engine, session factory
- `backend/app/models/user.py`: User entity (credentials, profile, karma, truth, spice)
- `backend/app/models/market.py`: Market entity (question, pools, deadline, resolution status)
- `backend/alembic/env.py`: Migration environment configuration

**Testing:**
- `backend/tests/conftest.py`: pytest fixtures (in-memory database, test client, auth tokens)
- `backend/tests/test_markets.py`: Market endpoint and service tests
- `backend/tests/test_bets.py`: Betting logic tests
- `backend/tests/test_resolution.py`: Resolution and settlement tests

**Styling:**
- `frontend/tailwind.config.ts`: Design tokens (colors, typography, spacing)
- `frontend/src/styles/globals.css`: Tailwind directives and custom utilities

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `MarketCard.tsx`, `BetSlider.tsx`)
- Next.js pages: lowercase with slashes (e.g., `app/markets/page.tsx`, `app/profile/[username]/page.tsx`)
- Python modules: snake_case (e.g., `auth.py`, `market.py`, `bet_service.py`)
- Utilities: lowercase with underscores (e.g., `security.py`, `openrouter.py`)
- Tests: `test_*.py` or `*_test.py` (e.g., `test_markets.py`)

**Directories:**
- Frontend: lowercase with underscores (e.g., `src/components/`, `src/hooks/`, `src/stores/`)
- Backend: lowercase with underscores (e.g., `app/models/`, `app/routers/`, `app/services/`)
- Logical groups: lowercase (e.g., `app/utils/`, `backend/tests/`)

## Where to Add New Code

**New Feature (e.g., Leaderboard):**
- Frontend page: `frontend/src/app/leaderboard/page.tsx`
- Frontend component: `frontend/src/components/leaderboard/LeaderboardTable.tsx`
- Frontend hook: `frontend/src/hooks/useLeaderboard.ts` (fetch data)
- Backend router: `backend/app/routers/leaderboard.py` (`GET /api/leaderboard`)
- Backend service: `backend/app/services/leaderboard.py` (calculate rankings)
- Tests: `backend/tests/test_leaderboard.py`

**New Component/Module (e.g., Dispute Resolution UI):**
- Component: `frontend/src/components/market/DisputePanel.tsx`
- Hook: `frontend/src/hooks/useDispute.ts` (API calls, Socket.IO listeners)
- Model: `backend/app/models/community_vote.py` (if not exists)
- Schema: `backend/app/schemas/vote.py`
- Router: `backend/app/routers/disputes.py` (or extend `markets.py`)
- Service: `backend/app/services/resolution.py` (extend with dispute logic)

**Utilities:**
- Shared helpers: `frontend/src/lib/utils.ts` (format, validate functions)
- Shared types: `frontend/src/types/` (domain types and API shapes)
- Backend utilities: `backend/app/utils/` (create new file if > 100 LOC)

**Database Changes:**
1. Modify model in `backend/app/models/*.py`
2. Create migration: `alembic revision --autogenerate -m "add_field"`
3. Review and edit migration in `backend/alembic/versions/`
4. Test: `uv run alembic upgrade head`

## Special Directories

**`frontend/public/locales/`:**
- Purpose: i18n translation files (EN, FR, DE)
- Generated: No (manually edited JSON files)
- Committed: Yes
- Pattern: `locales/{lang}/{domain}.json` (e.g., `en/markets.json`, `fr/markets.json`)

**`backend/alembic/versions/`:**
- Purpose: Database migration history
- Generated: Partially (scaffold via `alembic revision`, edit manually)
- Committed: Yes (migrations are code)
- Pattern: Timestamped files (e.g., `20260324_001_initial_schema.py`)

**`frontend/.next/` (not shown in structure above):**
- Purpose: Next.js build output
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**`backend/__pycache__/`, `.pytest_cache/` (not shown above):**
- Purpose: Python cache files
- Generated: Yes (automatically)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-03-24*
