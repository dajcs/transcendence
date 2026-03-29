# Phase 4: Real-time - Research

**Researched:** 2026-03-29
**Domain:** Socket.IO (python-socketio + socket.io-client), FastAPI ASGI integration, Redis pub-sub
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Mount python-socketio as `socketio.ASGIApp(sio, fastapi_app)` ASGI wrapper — replaces `app` as uvicorn entrypoint. Dockerfile/entrypoint changes from `uvicorn app.main:app` to `uvicorn app.main:socket_app`.
- **D-02:** `sio` (AsyncServer) is a module-level singleton in `backend/app/socket/server.py`. All services and event handlers import from this file. Avoids circular imports.
- **D-03:** python-socketio uses Redis adapter (`python-socketio[asyncio_client]` + `aioredis` pub-sub) even on single server — prep for horizontal scale.
- **D-04:** Socket.IO client connects with `withCredentials: true` (NOT `auth: { token }` from REALTIME.md — incompatible with httpOnly cookies).
- **D-05:** Server reads `access_token` cookie from ASGI scope headers in `connect` event handler — same RS256 decode as `decode_access_token()` in `app/utils/jwt.py`.
- **D-06:** Server auto-joins authenticated user to `user:{user_id}` room on connect. Client emits `join_bet` / `leave_bet` for bet rooms.
- **D-07:** Emit calls go inside service functions, not route handlers:
  - `bet_service.place_bet()` → emit `bet:odds_updated` + `bet:position_added` to `bet:{id}`
  - `bet_service.withdraw_bet()` → emit `bet:odds_updated` + `bet:position_withdrawn`
  - `comment_service.create_comment()` → emit `bet:comment_added` to `bet:{id}`
  - `notification_service.create_notification()` → emit `notification:*` to `user:{id}`
- **D-08:** Emit calls are fire-and-forget in services (wrapped in `try/except`). Emit failure never blocks REST response.
- **D-09:** Single shared socket instance per authenticated session, managed in new Zustand store `frontend/src/store/socket.ts` or React context wrapping protected layout.
- **D-10:** Replace `setInterval` polling in `NotificationBell.tsx` (10s) with socket event listener for `notification:*` events.
- **D-11:** Replace `setInterval` polling in `chat/[userId]/page.tsx` (3s) with socket listener for `chat:message` in `user:{id}` room.
- **D-12:** Bet detail page joins `bet:{id}` on mount, leaves on unmount. `bet:odds_updated` and `bet:comment_added` trigger local state updates.
- **D-13:** Phase 4 implements RT-01, RT-02, RT-03. `dispute:*` and `bet:resolved` events wired in Phase 5.
- **D-14:** Odds throttle: Redis key `throttle:odds:{bet_id}` with 500ms TTL. Skip emit if key exists.
- **D-15:** Nginx `/socket.io/` location block already exists with WebSocket upgrade headers — no Nginx config changes needed.

### Claude's Discretion

- Exact ASGI entrypoint variable name (`socket_app` vs `application`)
- Whether socket singleton lives in Zustand store or React context (both valid)
- Redis pub-sub channel naming convention for python-socketio adapter
- Exact `seq` counter implementation for stale-state detection (optional for v1)

### Deferred Ideas (OUT OF SCOPE)

- `dispute:*` and `bet:resolved` socket events — Phase 5
- `global:trending_bet` room — Phase 6 / backlog
- Per-user emit rate limiting (60 events/min) — implement only if needed; not a 42 requirement
- `seq` stale-state detection counter — optional for v1; reconnect REST-refetch covers the use case
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Bet odds update live via Socket.IO when positions change | D-07: `place_bet`/`withdraw_bet` emit `bet:odds_updated`; D-14: 500ms throttle via Redis TTL |
| RT-02 | New comments appear live in bet threads | D-07: `create_comment` emits `bet:comment_added`; D-12: bet detail page joins/leaves room |
| RT-03 | Notifications delivered in real-time | D-07: `create_notification` emits `notification:*`; D-10: replaces 10s polling in NotificationBell |
</phase_requirements>

