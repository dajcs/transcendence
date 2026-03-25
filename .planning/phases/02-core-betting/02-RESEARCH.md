# Phase 2: Core Betting - Research

**Researched:** 2026-03-25
**Domain:** FastAPI betting services, Celery beat scheduling, SQLAlchemy SELECT FOR UPDATE, Next.js 16 market UI, ledger-pattern economics
**Confidence:** HIGH

## Summary

Phase 2 builds on a fully-working Phase 1 foundation: all DB models are already migrated (bets, bet_positions, position_history, bp_transactions, tp_transactions, kp_events, comments, comment_upvotes), the Celery worker container exists but has no business tasks, and the frontend has only one protected route (dashboard). The core work is wiring services and routes to the existing schema, adding Celery beat scheduling, and building market/bet/comment/dashboard pages in Next.js.

The main technical risks are: (1) the SELECT FOR UPDATE pattern in async SQLAlchemy — requires explicit `with_for_update()` inside an explicit transaction scope; (2) Celery beat must run as a separate process (add a `celery-beat` service or use `--beat` flag on worker); (3) the daily login bonus requires last_login date tracking and idempotent check on the `/api/auth/me` path. All libraries (SQLAlchemy 2 async, Celery 5, FastAPI 0.115, Next.js 16, React Query 5, Zustand 5) are already installed and pinned.

**Primary recommendation:** Implement in service-layer order — economy utils first (balance compute, bp deduction helper), then market/bet services, then comments, then Celery tasks, then frontend pages. Each service is independently testable with the existing SQLite-in-memory conftest pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UI Design Level**
- D-01: Functional Tailwind utilities only — no custom design tokens, no visual polish. Visual design (PLANNING.md color scheme, Inter/JetBrains Mono fonts, shadows) is deferred to Phase 6.

**Markets Feed & List**
- D-02: Default sort: deadline soonest first (ascending). One-click sort toggle for "Most active" (by position count) and "Newest". Sort buttons in list header, no dropdown.
- D-03: Filter tabs: All / Open / Resolved. Three tabs, no more.
- D-04: Pagination: simple Previous/Next page buttons. No infinite scroll.

**Market Creation Form**
- D-05: Form fields: title, description, resolution_criteria, deadline. resolution_source hidden.
- D-06: Creating a market costs 1 bp. Must have bp > 0 before submitting.
- D-07: Any authenticated user can create a market. No role restrictions.

**Balance Computation**
- D-08: bp/kp/tp balances computed via SUM aggregation from ledger tables on every request. No denormalized balance columns. Add index on user_id for bp_transactions, tp_transactions, kp_events if not already present.
- D-09: kp computed from kp_events. No kp_balance column. Celery daily task: SUM kp_events → credit floor(log10(kp+1)) bp → insert negative kp reset event.

**Points Economy (Celery Tasks)**
- D-10: Celery daily task at 00:00 UTC: compute karma_bp per user, insert bp_transaction (+karma_bp), insert kp reset event (large negative).
- D-11: Sign-up bonus (+10 bp) credited as bp_transaction at registration. Daily login bonus (+1 bp) on first authenticated request of the day (backend checks last_login date).

**Betting Mechanics**
- D-12: Odds displayed as simple pool probability: yes_pct = yes_pool / (yes_pool + no_pool). Shown as percentage.
- D-13: Withdrawal refund: refund_bp = round(current_winning_probability_of_position, 2).
- D-14: Bet placement and market creation use SELECT FOR UPDATE on user row. bp balance check + deduction in single DB transaction.

**Comment Threads**
- D-15: 1-level deep replies. Flat render with visual indent. No collapse/expand.
- D-16: Upvoting a comment earns +1 kp for author. Self-upvotes blocked by unique constraint. Duplicate upvote = 409.

**Dashboard**
- D-17: Dashboard shows: active bets (market title, side, bp staked, current odds), portfolio summary (total bp, tp, kp), recent resolved bets.

