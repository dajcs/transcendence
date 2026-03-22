# Vox Populi — Project Planning

## 1. Project Vision

Vox Populi is a reputation-based prediction market where **being right matters more than being rich**. Users create and bet on predictions using platform-native points (Karma, Truth, Spice). Every bet doubles as a discussion thread with tiered resolution (automatic, proposer, community vote).

The platform solves real problems with money-driven prediction markets: capital distortion, whale manipulation, and toxic resolution disputes. By making reputation the primary currency, Vox aligns incentives toward truth-seeking and quality discourse.

### Key Differentiators
- **Human-only**: No bots, no automation
- **Reputation economy**: Karma (influence) + Truth (track record) + Spice (Phase 2 skin-in-the-game)
- **Log-scale bet cap**: `max_position = log(karma)` prevents domination
- **Bets = Discussions**: Every market is a thread with arguments for/against
- **Tiered resolution**: Auto > Proposer > Community vote

---

## 2. User Experience

### 2.1 User Flows

**New User:**
1. Land on home page → see active/trending markets
2. Sign up (email/password or OAuth)
3. Receive initial Karma allocation (e.g., 100 Karma)
4. Browse markets → read discussion threads
5. Place first bet → join the discussion
6. Earn Karma via upvotes on comments

**Returning User:**
1. Dashboard shows: active bets, notifications, portfolio summary
2. Create new market → define terms, resolution criteria, deadline
3. Participate in resolution disputes via community vote
4. Track Truth score over time

**Market Lifecycle:**
1. **Created** → Proposer defines question, terms, resolution criteria, deadline
2. **Active** → Users bet YES/NO, discuss in thread, provide evidence
3. **Pending Resolution** → Deadline reached, resolution process begins
4. **Resolved** → Points distributed, Truth scores updated
5. **Disputed** → Community vote triggered if resolution contested

### 2.2 Key Pages

| Page | Purpose |
|---|---|
| **Home / Feed** | Trending markets, recent activity, categories |
| **Market Detail** | Bet interface + discussion thread + resolution status |
| **Create Market** | Form to define question, terms, criteria, deadline |
| **Profile** | User stats (Karma, Truth, Spice), bet history, achievements |
| **Dashboard** | Personal active bets, notifications, portfolio |
| **Friends** | Friend list, online status, activity |
| **Chat** | Direct messaging between users |
| **Leaderboard** | Top users by Truth score |
| **Settings** | Account, notifications, language, privacy |
| **Privacy Policy** | Required by 42 |
| **Terms of Service** | Required by 42 |

---

## 3. Visual Design / Color Scheme

### 3.1 Design Philosophy
- **Clean, information-dense**: Markets need clear data presentation
- **Trust-inspiring**: Muted, professional palette — not flashy
- **Accessible**: WCAG-friendly contrast ratios

### 3.2 Color Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| **Primary** | Deep Indigo | `#4F46E5` | Actions, links, primary buttons |
| **Secondary** | Slate | `#475569` | Secondary text, borders |
| **Success / YES** | Emerald | `#10B981` | YES bets, positive outcomes, gains |
| **Danger / NO** | Rose | `#F43F5E` | NO bets, negative outcomes, losses |
| **Warning** | Amber | `#F59E0B` | Disputed markets, pending actions |
| **Background** | Near-white | `#F8FAFC` | Page background |
| **Surface** | White | `#FFFFFF` | Cards, panels |
| **Text Primary** | Slate 900 | `#0F172A` | Headings, body text |
| **Text Secondary** | Slate 500 | `#64748B` | Labels, metadata |
| **Karma** | Violet | `#8B5CF6` | Karma indicators |
| **Truth** | Cyan | `#06B6D4` | Truth score indicators |
| **Spice** | Orange | `#F97316` | Spice indicators (Phase 2) |

### 3.3 Typography
- **Headings**: Inter (bold, clean)
- **Body**: Inter (regular)
- **Monospace** (numbers/stats): JetBrains Mono

### 3.4 Dark Mode
Support dark mode via Tailwind's `dark:` variants. Dark background: `#0F172A`, dark surface: `#1E293B`.

---

## 4. Architecture Overview