---

## Summary

Phase 4 connects a python-socketio AsyncServer to the existing FastAPI app via an ASGI wrapper. All architectural decisions are locked — the planner consumes this research to produce concrete task plans with no ambiguity about library choices, integration patterns, or placement of emit calls.

The stack is entirely greenfield additions to an existing working app: one new Python file (`backend/app/socket/server.py`), one new event handler module (`backend/app/socket/events.py`), emit hooks in three existing services, an entrypoint variable rename, and a frontend socket singleton store. The existing app runs in Docker with Redis available; python-socketio is not yet installed.

The primary risk is the ASGI wrapping breaking the existing test suite (conftest imports `from app.main import app` — this must remain the FastAPI app, not the socket wrapper). The plan must ensure `app` stays importable from `main.py` as before; only `socket_app` is new.

**Primary recommendation:** Add `socket_app = socketio.ASGIApp(sio, app)` at the bottom of `main.py` and update the Dockerfile `CMD` only — do not rename or move `app`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-socketio | 5.16.1 (PyPI current) | Async Socket.IO server, ASGI integration | Official Python Socket.IO implementation with asyncio/ASGI support |
| socket.io-client | 4.8.3 (resolved in lockfile) | TypeScript Socket.IO client | Already in `package.json ^4.0.0`; already installed |
| redis[asyncio] | 7.4.0 (in container) | Redis pub-sub adapter for python-socketio | Already in pyproject.toml; handles `AsyncRedisManager` backend |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-socketio[asyncio_client] | same as above | Asyncio-compatible extras | Required flag for `AsyncRedisManager` in python-socketio |
| fakeredis | 2.34.1 (in dev deps) | Fake Redis for tests | Test fixtures already use it; socket tests will mock the Redis adapter |

**Installation (backend only — frontend already has socket.io-client):**
```bash
uv add "python-socketio[asyncio_client]"
```

**Version verification:** python-socketio 5.16.1 verified at PyPI 2026-03-29. `redis[asyncio]` 7.4.0 already in container. `socket.io-client` 4.8.3 resolved from package-lock.json.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-socketio AsyncServer | websockets + custom protocol | Would require hand-rolling rooms, namespaces, reconnection — vastly more work |
| Cookie auth on connect | `auth: { token }` field | Locked out by D-04; httpOnly cookies cannot be read by JS, so socket.io `auth` field approach is incompatible |

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
backend/app/
├── socket/
│   ├── __init__.py
│   ├── server.py       # sio = AsyncServer(...); module-level singleton
│   └── events.py       # @sio.on("connect"), @sio.on("join_bet"), etc.
├── main.py             # existing; ADD socket_app = socketio.ASGIApp(sio, app) at bottom
└── services/
    ├── bet_service.py  # ADD emit hooks in place_bet, withdraw_bet
    ├── comment_service.py  # ADD emit hook in create_comment
    └── notification_service.py  # ADD emit hook in create_notification

frontend/src/
├── store/
│   └── socket.ts       # NEW: Zustand store managing socket lifecycle
└── components/
    └── SocketProvider.tsx  # NEW (optional): connects socket on auth bootstrap
```

### Pattern 1: AsyncServer Singleton

**What:** Single `sio = socketio.AsyncServer(...)` in `backend/app/socket/server.py`. All other modules import `sio` from this file.
**When to use:** Always — avoids circular imports between main.py, services, and event handlers.

```python
# backend/app/socket/server.py
import socketio
from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],   # CORS handled by Nginx; wildcard is insecure
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
)
```

**Note on `cors_allowed_origins=[]`:** python-socketio handles its own CORS independently of FastAPI's CORSMiddleware. Since Nginx proxies all traffic and handles CORS, set `cors_allowed_origins=[]` (empty list = deny all direct CORS on socketio) or pass the explicit origin. Do NOT pass `"*"` — it conflicts with `withCredentials: true`.

### Pattern 2: ASGI Wrapping in main.py

**What:** `socket_app` wraps the FastAPI `app`. Uvicorn runs `socket_app`, not `app`.
**When to use:** Required for ASGI Socket.IO integration with FastAPI.

```python
# backend/app/main.py  (add at the very bottom, after all route includes)
import socketio
from app.socket.server import sio