### Claude's Discretion
- Exact pagination page size (suggest 20 markets/page)
- Sort button UI placement and styling
- Comment timestamp formatting (relative vs absolute)
- Dashboard portfolio card layout details
- Error and empty state messages

### Deferred Ideas (OUT OF SCOPE)
- resolution_source field in market creation form — Phase 5
- "Mine" filter tab on markets list
- Redis caching of balances
- Visual polish / design system (PLANNING.md color tokens) — Phase 6
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BET-01 | User can create a market (title, description, criteria, deadline) | `POST /api/markets` — market_service.create_market; costs 1 bp (D-06); SELECT FOR UPDATE on user (D-14) |
| BET-02 | User can place a YES or NO bet (costs 1 bp) | `POST /api/bets` — bet_service.place_bet; deduct 1 bp atomically; insert BetPosition + PositionHistory + BpTransaction |
| BET-03 | User can withdraw a bet before resolution | `DELETE /api/bets/{position_id}` — refund = round(win_probability, 2); set withdrawn_at; insert BpTransaction |
| BET-04 | Bet cap enforced per user per market: floor(log10(kp+1)) + 1 bp | Computed at bet placement — query kp SUM for today, apply formula, compare against positions already held |
| BET-05 | bp balance cannot go below 0; checked atomically | SELECT FOR UPDATE on users row; SUM bp_transactions; raise 422 if insufficient |
| BET-06 | New user receives 10 bp signup bonus | Insert BpTransaction(amount=10, reason='signup') in auth_service.register (already missing — must add) |
| BET-07 | Daily bp allocation at 00:00 UTC: +floor(log10(kp+1)) | Celery beat task; iterates all users; insert BpTransaction + kp reset KpEvent |
| BET-08 | Daily login bonus: +1 bp | Check users.last_login date vs today in /api/auth/me or dedicated middleware; insert BpTransaction if first login of day; update last_login |
| DISC-01 | Each bet has a threaded comment section | `GET /api/markets/{id}/comments` — return comments with parent_id; frontend renders flat with indent for replies |
| DISC-02 | Users can upvote comments (earns kp for author) | `POST /api/comments/{id}/upvote` — insert CommentUpvote + KpEvent(amount=1) atomically; 409 on duplicate |
| DISC-03 | Comments support nested replies (1 level deep) | `POST /api/markets/{id}/comments` accepts optional parent_id; validate parent has no parent (enforce 1-level limit) |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version (pinned) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| FastAPI | >=0.115.0 | REST API framework | Already in use; Phase 1 pattern |
| SQLAlchemy asyncio | >=2.0.36 | Async ORM, SELECT FOR UPDATE | Already in use; all models migrated |
| Celery | >=5.4.0 (5.6.2 installed) | Background tasks + beat scheduling | Already scaffolded in workers/ |
| redis[asyncio] | >=5.2.0 | Celery broker + result backend | Already configured |
| Pydantic v2 | >=2.10.0 | Schema validation | Already in use; all schemas Pydantic v2 |
| Next.js | ^16.0.0 | Frontend framework | Already in use |
| Zustand | ^5.0.0 | Frontend state | Already in use (auth store pattern) |
| React Query (@tanstack/react-query) | ^5.0.0 | Server state, API fetching | Already installed; use for market/bet queries |
| react-hook-form + zod | ^7 + ^4 | Form handling + validation | Already installed; use for market creation |
| axios | ^1.0.0 | HTTP client (via api.ts singleton) | Already in use |

### No New Packages Required

All libraries needed for Phase 2 are already in pyproject.toml and package.json. The only potential addition is `celery-beat` run mode — handled via compose command flag, not a new package.

### Installation

No new installs needed. Existing:
- Backend: `uv run celery -A app.workers.celery_app beat -l info` (add beat service to docker-compose.yml)
- Frontend: all imports available

## Architecture Patterns

### Recommended Backend Structure