```
                      ┌─────────────┐
                      │   Nginx     │ :8443 (HTTPS)
                      │  (reverse   │
                      │   proxy)    │
                      └──────┬──────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
       ┌────────▼──────┐     │     ┌──────▼──────────┐
       │  Next.js 15   │     │     │    FastAPI      │
       │  Frontend     │     │     │    REST API     │
       │  :3000        │     │     │    :8000        │
       └───────────────┘     │     └──┬─────┬─────┬──┘
                             │        │     │     │
                      ┌──────▼──┐     │     │     │
                      │Socket.IO│     │     │     │
                      │ (WS)    │─────┘     │     │
                      │ :8000   │           │     │
                      └─────────┘     ┌─────┘     └─────┐
                                      │                 │
                                ┌─────▼────┐      ┌─────▼────┐
                                │PostgreSQL│      │  Redis 7 │
                                │    16    │      │          │
                                └──────────┘      └─────┬────┘
                                                        │
                                                  ┌─────▼────┐
                                                  │  Celery  │
                                                  │  Worker  │
                                                  └──────────┘
```

Note: Socket.IO is hosted by the FastAPI backend (python-socketio mounted on the same ASGI app). Nginx proxies `/socket.io/` to backend:8000 with WebSocket upgrade.

### 4.1 Component Responsibilities

| Component | Role |
|---|---|
| **Nginx** | HTTPS termination, static files, reverse proxy to frontend/backend |
| **Next.js 15** | SSR landing pages, SPA for app, React 19 UI, Socket.IO client |
| **FastAPI** | REST API, WebSocket server (Socket.IO), auth, business logic |
| **PostgreSQL 16** | Primary data store — users, markets, bets, comments, friendships |
| **Redis 7** | Session cache, Socket.IO adapter (pub/sub), rate limiting, Celery broker |
| **Celery** | Background tasks: market resolution scheduling, API data polling, notifications |

### 4.2 Communication
- **Frontend ↔ Backend**: REST API (JSON) over HTTPS + Socket.IO for real-time
- **Backend ↔ DB**: SQLAlchemy 2 async (asyncpg driver)
- **Backend ↔ Redis**: redis-py async
- **Backend ↔ Celery**: Redis as message broker
- **LLM calls**: OpenRouter API via httpx (async)

---

## 5. Directory Structure

```
transcendence/
├── docker-compose.yml
├── .env.example
├── .env                        # git-ignored
├── nginx/
│   ├── nginx.conf
│   └── certs/                  # self-signed for dev
│       ├── cert.pem
│       └── key.pem
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── public/
│   │   └── locales/            # i18n translation files
│   │       ├── en/
│   │       ├── fr/
│   │       └── de/
│   └── src/
│       ├── app/                # Next.js App Router
│       │   ├── layout.tsx
│       │   ├── page.tsx        # Home / Feed
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── markets/
│       │   │   ├── page.tsx    # Market list
│       │   │   ├── new/
│       │   │   └── [id]/
│       │   ├── profile/
│       │   │   └── [username]/
│       │   ├── dashboard/
│       │   ├── chat/
│       │   ├── friends/
│       │   ├── leaderboard/
│       │   ├── settings/
│       │   ├── privacy/
│       │   └── terms/
│       ├── components/
│       │   ├── ui/             # Reusable primitives (Button, Input, Card, Modal, etc.)
│       │   ├── market/         # MarketCard, BetSlider, ResolutionPanel
│       │   ├── chat/           # ChatWindow, MessageBubble
│       │   ├── layout/         # Header, Sidebar, Footer
│       │   └── profile/        # Avatar, StatsCard, FriendsList
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # API client, socket client, utils
│       ├── stores/             # Zustand stores
│       └── types/              # TypeScript types
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml          # uv / project config
│   ├── uv.lock
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   └── app/
│       ├── main.py             # FastAPI app entry
│       ├── config.py           # Settings from env
│       ├── database.py         # SQLAlchemy engine + session
│       ├── models/             # SQLAlchemy models
│       │   ├── user.py
│       │   ├── market.py
│       │   ├── bet.py
│       │   ├── comment.py
│       │   ├── friendship.py
│       │   ├── notification.py
│       │   └── chat.py
│       ├── schemas/            # Pydantic schemas
│       │   ├── user.py
│       │   ├── market.py
│       │   ├── bet.py
│       │   └── ...
│       ├── routers/            # API route handlers
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── markets.py
│       │   ├── bets.py
│       │   ├── comments.py
│       │   ├── chat.py
│       │   ├── friends.py
│       │   ├── notifications.py
│       │   └── llm.py
│       ├── services/           # Business logic
│       │   ├── auth.py
│       │   ├── market.py
│       │   ├── betting.py
│       │   ├── resolution.py
│       │   ├── karma.py
│       │   ├── llm.py
│       │   └── notification.py
│       ├── socket/             # Socket.IO event handlers
│       │   ├── manager.py
│       │   └── events.py
│       ├── tasks/              # Celery tasks
│       │   ├── resolution.py
│       │   └── notifications.py
│       └── utils/
│           ├── security.py     # JWT, bcrypt, OAuth
│           └── openrouter.py   # LLM client
└── plan/
    ├── TECH.md
    └── PLANNING.md             # This file
```