# ... existing app setup ...

socket_app = socketio.ASGIApp(sio, app)
```

**Critical:** `app` (FastAPI instance) must NOT be renamed — `conftest.py` imports it directly: `from app.main import app`. The test suite uses `ASGITransport(app=app)` and will break if `app` is replaced by `socket_app`. Keep both names.

### Pattern 3: Cookie Auth in Connect Handler

**What:** Extract and decode `access_token` cookie from ASGI scope in the `connect` event.
**When to use:** Every socket connection (D-05 locked).

```python
# backend/app/socket/events.py
from app.socket.server import sio
from app.utils.jwt import decode_access_token

@sio.on("connect")
async def on_connect(sid, environ, auth):
    """Authenticate via httpOnly cookie forwarded in ASGI scope headers."""
    headers = dict(environ.get("asgi.scope", {}).get("headers", []))
    cookie_header = headers.get(b"cookie", b"").decode("utf-8", errors="ignore")

    token = _extract_cookie(cookie_header, "access_token")
    if not token:
        raise ConnectionRefusedError("authentication required")

    try:
        payload = decode_access_token(token)
    except Exception:
        raise ConnectionRefusedError("invalid token")

    user_id = payload["sub"]
    await sio.save_session(sid, {"user_id": user_id})
    await sio.enter_room(sid, f"user:{user_id}")
    await sio.enter_room(sid, "global")


def _extract_cookie(cookie_header: str, name: str) -> str | None:
    for part in cookie_header.split(";"):
        key, _, val = part.strip().partition("=")
        if key.strip() == name:
            return val.strip()
    return None
```

**Note on ASGI environ:** python-socketio passes the raw ASGI scope as `environ["asgi.scope"]`. Headers are a list of `(bytes, bytes)` tuples — convert to dict with `dict(scope["headers"])`. Key is lowercase `b"cookie"`.

### Pattern 4: Fire-and-Forget Emit in Services

**What:** Services emit events after committing to DB; failure is silently swallowed.
**When to use:** All emit calls in services (D-07, D-08 locked).

```python
# In bet_service.py, after await db.commit() in place_bet():
from app.socket.server import sio

try:
    odds = await get_bet_odds(db, data.bet_id)
    await sio.emit("bet:odds_updated", {
        "bet_id": str(data.bet_id),
        "yes_pct": float(odds["yes_pct"]),
        "no_pct": float(odds["no_pct"]),
        "total_votes": int(odds.get("total_votes", 0)),
    }, room=f"bet:{data.bet_id}")
    await sio.emit("bet:position_added", {
        "user_id": str(user_id),
        "side": data.side,
        "placed_at": position.placed_at.isoformat(),
    }, room=f"bet:{data.bet_id}")
except Exception:
    pass  # never block REST response
```

### Pattern 5: Odds Throttle via Redis

**What:** Before emitting `bet:odds_updated`, check a Redis TTL key. Skip emit if key exists.
**When to use:** `bet:odds_updated` only (D-14 locked). Comment/notification events not throttled.

```python
import redis.asyncio as aioredis
from app.config import settings

_redis_client: aioredis.Redis | None = None

async def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client

async def _should_emit_odds(bet_id: str) -> bool:
    """Returns True and sets throttle key if 500ms window is clear."""
    r = await _get_redis()
    key = f"throttle:odds:{bet_id}"
    # SET NX with 500ms PX expiry — atomic check-and-set
    result = await r.set(key, "1", nx=True, px=500)
    return result is True