```
backend/app/
├── api/routes/
│   ├── auth.py          # exists
│   ├── markets.py       # new — market CRUD
│   ├── bets.py          # new — place/withdraw positions
│   └── comments.py      # new — comment CRUD + upvote
├── services/
│   ├── auth_service.py  # extend: add signup bonus + login bonus
│   ├── economy_service.py   # new — balance query, bp deduction helper
│   ├── market_service.py    # new — create/list/get markets
│   ├── bet_service.py       # new — place/withdraw, odds calc
│   └── comment_service.py   # new — post comment, upvote
├── schemas/
│   ├── auth.py          # exists
│   ├── market.py        # new
│   ├── bet.py           # new
│   └── comment.py       # new
└── workers/
    ├── celery_app.py    # extend: add beat_schedule
    └── tasks/
        └── daily.py     # new — daily_allocation task
```

### Recommended Frontend Structure

```
frontend/src/
├── app/(protected)/
│   ├── dashboard/page.tsx   # extend — wire real data
│   └── markets/
│       ├── page.tsx         # market list (feed)
│       ├── new/page.tsx     # create market form
│       └── [id]/page.tsx    # market detail + bet UI + comments
├── store/
│   ├── auth.ts              # exists
│   └── market.ts            # new — sort/filter/page state (Zustand)
└── lib/
    ├── api.ts               # exists
    └── types.ts             # new — shared TypeScript interfaces
```

### Pattern 1: SELECT FOR UPDATE with Async SQLAlchemy

The critical concurrency pattern for bp deduction and market creation:

```python
# Source: SQLAlchemy 2 docs — with_for_update()
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

async def deduct_bp(db: AsyncSession, user_id: uuid.UUID, amount: float, reason: str, bet_id=None):
    """Deduct bp atomically. Raises HTTPException 402 if insufficient."""
    async with db.begin():
        # Lock the user row to serialize concurrent requests
        result = await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        user = result.scalar_one()

        # Compute current balance from ledger
        bal_result = await db.execute(
            select(func.sum(BpTransaction.amount)).where(BpTransaction.user_id == user_id)
        )
        balance = bal_result.scalar_one() or 0

        if balance < amount:
            raise HTTPException(status_code=402, detail="Insufficient bp balance")

        db.add(BpTransaction(
            user_id=user_id,
            amount=-amount,
            reason=reason,
            bet_id=bet_id,
        ))
    # transaction commits on exit
```

**Critical note:** `db.begin()` is needed explicitly when using `async_sessionmaker` with `autocommit=False` (the default). The session fixture in conftest uses `expire_on_commit=False` — reuse this pattern.

### Pattern 2: Odds Calculation

```python
# Source: ECONOMY.md + D-12
from sqlalchemy import select, func

async def get_odds(db: AsyncSession, bet_id: uuid.UUID) -> dict:
    """Return yes_pct and no_pct for a bet. Active positions only (withdrawn_at IS NULL)."""
    result = await db.execute(
        select(BetPosition.side, func.sum(BetPosition.bp_staked))
        .where(BetPosition.bet_id == bet_id, BetPosition.withdrawn_at.is_(None))
        .group_by(BetPosition.side)
    )
    pools = {row[0]: float(row[1]) for row in result}
    yes = pools.get("yes", 0)
    no = pools.get("no", 0)
    total = yes + no
    if total == 0:
        return {"yes_pct": 50.0, "no_pct": 50.0}
    return {"yes_pct": round(yes / total * 100, 1), "no_pct": round(no / total * 100, 1)}
```

### Pattern 3: Celery Beat Schedule

```python
# backend/app/workers/celery_app.py — extend existing file
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "daily-allocation": {
        "task": "app.workers.tasks.daily.daily_allocation",
        "schedule": crontab(hour=0, minute=0),  # 00:00 UTC
    },
}
```

**Celery beat requires a separate process.** Add to docker-compose.yml:
```yaml
celery-beat:
  build:
    context: ./backend
    dockerfile: Dockerfile
  env_file: .env
  environment:
    DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    REDIS_URL: redis://redis:6379/0
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy
  command: ["uv", "run", "celery", "-A", "app.workers.celery_app", "beat", "--loglevel=info"]
```