---

## 6. Environment Variables

### `.env.example`

```bash
# === Database ===
POSTGRES_USER=voxpopuli
POSTGRES_PASSWORD=changeme
POSTGRES_DB=voxpopuli
DATABASE_URL=postgresql+asyncpg://voxpopuli:changeme@db:5432/voxpopuli

# === Redis ===
REDIS_URL=redis://redis:6379/0

# === Backend ===
SECRET_KEY=changeme-generate-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
BACKEND_CORS_ORIGINS=https://localhost:8443

# === OAuth 2.0 ===
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
OAUTH_42_CLIENT_ID=
OAUTH_42_CLIENT_SECRET=

# === OpenRouter (LLM) ===
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# === Nginx ===
DOMAIN=localhost

# === Frontend ===
NEXT_PUBLIC_API_URL=https://localhost:8443/api
NEXT_PUBLIC_WS_URL=wss://localhost:8443
```

---

## 7. Database Schema

### 7.1 Entity Relationship Overview

```
users ──< friendships >── users
users ──< bets >── markets
bets ──< bet_settlements
users ──< comments >── markets
comments ──< comment_votes >── users
users ──< notifications
users ──< chat_messages >── users
markets ──< market_resolutions
markets ──< community_votes >── users
```

### 7.2 Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| username | VARCHAR(50) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | nullable (OAuth users) |
| display_name | VARCHAR(100) | |
| avatar_url | VARCHAR(500) | default avatar path |
| bio | TEXT | |
| karma | INTEGER | default 100 |
| truth_score | FLOAT | default 0.5 (neutral) |
| spice | INTEGER | default 0 (Phase 2) |
| oauth_provider | VARCHAR(20) | nullable: google, github, 42 |
| oauth_id | VARCHAR(255) | nullable |
| language | VARCHAR(5) | default 'en' |
| is_online | BOOLEAN | default false |
| last_seen | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `markets`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| creator_id | UUID | FK → users |
| title | VARCHAR(300) | The prediction question |
| description | TEXT | Detailed terms and criteria |
| category | VARCHAR(50) | politics, sports, tech, science, etc. |
| resolution_criteria | TEXT | How this market resolves |
| resolution_source_url | VARCHAR(500) | nullable — API/data source for auto-resolve |
| status | ENUM | created, active, pending_resolution, resolved, disputed, cancelled |
| outcome | ENUM | nullable: yes, no, ambiguous |
| deadline | TIMESTAMP | When betting closes |
| resolution_deadline | TIMESTAMP | When resolution must complete |
| yes_pool | INTEGER | Total points bet on YES |
| no_pool | INTEGER | Total points bet on NO |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `bets`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| market_id | UUID | FK → markets |
| position | ENUM | yes, no |
| amount | INTEGER | Points wagered |
| created_at | TIMESTAMP | |

UNIQUE constraint on (user_id, market_id) — one position per user per market.

#### `bet_settlements`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| bet_id | UUID | FK → bets |
| market_id | UUID | FK → markets |
| user_id | UUID | FK → users |
| payout | INTEGER | Points received (0 if lost) |
| truth_delta | FLOAT | Change to user's Truth score |
| settled_at | TIMESTAMP | |

#### `comments`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| market_id | UUID | FK → markets |
| parent_id | UUID | nullable FK → comments (threading) |
| body | TEXT | |
| upvotes | INTEGER | default 0 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `comment_votes`
| Column | Type | Notes |
|---|---|---|
| user_id | UUID | FK → users |
| comment_id | UUID | FK → comments |
| value | SMALLINT | +1 or -1 |

PK: (user_id, comment_id)