```

### Pattern 6: Frontend Socket Store (Zustand)

**What:** Zustand store managing the socket.io-client lifecycle. Follows the same shape as existing stores.
**When to use:** One instance for the whole app lifetime (D-09 locked).

```typescript
// frontend/src/store/socket.ts
import { create } from "zustand";
import { io, Socket } from "socket.io-client";

interface SocketStore {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketStore>()((set, get) => ({
  socket: null,

  connect: () => {
    if (get().socket?.connected) return;
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:8443", {
      withCredentials: true,        // sends httpOnly access_token cookie
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },
}));
```

**Integration point:** Call `connect()` inside `AuthBootstrap.tsx` after successful `bootstrap()`, and `disconnect()` inside `useAuthStore.logout()`.

### Pattern 7: Bet Room Join/Leave in React

**What:** Bet detail page joins room on mount, leaves on unmount. Incoming events update React Query cache.
**When to use:** `frontend/src/app/(protected)/markets/[id]/page.tsx` (D-12 locked).

```typescript
useEffect(() => {
  const { socket } = useSocketStore.getState();
  if (!socket) return;

  socket.emit("join_bet", { bet_id: marketId });

  socket.on("bet:odds_updated", (data) => {
    queryClient.setQueryData(["market", marketId], (old: Market | undefined) =>
      old ? { ...old, yes_pct: data.yes_pct, no_pct: data.no_pct } : old
    );
  });

  socket.on("bet:comment_added", () => {
    queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
  });

  return () => {
    socket.emit("leave_bet", { bet_id: marketId });
    socket.off("bet:odds_updated");
    socket.off("bet:comment_added");
  };
}, [marketId, queryClient]);
```

### Anti-Patterns to Avoid

- **Importing `socket_app` in tests:** `conftest.py` uses `from app.main import app`. If `socket_app` replaces `app`, httpx `ASGITransport` will try to route through the socketio ASGI wrapper, which breaks all REST test requests. Always keep `app` as the FastAPI instance.
- **Circular imports via main.py:** Never import `sio` from `main.py`. Services should import from `backend/app/socket/server.py` directly.
- **Forgetting to import `events.py` in main.py:** python-socketio event handlers are registered via decorators at import time. If `events.py` is never imported, no events will be handled. Add `import app.socket.events` at the bottom of `main.py` (after the `sio` import).
- **CORS wildcard with credentials:** `cors_allowed_origins="*"` is incompatible with `withCredentials: true` on the client. Browsers reject `Access-Control-Allow-Origin: *` when credentials are included.
- **Multiple socket instances on frontend:** Creating a new `io(...)` on every component render floods the server with connections. The Zustand store singleton prevents this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room broadcasting | Custom fan-out logic | `sio.emit(..., room=...)` | python-socketio handles room membership and multi-server broadcast via Redis |
| Reconnection | Custom WebSocket retry | socket.io-client `reconnectionAttempts` config | Handles exponential backoff, connection state, re-join logic |
| Pub-sub for horizontal scale | Custom Redis channel subscriptions | `socketio.AsyncRedisManager` | Built-in; handles serialization, channel naming, delivery |
| Cookie parsing in connect | `http.cookies` module or regex | `_extract_cookie` helper (3 lines) | The ASGI environ gives raw header bytes — simple string split is correct and sufficient |

---

## Common Pitfalls

### Pitfall 1: Test Suite Breaks After ASGI Wrap

**What goes wrong:** After adding `socket_app = socketio.ASGIApp(sio, app)`, the conftest `from app.main import app` still works but if someone changes the Dockerfile CMD to `app.main:socket_app` without also updating conftest, tests that use `app` will hit Socket.IO's ASGI layer instead of FastAPI, causing 404s on all REST routes.
**Why it happens:** `socketio.ASGIApp` intercepts `/socket.io/` traffic and passes everything else to the mounted FastAPI app. `ASGITransport(app=socket_app)` would route through it; `ASGITransport(app=app)` bypasses it. Both work correctly for their purpose.
**How to avoid:** Keep `conftest.py` pointing to `app` (FastAPI instance), never `socket_app`. Only the Dockerfile CMD uses `socket_app`.
**Warning signs:** `404 Not Found` on `/api/health` in tests after the ASGI wrap.

### Pitfall 2: Events Module Never Imported

**What goes wrong:** `@sio.on("connect")` decorator registers the handler at import time. If `app/socket/events.py` is never imported, no `connect`, `join_bet`, or `leave_bet` handlers are registered. Connections succeed (socket.io accepts them by default) but users are never authenticated or joined to rooms.
**Why it happens:** Python doesn't auto-discover modules; decorators only run when the file is executed.
**How to avoid:** Add `import app.socket.events  # noqa: F401` in `main.py` after the sio import.
**Warning signs:** All socket connections accepted but users receive no events; rooms are empty.

### Pitfall 3: Redis Adapter URL Format

**What goes wrong:** `socketio.AsyncRedisManager("redis://redis:6379")` fails silently or raises if the URL scheme is wrong.
**Why it happens:** python-socketio uses `aioredis` under the hood; URL must be `redis://` scheme. The existing `settings.redis_url` is `redis://redis:6379` — correct. But verify the env var.
**How to avoid:** Use `settings.redis_url` directly (already validated at startup). Do not hardcode.
**Warning signs:** `ConnectionError` or `TimeoutError` on first socket connection; check backend logs.

### Pitfall 4: Socket Connects Before Auth Bootstrap Completes

**What goes wrong:** If the socket `connect()` call fires before `AuthBootstrap` has finished the `/api/auth/me` fetch, the `access_token` cookie may not yet be set (race condition on initial page load). The connection is refused.
**Why it happens:** `AuthBootstrap` is async; socket connect fires on mount of the same component tree.
**How to avoid:** Call `socket.connect()` inside the `AuthBootstrap` component after `bootstrap()` resolves successfully, not in a parallel effect. The socket store's `connect()` is idempotent (checks `socket?.connected`).
**Warning signs:** Intermittent "authentication required" errors on first load; refresh resolves it.

### Pitfall 5: CORS Conflict Between FastAPI and python-socketio

**What goes wrong:** FastAPI CORSMiddleware and python-socketio both try to set `Access-Control-Allow-Origin` headers on socket.io HTTP polling requests, causing duplicate headers and browser CORS errors.
**Why it happens:** Socket.IO's HTTP long-polling transport uses regular HTTP requests that pass through both layers.
**How to avoid:** Set `cors_allowed_origins=[]` on `AsyncServer` (disables socket.io's own CORS handling) and rely on FastAPI's CORSMiddleware, which is already configured via `settings.allowed_hosts`. Alternatively, since Nginx handles CORS at the proxy level, neither layer needs to add these headers.
**Warning signs:** Browser console shows `CORS` errors on `/socket.io/?EIO=4&transport=polling` requests.

---

## Code Examples

### AsyncServer Singleton

```python
# backend/app/socket/server.py
import socketio
from app.config import settings

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[],
    client_manager=socketio.AsyncRedisManager(settings.redis_url),
)
```

### ASGI App Construction (main.py bottom)

```python
# backend/app/main.py — add at the end, after all router includes
import app.socket.events  # noqa: F401 — registers event handlers via decorators
import socketio as _sio_module
from app.socket.server import sio as _sio

socket_app = _sio_module.ASGIApp(_sio, app)
```

### Emit with Throttle (bet:odds_updated)

```python
# In bet_service.py place_bet() and withdraw_bet(), after db.commit()
async def _emit_odds_update(bet_id: uuid.UUID, db: AsyncSession) -> None:
    from app.socket.server import sio
    from app.services.economy_service import get_bet_odds
    import redis.asyncio as aioredis
    from app.config import settings

    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    throttle_key = f"throttle:odds:{bet_id}"
    if not await r.set(throttle_key, "1", nx=True, px=500):
        return  # within 500ms window; skip
    odds = await get_bet_odds(db, bet_id)
    await sio.emit("bet:odds_updated", {
        "bet_id": str(bet_id),
        "yes_pct": float(odds["yes_pct"]),
        "no_pct": float(odds["no_pct"]),
        "total_votes": int(odds.get("total_votes", 0)),
    }, room=f"bet:{bet_id}")
```

### Notification Socket Emit

```python
# notification_service.py — add after db.commit() in create_notification()
async def _emit_notification(user_id: uuid.UUID, notif: Notification) -> None:
    from app.socket.server import sio
    try:
        await sio.emit(
            f"notification:{notif.type}",
            {"id": str(notif.id), "type": notif.type, "payload": notif.payload, "created_at": notif.created_at.isoformat()},
            room=f"user:{user_id}",
        )
    except Exception:
        pass
```

### Frontend: Replace Polling in NotificationBell

```typescript
// NotificationBell.tsx — replace the setInterval useEffect
useEffect(() => {
  const { socket } = useSocketStore.getState();
  if (!socket) return;

  const handler = () => {
    fetchUnreadCount();  // REST fetch for count bump
  };

  // All notification subtypes: friend_request, new_message, bet_resolved, etc.
  socket.on("notification:friend_request", handler);
  socket.on("notification:friend_accepted", handler);
  socket.on("notification:new_message", handler);
  socket.on("notification:bet_resolved", handler);
  socket.on("notification:bet_disputed", handler);

  return () => {
    socket.off("notification:friend_request", handler);
    socket.off("notification:friend_accepted", handler);
    socket.off("notification:new_message", handler);
    socket.off("notification:bet_resolved", handler);
    socket.off("notification:bet_disputed", handler);
  };
}, [fetchUnreadCount]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling (setInterval) for notifications | Socket.IO push | Phase 4 | Eliminates 10s latency; reduces server load |
| Polling for chat messages | Socket.IO push | Phase 4 | Eliminates 3s latency |
| python-socketio `auth` field for JWT | Cookie forwarding (`withCredentials`) | Phase 4 decision (D-04) | Required because access_token is httpOnly |

**Deprecated/outdated:**
- REALTIME.md's `auth: { token: accessToken }` spec: Superseded by D-04. The spec predates the httpOnly cookie decision from Phase 1. Do NOT implement the auth field approach.

---

## Open Questions

1. **Notification event naming: wildcard vs. individual events**
   - What we know: REALTIME.md lists `notification:bp_credited`, `notification:bet_resolved`, `notification:dispute_result`. Existing notification types in the DB are `friend_request`, `friend_accepted`, `new_message`, `bet_resolved`, `bet_disputed`.
   - What's unclear: Whether to map existing DB notification types directly to socket event names (e.g., `notification:friend_request`) or use a single `notification` event with a `type` field in the payload.
   - Recommendation: Use individual named events matching DB `type` field (`notification:{type}`) — consistent with REALTIME.md pattern, allows targeted frontend listeners. No new notification types needed for Phase 4.

2. **Redis client reuse in throttle helper**
   - What we know: `redis[asyncio]` is already used in `auth_service.py` via a module-level `_redis` variable initialized lazily.
   - What's unclear: Whether the throttle helper should reuse a shared Redis client or create its own.
   - Recommendation: Create a shared `_get_redis()` helper in `backend/app/socket/server.py` (or a new `backend/app/utils/redis.py`) reused by both the socket events module and the throttle helper. Avoids multiple connection pools.

3. **Chat: socket event name for new messages**
   - What we know: REALTIME.md does not define a `chat:message` event. Existing chat uses REST. D-11 says "server emits to recipient's user room when a message is stored."
   - What's unclear: The exact event name for chat message push is not specified in REALTIME.md.
   - Recommendation: Use `chat:message` with payload `{ from_user_id, content, sent_at }`. Add this emit to `chat_service.send_message()` targeting `user:{recipient_id}` room.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Socket.IO pub-sub adapter, odds throttle | Yes | 7.4.0 (container) | — |
| python-socketio | Backend socket server | No — not yet installed | — | `uv add "python-socketio[asyncio_client]"` |
| socket.io-client | Frontend socket | Yes — in package.json | 4.8.3 (resolved) | — |
| Docker Compose stack | Integration testing | Yes | Docker 29.3.0 | — |
| redis[asyncio] (Python) | Redis adapter | Yes — 7.4.0 in container | 7.4.0 | — |
| fakeredis | Test mocking | Yes — in dev deps | 2.34.1 | — |

**Missing dependencies with no fallback:**
- `python-socketio` must be installed before any backend code referencing it can run. `uv add "python-socketio[asyncio_client]"` is the Wave 0 task.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.3+ with pytest-asyncio 0.24+ |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `docker compose exec backend uv run pytest tests/test_socket.py -x` |
| Full suite command | `docker compose exec backend uv run pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-01 | `place_bet` emits `bet:odds_updated` to room after commit | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_bet_emits_odds -x` | No — Wave 0 |
| RT-01 | Throttle skips second emit within 500ms | unit (fake Redis) | `docker compose exec backend uv run pytest tests/test_socket.py::test_odds_throttle -x` | No — Wave 0 |
| RT-02 | `create_comment` emits `bet:comment_added` | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_comment_emits -x` | No — Wave 0 |
| RT-03 | `create_notification` emits `notification:{type}` | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_notification_emits -x` | No — Wave 0 |
| RT-01..03 | Connect handler authenticates via cookie | unit (mock environ) | `docker compose exec backend uv run pytest tests/test_socket.py::test_connect_auth -x` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `docker compose exec backend uv run pytest tests/test_socket.py -x`
- **Per wave merge:** `docker compose exec backend uv run pytest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_socket.py` — covers RT-01, RT-02, RT-03 and connect auth
- [ ] Framework: `uv add "python-socketio[asyncio_client]"` — must be first task

**Testing strategy note:** python-socketio services are best tested by mocking `sio.emit` rather than standing up a live socket server. The `sio` singleton can be patched via `unittest.mock.AsyncMock` in pytest. The existing `fakeredis` fixture covers the Redis throttle key.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `backend/app/main.py`, `backend/app/services/bet_service.py`, `backend/app/services/comment_service.py`, `backend/app/services/notification_service.py`, `backend/app/utils/jwt.py`, `backend/app/config.py` — confirmed exact integration points
- Direct code inspection: `frontend/src/store/auth.ts`, `frontend/src/components/NotificationBell.tsx`, `frontend/src/app/(protected)/chat/[userId]/page.tsx` — confirmed polling patterns to replace
- `nginx/nginx.conf` inspected — `/socket.io/` block with WebSocket upgrade confirmed present (D-15 verified)
- `backend/pyproject.toml` — `redis[asyncio]>=5.2.0` already present; `python-socketio` absent (confirmed)
- `frontend/package.json` + `package-lock.json` — `socket.io-client ^4.0.0` present; 4.8.3 resolved
- `backend/tests/conftest.py` — `from app.main import app` pattern confirmed; test isolation requirement identified
- PyPI query: python-socketio 5.16.1 (2026-03-29)
- `docker compose ps` output — all services running; Redis 7.4.0 healthy in container
- `plan/REALTIME.md` — event catalog, room hierarchy, auth spec (source of truth for event names/payloads)
- `.planning/phases/04-real-time/04-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- python-socketio official docs pattern for `AsyncRedisManager` and ASGI integration — consistent with PyPI source code and REALTIME.md design
- ASGI environ headers access pattern (`environ["asgi.scope"]["headers"]`) — consistent across python-socketio issue tracker and docs examples

### Tertiary (LOW confidence)

- None — all critical claims verified from code or official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from pyproject.toml, package-lock.json, PyPI, running container
- Architecture: HIGH — all patterns derived from locked decisions in CONTEXT.md + direct code inspection
- Pitfalls: HIGH — derived from direct reading of conftest.py and existing code patterns; not speculative

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (python-socketio 5.x is stable; socket.io-client 4.x LTS)