### Pattern 4: Daily Allocation Task (sync Celery + async DB)

Celery tasks are synchronous by default. To run async DB code, use `asyncio.run()`:

```python
# backend/app/workers/tasks/daily.py
import asyncio
import math
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.db.models.user import User
from app.db.models.transaction import BpTransaction, KpEvent
from app.workers.celery_app import celery_app

@celery_app.task(name="app.workers.tasks.daily.daily_allocation")
def daily_allocation():
    asyncio.run(_run_allocation())

async def _run_allocation():
    engine = create_async_engine(settings.database_url)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        async with db.begin():
            # Get all active users
            users = (await db.execute(select(User).where(User.is_active == True))).scalars().all()
            today = datetime.now(timezone.utc).date()
            for user in users:
                # Sum kp for today
                kp = (await db.execute(
                    select(func.sum(KpEvent.amount))
                    .where(KpEvent.user_id == user.id, KpEvent.day_date == today)
                )).scalar_one() or 0
                karma_bp = math.floor(math.log10(kp + 1))
                if karma_bp > 0:
                    db.add(BpTransaction(user_id=user.id, amount=karma_bp, reason="daily_allocation"))
                # Reset kp — insert a negative event for all today's kp
                if kp > 0:
                    db.add(KpEvent(user_id=user.id, amount=-kp, source_type="daily_reset",
                                   source_id=user.id, day_date=today))
    await engine.dispose()
```

**Note:** The Celery worker container shares the same DATABASE_URL env var. The task creates its own engine — do not reuse the FastAPI app's engine.

### Pattern 5: Daily Login Bonus

Extend `auth_service.get_current_user` (called by `/api/auth/me`) to credit +1 bp on first login of day:

```python
# In auth_service.get_current_user — after fetching user
from datetime import datetime, timezone, date

async def _credit_daily_login_bonus(db: AsyncSession, user: User) -> None:
    today = datetime.now(timezone.utc).date()
    if user.last_login is None or user.last_login.date() < today:
        async with db.begin():
            db.add(BpTransaction(user_id=user.id, amount=1, reason="daily_login"))
            user.last_login = datetime.now(timezone.utc)
    # if already logged in today, no-op
```

**Important:** This must be idempotent — check `user.last_login.date() < today` before inserting. The `last_login` field exists on the User model.

### Pattern 6: Bet Cap Enforcement (BET-04)

```python
# In bet_service.place_bet — before deducting bp
async def check_bet_cap(db: AsyncSession, user_id: uuid.UUID, bet_id: uuid.UUID) -> None:
    """Raise 422 if user has hit bet cap for this market."""
    # Compute today's kp
    today = datetime.now(timezone.utc).date()
    kp = (await db.execute(
        select(func.sum(KpEvent.amount))
        .where(KpEvent.user_id == user_id, KpEvent.day_date == today)
    )).scalar_one() or 0
    cap = math.floor(math.log10(kp + 1)) + 1  # per REQUIREMENTS.md BET-04

    # Count active positions user has in this bet
    positions = (await db.execute(
        select(func.count()).where(
            BetPosition.bet_id == bet_id,
            BetPosition.user_id == user_id,
            BetPosition.withdrawn_at.is_(None),
        )
    )).scalar_one()

    if positions >= cap:
        raise HTTPException(status_code=422, detail=f"Bet cap reached ({cap} positions)")
```

**Note:** The unique constraint `(bet_id, user_id)` on bet_positions means a user can only have ONE active position per market. The cap formula applies: if cap = 1 (kp=0), the unique constraint alone enforces it. If cap > 1 (future: multiple bp per side?), the formula needs revisiting. For Phase 2 with 1 bp per bet, the unique constraint effectively covers most cases. Still implement the cap check as specified.

### Pattern 7: React Query for Market Data (Frontend)