#### `friendships`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| requester_id | UUID | FK → users |
| addressee_id | UUID | FK → users |
| status | ENUM | pending, accepted, blocked |
| created_at | TIMESTAMP | |

#### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| sender_id | UUID | FK → users |
| receiver_id | UUID | FK → users |
| body | TEXT | |
| read_at | TIMESTAMP | nullable |
| created_at | TIMESTAMP | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| type | VARCHAR(50) | bet_resolved, comment_reply, friend_request, market_update, etc. |
| title | VARCHAR(200) | |
| body | TEXT | |
| link | VARCHAR(500) | nullable — deep link to relevant page |
| is_read | BOOLEAN | default false |
| created_at | TIMESTAMP | |

#### `community_votes`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| market_id | UUID | FK → markets |
| user_id | UUID | FK → users |
| vote | ENUM | yes, no, ambiguous |
| weight | FLOAT | Based on user's Truth score |
| created_at | TIMESTAMP | |

UNIQUE constraint on (market_id, user_id).

#### `market_resolutions`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| market_id | UUID | FK → markets |
| resolved_by | ENUM | auto, proposer, community |
| outcome | ENUM | yes, no, ambiguous |
| evidence | TEXT | nullable |
| resolved_at | TIMESTAMP | |

### 7.3 Betting Economics

**Pool-based payout (parimutuel):**
- All YES bets go into `yes_pool`, all NO bets into `no_pool`
- Total pool = `yes_pool + no_pool`
- If YES wins: each YES bettor receives `(their_bet / yes_pool) * total_pool`
- If NO wins: each NO bettor receives `(their_bet / no_pool) * total_pool`
- If ambiguous: all bets returned (no payout, no Truth change)

**Bet cap:**
- `max_bet = floor(log2(karma))` — a user with 100 Karma can bet up to 6 points per market
- Prevents whales from dominating any single market

**Truth score update:**
- On resolution, Truth moves toward 1.0 (correct) or 0.0 (incorrect) using exponential moving average
- `new_truth = 0.9 * old_truth + 0.1 * outcome_score` where outcome_score is 1 (correct) or 0 (incorrect)
- Starting Truth: 0.5 (neutral — no track record)

**Karma flow:**
- Upvote on comment: +1 Karma to comment author
- Downvote on comment: -1 Karma to comment author (min 1 Karma)
- New account: 100 Karma starting allocation

### 7.4 Indexes
- `users`: email, username, karma (for leaderboard)
- `markets`: status, category, deadline, creator_id
- `bets`: user_id, market_id
- `comments`: market_id, parent_id, created_at
- `notifications`: user_id, is_read, created_at
- `chat_messages`: (sender_id, receiver_id), created_at

---

## 8. API Endpoints

### 8.1 Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → access + refresh tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| GET | `/api/auth/oauth/{provider}` | Redirect to OAuth provider |
| GET | `/api/auth/oauth/{provider}/callback` | OAuth callback |

### 8.2 Users
| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me` | Update profile |
| PUT | `/api/users/me/avatar` | Upload avatar |
| GET | `/api/users/{username}` | Public profile |
| GET | `/api/users/leaderboard` | Top users by Truth score |

### 8.3 Markets
| Method | Path | Description |
|---|---|---|
| GET | `/api/markets` | List markets (filter, sort, paginate) |
| POST | `/api/markets` | Create market |
| GET | `/api/markets/{id}` | Market detail |
| PUT | `/api/markets/{id}` | Update market (creator only) |
| DELETE | `/api/markets/{id}` | Cancel market (creator only, if no bets) |
| POST | `/api/markets/{id}/resolve` | Proposer resolution |
| POST | `/api/markets/{id}/dispute` | Trigger community vote |
| POST | `/api/markets/{id}/vote` | Cast community vote |

### 8.4 Bets
| Method | Path | Description |
|---|---|---|
| POST | `/api/markets/{id}/bets` | Place bet |
| GET | `/api/markets/{id}/bets` | List bets on market |
| GET | `/api/users/me/bets` | My active bets |

### 8.5 Comments
| Method | Path | Description |
|---|---|---|
| GET | `/api/markets/{id}/comments` | List comments (threaded) |
| POST | `/api/markets/{id}/comments` | Add comment |
| PUT | `/api/comments/{id}` | Edit comment |
| DELETE | `/api/comments/{id}` | Delete comment |
| POST | `/api/comments/{id}/vote` | Upvote/downvote |

### 8.6 Friends
| Method | Path | Description |
|---|---|---|
| GET | `/api/friends` | My friends list |
| POST | `/api/friends/request/{user_id}` | Send friend request |
| POST | `/api/friends/accept/{request_id}` | Accept request |
| POST | `/api/friends/reject/{request_id}` | Reject request |
| DELETE | `/api/friends/{user_id}` | Remove friend |
| POST | `/api/friends/block/{user_id}` | Block user |

### 8.7 Chat
| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/{user_id}/messages` | Message history (paginated) |
| POST | `/api/chat/{user_id}/messages` | Send message (also via Socket.IO) |