```typescript
// frontend/src/lib/types.ts
export interface Market {
  id: string;
  title: string;
  description: string;
  resolution_criteria: string;
  deadline: string;
  status: "open" | "pending" | "closed";
  yes_pct: number;
  no_pct: number;
  position_count: number;
  proposer_id: string;
  created_at: string;
}

// frontend/src/app/(protected)/markets/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function MarketsPage() {
  const [sort, setSort] = useState<"deadline" | "active" | "newest">("deadline");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [page, setPage] = useState(1);

  const { data } = useQuery({
    queryKey: ["markets", sort, filter, page],
    queryFn: () => api.get(`/api/markets?sort=${sort}&status=${filter}&page=${page}&limit=20`).then(r => r.data),
  });
  // ...
}
```

### Anti-Patterns to Avoid

- **Never UPDATE a balance column.** Only INSERT into bp_transactions/kp_events. Current balance = SUM(amount). Violating this breaks audit trail.
- **Never use `db.commit()` inside a route handler directly.** Wrap in `async with db.begin()` for explicit transaction scope. The session from `get_db()` uses autocommit=False but does not auto-begin.
- **Never skip the unique constraint check application-side.** The DB constraint is the final guard, but catching IntegrityError and returning 409 is cleaner than letting a 500 propagate.
- **Never run beat and worker in the same container in production.** Separate services prevent double-scheduling.
- **Never compute balance without the SELECT FOR UPDATE lock when modifying it.** A balance check followed by a deduction without a lock is a TOCTOU race.
- **Don't add infinite scroll.** D-04 explicitly prohibits it (conflicts with Phase 4 real-time approach).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom loop/sleep task | `celery.schedules.crontab` in `beat_schedule` | Handles DST, restarts, missed runs |
| Form validation (frontend) | Manual input checking | `react-hook-form` + `zod` — already installed | Type-safe, async validation, integrates with Pydantic error format |
| Server state caching | useState + useEffect fetch | `@tanstack/react-query` — already installed | Automatic stale-while-revalidate, dedup, background refresh |
| Pagination state | URL-string manipulation | `useSearchParams` (Next.js built-in) | Bookmarkable URLs, browser back works |
| Atomic DB operations | Application-level locks | `with_for_update()` + `db.begin()` | DB-level serialization; no deadlock risk from app locks |
| UUID generation | `str(uuid.uuid4())` in column default | `default=uuid.uuid4` on mapped_column | Already the pattern in all models |

---

## Common Pitfalls

### Pitfall 1: Celery Task Can't Use FastAPI's Async Session

**What goes wrong:** Importing `get_db` from `app.db.session` in a Celery task fails because the task is sync and doesn't have a request context.

**Why it happens:** FastAPI's `get_db` is an async generator tied to request lifecycle. Celery tasks run in a separate process with no ASGI app.

**How to avoid:** Create a fresh `async_engine` + `async_sessionmaker` inside the task function, as shown in Pattern 4 above. Call `asyncio.run(_async_fn())` to run async code from sync Celery task.

**Warning signs:** `RuntimeError: Event loop is closed` or `greenlet_spawn has not been called` in celery logs.

### Pitfall 2: `db.begin()` Double-Nesting

**What goes wrong:** Calling `async with db.begin()` when a transaction is already open raises `InvalidRequestError: A transaction is already begun`.

**Why it happens:** SQLAlchemy 2 async sessions track transaction state. If a caller already opened a transaction, nested `begin()` fails.

**How to avoid:** Use `db.begin_nested()` for savepoints, or ensure each service method is called with a fresh session scope. The route handler should own the transaction boundary.

**Warning signs:** `sqlalchemy.exc.InvalidRequestError` in tests or at runtime.

### Pitfall 3: Odds Display When Pool Is Empty

**What goes wrong:** Division by zero when no positions exist for a market.

**Why it happens:** `yes_pool / (yes_pool + no_pool)` with both at 0.

**How to avoid:** Default to 50/50 when total pool = 0 (as shown in Pattern 2). Test this explicitly.

### Pitfall 4: Duplicate Login Bonus

**What goes wrong:** User gets +1 bp on every `/api/auth/me` call (which React Query polls frequently).

**Why it happens:** Missing idempotency check — not comparing `last_login.date()` to today's date.

**How to avoid:** Check `user.last_login is None or user.last_login.date() < today` BEFORE inserting the BpTransaction. Update `last_login` in the same transaction.

**Warning signs:** bp balance grows unrealistically fast during testing.

### Pitfall 5: Signup Bonus Missing

**What goes wrong:** BET-06 not met — new users get 0 bp.

**Why it happens:** `auth_service.register` currently creates the User but does NOT insert a BpTransaction. This is confirmed by reading the code.

**How to avoid:** Add `db.add(BpTransaction(user_id=user.id, amount=10, reason='signup'))` in `auth_service.register` before commit. This is a required change to existing code.

### Pitfall 6: Middleware Misses `/markets` Routes

**What goes wrong:** Unauthenticated users can access `/markets/*` pages.

**Why it happens:** `src/middleware.ts` only protects `/dashboard/:path*`. New market pages at `/markets/*` are not listed in the `matcher`.

**How to avoid:** Extend the middleware `matcher` config to include `/markets/:path*`.

### Pitfall 7: Alembic Missing Indexes

**What goes wrong:** Balance queries (`SUM(amount) WHERE user_id = ?`) are slow without indexes.

**Why it happens:** The initial migration (001_initial_schema.py) may not include all indexes from DATABASE.md.

**How to avoid:** Verify migration 001 includes `idx_bp_transactions_user`, `idx_kp_events_user_day`, `idx_comments_bet`. If missing, generate a new Alembic migration (`002_add_performance_indexes`) — never edit migration 001.

### Pitfall 8: React Query and httpOnly Cookies

**What goes wrong:** React Query fetches return 401 because the access_token cookie expired mid-session, but there's no refresh interceptor on the `api` axios instance.

**Why it happens:** The current `api.ts` has no response interceptor for 401 → trigger refresh.

**How to avoid:** Add an axios response interceptor in `api.ts` that on 401 calls `/api/auth/refresh`, then retries the original request. This is needed before React Query polling will work correctly.

---

## Code Examples

### Verified: Existing auth_service.register (missing signup bonus)

```python
# backend/app/services/auth_service.py lines 37-57 (verified by reading)
# Current code commits user WITHOUT BpTransaction
# Phase 2 must add before db.commit():
#   db.add(BpTransaction(user_id=user.id, amount=10, reason='signup'))
```

### Verified: Existing conftest pattern for new service tests

```python
# All new service tests follow this pattern from conftest.py:
# - SQLite in-memory engine
# - async_sessionmaker with expire_on_commit=False
# - fakeredis for Redis-dependent code
# - httpx AsyncClient for API-level tests
```

### Verified: Celery 5.6.2 beat_schedule syntax

```python
from celery.schedules import crontab
celery_app.conf.beat_schedule = {
    "task-name": {
        "task": "module.path.to.task_function",
        "schedule": crontab(hour=0, minute=0),
    },
}
```

### Verified: Next.js 16 App Router — page with searchParams

```typescript
// For sort/filter/page — use useSearchParams (client component)
"use client";
import { useSearchParams, useRouter } from "next/navigation";
const searchParams = useSearchParams();
const page = Number(searchParams.get("page") ?? "1");
```

---

## Runtime State Inventory