### 8.8 Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | List notifications (paginated) |
| PUT | `/api/notifications/{id}/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |

### 8.9 LLM
| Method | Path | Description |
|---|---|---|
| POST | `/api/llm/summarize/{market_id}` | Summarize market discussion |
| POST | `/api/llm/resolve-assist/{market_id}` | Get AI resolution suggestion |
| POST | `/api/llm/chat` | General LLM chat (rate-limited) |

### 8.10 Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `market:update` | Server → Client | Market pool/status changes |
| `bet:new` | Server → Client | New bet placed on subscribed market |
| `comment:new` | Server → Client | New comment on subscribed market |
| `chat:message` | Bidirectional | Direct message |
| `chat:typing` | Bidirectional | Typing indicator |
| `notification:new` | Server → Client | New notification |
| `user:online` | Server → Client | Friend came online |
| `user:offline` | Server → Client | Friend went offline |

### 8.11 Socket.IO Rooms

| Room | Pattern | Who joins | Purpose |
|---|---|---|---|
| Market room | `market:{id}` | Anyone viewing market detail | Live bet/comment/resolution updates |
| User room | `user:{id}` | The authenticated user | Personal notifications, friend status |
| Chat room | `chat:{sorted_user_ids}` | Both chat participants | Direct message delivery |

On connect: client authenticates via JWT, auto-joins their `user:{id}` room. Market rooms are joined/left as users navigate.

---

## 9. LLM Integration (OpenRouter)

### 9.1 Overview
Use OpenRouter as the LLM gateway. This provides access to multiple models via a single API key and endpoint, with automatic fallback.

### 9.2 Use Cases

| Feature | Model | Purpose |
|---|---|---|
| **Market Summarizer** | claude-sonnet | Summarize discussion threads into key arguments for/against |
| **Resolution Assistant** | claude-sonnet | Analyze evidence and suggest resolution outcome |
| **General Chat** | claude-sonnet | Users can ask the AI about markets, trends, predictions |

### 9.3 Implementation

```python
# backend/app/utils/openrouter.py

import httpx
from app.config import settings