> Phase 2 is greenfield feature addition, not a rename/refactor. No runtime state migration required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 001_initial_schema migration already applied — all tables exist | None — tables are ready |
| Live service config | Celery worker running but has no beat process | Add celery-beat service to docker-compose.yml |
| OS-registered state | None | None |
| Secrets/env vars | No new secrets needed; existing DATABASE_URL and REDIS_URL cover all Phase 2 tasks | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| PostgreSQL 16 | All DB operations | In Docker | 16 (via compose) | — |
| Redis 7 | Celery broker, beat | In Docker | 7 (via compose) | — |
| Celery worker | BET-07 daily task | Running in compose | 5.6.2 (verified) | — |
| Celery beat | BET-07 scheduling | NOT in compose | — | Must add celery-beat service |
| asyncpg | SQLAlchemy async | Installed | >=0.30.0 | — |
| aiosqlite | Test suite | Installed | >=0.22.1 | — |
| fakeredis | Test suite | Installed | >=2.34.1 | — |

**Missing dependencies with no fallback:**
- Celery beat service — not defined in docker-compose.yml. Must add `celery-beat` service entry. Without it, BET-07 never runs.

**Missing dependencies with fallback:**
- None identified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3+ with pytest-asyncio 0.24+ |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`, asyncio_mode="auto") |
| Quick run command | `cd backend && uv run pytest tests/test_economy.py -x -q` |
| Full suite command | `cd backend && uv run pytest -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BET-01 | Create market, deducts 1 bp | integration | `uv run pytest tests/test_markets.py::test_create_market -x` | Wave 0 |
| BET-02 | Place YES/NO bet, deducts 1 bp | integration | `uv run pytest tests/test_bets.py::test_place_bet -x` | Wave 0 |
| BET-03 | Withdraw bet, refund formula | unit + integration | `uv run pytest tests/test_economy.py::test_withdrawal_refund -x` | Wave 0 |
| BET-04 | Bet cap formula: floor(log10(kp+1))+1 | unit | `uv run pytest tests/test_economy.py::test_bet_cap -x` | Wave 0 |
| BET-05 | bp cannot go below 0 (atomic) | integration | `uv run pytest tests/test_bets.py::test_insufficient_bp -x` | Wave 0 |
| BET-06 | Signup bonus +10 bp | integration | `uv run pytest tests/test_auth.py::test_signup_bonus -x` | ✅ (file exists, test missing) |
| BET-07 | Daily allocation task | unit | `uv run pytest tests/test_tasks.py::test_daily_allocation -x` | Wave 0 |
| BET-08 | Daily login bonus idempotent | integration | `uv run pytest tests/test_auth.py::test_daily_login_bonus -x` | ✅ (file exists, test missing) |
| DISC-01 | Comment list for market | integration | `uv run pytest tests/test_comments.py::test_list_comments -x` | Wave 0 |
| DISC-02 | Upvote earns +1 kp, no self-upvote | integration | `uv run pytest tests/test_comments.py::test_upvote -x` | Wave 0 |
| DISC-03 | Reply depth enforced (1 level) | integration | `uv run pytest tests/test_comments.py::test_reply_depth -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && uv run pytest -x -q` (full suite runs fast with SQLite in-memory)
- **Per wave merge:** `cd backend && uv run pytest -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_economy.py` — covers BET-03 (withdrawal formula), BET-04 (bet cap), BET-05 (atomic deduction)
- [ ] `backend/tests/test_markets.py` — covers BET-01
- [ ] `backend/tests/test_bets.py` — covers BET-02, BET-05
- [ ] `backend/tests/test_tasks.py` — covers BET-07 (daily allocation task with asyncio.run)
- [ ] `backend/tests/test_comments.py` — covers DISC-01, DISC-02, DISC-03

Existing `tests/test_auth.py` needs additional test cases for BET-06 and BET-08 (tests missing from existing file).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Celery `@app.on_after_configure` for beat | `conf.beat_schedule` dict | Celery 4+ | Use `conf.beat_schedule` — simpler, works in all versions |
| `celery_app.task(bind=True)` for retries | Standard `@celery_app.task` for non-retry tasks | Celery 5 | No `self` needed for simple tasks |
| `asyncio.get_event_loop().run_until_complete()` | `asyncio.run()` | Python 3.10+ | `asyncio.run()` creates fresh loop, closes cleanly |
| `db.execute(text("..."))` raw SQL | `select(Model).with_for_update()` | SQLAlchemy 2 | Type-safe, composable |