async def llm_completion(
    messages: list[dict],
    model: str = settings.OPENROUTER_MODEL,
    max_tokens: int = 1024,
    stream: bool = False,
) -> str:
    """Call OpenRouter API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "stream": stream,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
```

### 9.4 Rate Limiting
- Per-user: 10 requests/minute for LLM endpoints
- Global: 100 requests/minute total
- Implemented via Redis sliding window counter

### 9.5 Streaming
For the chat interface, use SSE (Server-Sent Events) to stream LLM responses to the frontend for better UX.

### 9.6 Error Handling & Fallback
- **Timeout**: 30s per request; return cached summary if available, else user-friendly error
- **Rate limit exceeded (OpenRouter)**: Queue request via Celery, notify user when ready
- **Model unavailable**: Fall back to a cheaper model (e.g., `meta-llama/llama-3-70b`)
- **Cost control**: Set `max_tokens` per use case (summarize: 512, resolve-assist: 1024, chat: 2048)

### 9.7 Prompt Templates
Store prompt templates as constants in `backend/app/services/llm.py`:
- **Summarizer**: "Given the following prediction market discussion, summarize the key arguments for YES and NO..."
- **Resolution Assistant**: "Given the market question, resolution criteria, and evidence below, what is the most likely correct outcome..."
- **Chat**: System prompt explaining Vox Populi context, user's current markets, basic prediction market concepts

---

## 10. Frontend Design

### 10.1 Component Architecture
Using Next.js 15 App Router with React 19. Zustand for client state. Socket.IO for real-time.

### 10.2 Key Components

**Layout:**
- `Header` — Logo, nav links, notification bell, user avatar dropdown
- `Sidebar` — Category filters, trending markets (desktop)
- `Footer` — Links to Privacy Policy, Terms of Service, language switcher

**Market Components:**
- `MarketCard` — Preview card: title, odds bar (YES/NO), deadline countdown, category tag
- `MarketDetail` — Full market view with bet interface + discussion
- `BetPanel` — Slider to select amount, YES/NO toggle, projected payout
- `OddsBar` — Visual bar showing YES% vs NO% of total pool
- `ResolutionPanel` — Shows resolution status, evidence, vote buttons

**Discussion:**
- `CommentThread` — Threaded comments with upvote/downvote
- `CommentEditor` — Rich text input with evidence linking

**User:**
- `ProfileCard` — Avatar, username, Karma/Truth/Spice badges
- `StatsPanel` — Bet history chart, win rate, calibration plot
- `FriendsList` — Online indicators, quick-chat buttons

**Chat:**
- `ChatSidebar` — Conversation list
- `ChatWindow` — Messages with real-time updates, typing indicator

### 10.3 State Management (Zustand)

```
stores/
├── authStore.ts        # User session, tokens
├── marketStore.ts      # Active markets, filters
├── betStore.ts         # User's active bets
├── chatStore.ts        # Conversations, messages
├── notificationStore.ts # Notification list, unread count
└── socketStore.ts      # Socket.IO connection state
```

### 10.4 i18n
Using `next-intl` for internationalization. Three languages:
- English (EN) — default
- French (FR)
- German (DE)

Translation files in `public/locales/{lang}/common.json`.

### 10.5 Responsive Design
- Mobile-first approach with Tailwind breakpoints
- Bottom nav on mobile, sidebar on desktop
- Market cards stack on mobile, grid on desktop

---

## 11. Docker & Deployment

### 11.1 Docker Compose Services

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8443:8443"
      - "8080:8080"      # redirect to 8443
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      frontend:
        condition: service_started
      backend:
        condition: service_started

  frontend:
    build: ./frontend
    environment:
      - NEXT_PUBLIC_API_URL
      - NEXT_PUBLIC_WS_URL
    depends_on:
      backend:
        condition: service_started

  backend:
    build: ./backend
    environment:
      - DATABASE_URL
      - REDIS_URL
      - SECRET_KEY
      - OPENROUTER_API_KEY
      # ... all backend env vars
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery:
    build: ./backend
    command: uv run celery -A app.tasks worker --loglevel=info
    environment:
      # same as backend
    depends_on:
      backend:
        condition: service_started
      redis:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER
      - POSTGRES_PASSWORD
      - POSTGRES_DB
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

### 11.2 Nginx Config Highlights
- HTTPS termination with self-signed certs (dev) / Let's Encrypt (prod)
- `/` → proxy to frontend:3000
- `/api/` → proxy to backend:8000
- `/socket.io/` → proxy to backend:8000 (WebSocket upgrade)
- Security headers: HSTS, X-Frame-Options, CSP

### 11.3 Dockerfiles

**Frontend (`frontend/Dockerfile`):**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
CMD ["npm", "start"]
```

**Backend (`backend/Dockerfile`):**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen
COPY . .
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### 11.4 Database Migrations
- Alembic manages schema migrations
- On backend container start, run `alembic upgrade head` before uvicorn
- Backend Dockerfile CMD: `sh -c "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"`
- Generate new migration: `uv run alembic revision --autogenerate -m "description"`

### 11.5 Single Command Start
```bash
cp .env.example .env   # fill in secrets
docker compose up --build
```

---

## 12. Testing Strategy

### 12.1 Backend Testing

| Layer | Tool | What |
|---|---|---|
| **Unit tests** | pytest + pytest-asyncio | Services, utils, schemas |
| **API tests** | pytest + httpx (TestClient) | Route handlers, auth flows |
| **DB tests** | pytest + testcontainers | Models, migrations, queries |
| **WebSocket tests** | python-socketio test client | Socket.IO events |

Run: `uv run pytest`

### 12.2 Frontend Testing

| Layer | Tool | What |
|---|---|---|
| **Unit tests** | Vitest + React Testing Library | Components, hooks, stores |
| **Integration** | Vitest | Page-level rendering with mocked API |
| **E2E** | Playwright | Full user flows in Chrome |

Run: `npm test` (unit/integration), `npx playwright test` (E2E)

### 12.3 Key Test Scenarios

- **Auth**: Register, login, logout, token refresh, OAuth flow
- **Markets**: Create, bet, resolve (all 3 tiers), dispute
- **Betting logic**: Bet cap enforcement (log(karma)), pool calculations, payout distribution
- **Real-time**: Market updates propagate to all subscribed clients
- **Chat**: Message delivery, typing indicators, read receipts
- **Friends**: Request/accept/reject/block flows
- **LLM**: Summarization returns valid response, rate limiting enforced
- **i18n**: All pages render in EN/FR/DE

### 12.4 CI Approach
- Run linting (ruff for Python, eslint for TypeScript)
- Run backend tests
- Run frontend tests
- Build Docker images to verify Dockerfiles

---

## 13. Security

- **HTTPS everywhere**: Nginx terminates TLS; backend and frontend only accessible via Nginx
- **Password hashing**: bcrypt with salt (via passlib)
- **JWT**: Short-lived access tokens (30 min), long-lived refresh tokens (7 days) stored in httpOnly cookies
- **CORS**: Strict origin whitelist (`BACKEND_CORS_ORIGINS`)
- **Input validation**: Pydantic on backend, Zod on frontend — shared validation rules
- **SQL injection**: Prevented by SQLAlchemy parameterized queries (never raw SQL)
- **XSS**: React auto-escapes output; CSP headers via Nginx
- **CSRF**: Token-based protection for state-changing requests
- **Rate limiting**: Redis-based per-IP and per-user limits on auth and LLM endpoints
- **File uploads** (avatars): Validate MIME type + file size server-side, store outside web root

---

## 14. Module Checklist (14 points target)

| # | Module | Type | Pts | Status |
|---|---|---|---|---|
| 1 | Frontend + Backend frameworks (Next.js + FastAPI) | Major | 2 | Planned |
| 2 | Real-time features (Socket.IO) | Major | 2 | Planned |
| 3 | User interaction (chat, profiles, friends) | Major | 2 | Planned |
| 4 | Standard user management (profile, avatar, friends, online status) | Major | 2 | Planned |
| 5 | ORM (SQLAlchemy) | Minor | 1 | Planned |
| 6 | Notification system | Minor | 1 | Planned |
| 7 | OAuth 2.0 (Google / GitHub / 42) | Minor | 1 | Planned |
| 8 | LLM interface (market summarizer, resolution assistant) | Major | 2 | Planned |
| 9 | i18n — 3 languages (EN, FR, DE) | Minor | 1 | Planned |
| | **Total** | | **14** | |

### Stretch (bonus, up to +5)

| # | Module | Type | Pts |
|---|---|---|---|
| 10 | Public API (5+ endpoints, rate-limited, documented) | Major | 2 |
| 11 | GDPR compliance (data export/delete) | Minor | 1 |
| 12 | Advanced search (filters, sorting, pagination) | Minor | 1 |
| 13 | PWA with offline support | Minor | 1 |

---

## 15. Implementation Order

### Phase 1 — Foundation
1. Docker Compose setup (Nginx + Postgres + Redis)
2. Backend scaffold: FastAPI + SQLAlchemy + Alembic
3. User model + auth (register/login/JWT)
4. Frontend scaffold: Next.js 15 + Tailwind + layout

### Phase 2 — Core Features
5. Market CRUD (create, list, detail)
6. Betting system (place bets, pool tracking)
7. Comment/discussion threads
8. Karma system (upvotes → karma)

### Phase 3 — Social
9. Friend system (request/accept/block)
10. Chat (direct messages)
11. User profiles + avatars
12. Notification system

### Phase 4 — Real-time
13. Socket.IO integration (market updates, chat, notifications)
14. Online status tracking

### Phase 5 — Intelligence
15. LLM integration via OpenRouter (summarizer, resolution assistant)
16. Market resolution system (auto, proposer, community vote)

### Phase 6 — Polish
17. i18n (EN, FR, DE)
18. OAuth 2.0 (Google, GitHub, 42)
19. Privacy Policy + Terms of Service pages
20. Dark mode, responsive polish

### Phase 7 — Testing & Stretch
21. Test suite (backend + frontend + E2E)
22. Stretch modules if time permits