---

## Open Questions

1. **Bet cap with unique constraint interaction**
   - What we know: `UNIQUE (bet_id, user_id)` on bet_positions means one row per user per market. Cost is always 1 bp. Cap formula = floor(log10(kp+1)) + 1.
   - What's unclear: If cap = 1 (kp=0 → cap=1) and user has 0 kp, can they place any bet at all? Yes — cap=1 means 1 position allowed. The unique constraint is the effective enforcement. If cap >= 2 (future multi-bet), the unique constraint would need to be dropped. For Phase 2: implement cap check, but the unique constraint is the real guard.
   - Recommendation: Implement cap check as specified (BET-04). Document that for Phase 2 the practical maximum is 1 position per market per user.

2. **Daily allocation task runs day's kp correctly**
   - What we know: `day_date` column on kp_events. Reset happens by inserting a negative KpEvent. The task runs at 00:00 UTC.
   - What's unclear: If the task runs at 00:00 UTC and queries `day_date = today`, does it query the day being reset (yesterday) or today? The kp from yesterday is what drives the allocation.
   - Recommendation: In the task, query `day_date = yesterday` for the kp sum, then insert the reset KpEvent for `day_date = yesterday` (large negative matching yesterday's total). Credit the bp_transaction with today's date. This preserves audit trail accuracy.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|------------------|
| Use `uv` as Python package manager; always `uv run` | All backend commands use `uv run pytest`, `uv run celery` |
| No overengineering; no defensive programming | Keep services short; no retry logic in Phase 2 tasks |
| Short modules, short methods | Split services by domain (economy, market, bet, comment) |
| Use `uv add` for new packages | No new packages needed — verify before adding anything |
| Backend: FastAPI + SQLAlchemy 2 async | Confirmed — all patterns follow async patterns |
| Frontend: Next.js 16 (NOT 15 — confirmed via package.json ^16.0.0) | Use `src/proxy.ts` pattern (not middleware.ts — but Phase 1 used middleware.ts, so existing code uses that name; verify which name Next.js 16 actually uses) |
| Docker single command: `docker compose up --build` | Celery beat must be added as a service, not a manual step |
| HTTPS everywhere | Already handled by Nginx; no change needed |
| No console errors in latest Chrome | React Query + Zustand handle client side; avoid unhandled promise rejections |

**Important clarification on Next.js 16 naming:** STATE.md documents "Next.js 16 renames middleware.ts to proxy.ts — route guard uses src/proxy.ts with exported 'proxy' function." However, the actual file on disk is `src/middleware.ts` (verified). Phase 1 may have documented the rename but the actual implementation stayed as middleware.ts. The middleware exports `middleware` (standard name). Do not rename this file in Phase 2.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — verified by reading all model files, auth routes, conftest, celery_app, package.json, pyproject.toml
- `plan/ECONOMY.md` — authoritative formulas for kp, bp, tp, daily allocation, withdrawal refund
- `plan/DATABASE.md` — authoritative schema including indexes and concurrency model
- `02-CONTEXT.md` — all locked decisions (D-01 through D-17)
- SQLAlchemy 2 docs pattern for `with_for_update()` — verified against installed version 2.0.36+
- Celery 5 docs pattern for `beat_schedule` — verified against installed version 5.6.2

### Secondary (MEDIUM confidence)
- `plan/PLANNING.md` §2–5 — UX flows and page list (partially read, first 150 lines confirmed relevant sections)

### Tertiary (LOW confidence)
- None — all critical findings are from codebase inspection and canonical docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in pyproject.toml and package.json
- Architecture: HIGH — follows established Phase 1 patterns exactly; models already migrated
- Pitfalls: HIGH — identified from direct code inspection (signup bonus missing, middleware matcher gap, beat service missing)
- Economy formulas: HIGH — sourced from ECONOMY.md + CONTEXT.md locked decisions

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable stack; no fast-moving dependencies)
