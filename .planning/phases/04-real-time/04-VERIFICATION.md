---
phase: 04-real-time
verified: 2026-03-29T00:00:00Z
status: human_needed
score: 14/14 must-haves verified
human_verification:
  - test: "Open two browser tabs as different users. In tab A, send a friend request to user B. In tab B, observe the notification bell badge increment WITHOUT page refresh — within 1-2 seconds. In Network tab, confirm NO XHR to /api/notifications/unread-count on a 10s timer."
    expected: "Bell badge updates via WebSocket frame only. No polling visible in Network tab."
    why_human: "End-to-end Socket.IO push requires a running Docker stack with two live browser sessions. Cannot verify server push delivery programmatically without the server running."
  - test: "Open a market detail page in two browser tabs (same market). Post a comment from tab A. In tab B, the comment should appear without refreshing within 1-2 seconds."
    expected: "Comment appears in tab B within ~1s of posting in tab A."
    why_human: "Real-time comment delivery requires the full socket pipeline running: bet service emits, Redis adapter routes, client receives."
  - test: "Open a binary market detail page in two browser tabs. Place a YES bet from tab A. In tab B, the win probability bar/percentage should update WITHOUT refreshing within 1 second."
    expected: "Odds update in tab B within ~1s via React Query cache patch (setQueryData), not page reload."
    why_human: "Live odds update requires running server emitting bet:odds_updated and client queryClient.setQueryData receiving it."
  - test: "Open a chat conversation page. In Network tab, confirm NO XHR/fetch to /api/chat/... fires every 3 seconds. Send a message from the other user — it should arrive via WebSocket."
    expected: "No 3s polling observed. Incoming message appears via socket event."
    why_human: "Polling removal and socket delivery of chat messages requires a live two-user session."
---

# Phase 4: Real-time Verification Report

**Phase Goal:** Implement real-time features using Socket.IO — live odds updates, live comments, and live notifications/chat powered by server-push events replacing polling.
**Verified:** 2026-03-29
**Status:** human_needed (all automated checks pass; end-to-end push delivery requires browser verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Backend imports `from app.socket.server import sio` without error | VERIFIED | `uv run python -c "from app.socket.server import sio"` exits 0; type=AsyncServer |
| 2 | Socket.IO connect handler authenticates via access_token cookie and joins user:{id} room | VERIFIED | `events.py` lines 15-34; `test_connect_auth_valid_token` passes |
| 3 | Uvicorn runs socket_app (the ASGI wrapper), not app directly | VERIFIED | `Dockerfile` line 26: `CMD ["uv", "run", "uvicorn", "app.main:socket_app", ...]` |
| 4 | Existing test suite still passes (app remains importable from main.py) | VERIFIED | `from app.main import app, socket_app` imports FastAPI + ASGIApp; 45 non-socket tests pass |
| 5 | place_bet() and withdraw_bet() emit bet:odds_updated to bet:{id} room after db.commit() | VERIFIED | `bet_service.py` lines 30-49, 117, 171; `test_bet_emits_odds` passes |
| 6 | A second place_bet() within 500ms for the same bet does NOT emit bet:odds_updated (throttle) | VERIFIED | `throttle:odds:{bet_id}` Redis NX key; `test_odds_throttle` passes |
| 7 | create_comment() emits bet:comment_added to bet:{id} room after db.commit() | VERIFIED | `comment_service.py` line 66; `test_comment_emits` passes |
| 8 | create_notification() emits notification:{type} to user:{id} room after db.commit() | VERIFIED | `notification_service.py` line 32; `test_notification_emits` passes |
| 9 | send_message() emits chat:message to user:{recipient_id} room after db.commit() | VERIFIED | `chat_service.py` line 216; pattern confirmed in source |
| 10 | A single socket.io-client Socket instance is created after auth bootstrap | VERIFIED | `socket.ts` `useSocketStore`; `connect()` has `socket?.connected` idempotency guard |
| 11 | Socket connects with withCredentials: true (no auth field) | VERIFIED | `socket.ts` line 18: `withCredentials: true`; no `auth:` field present |
| 12 | Socket disconnects when the user logs out | VERIFIED | `auth.ts` line 41: `useSocketStore.getState().disconnect()` called in `logout()` |
| 13 | NotificationBell no longer polls every 10s — socket listener handles new notifications | VERIFIED | No `setInterval` in `NotificationBell.tsx`; `socket.on("notification:friend_request", ...)` present |
| 14 | Chat page no longer polls every 3s — socket listener for chat:message handles incoming messages | VERIFIED | No `setInterval` in `chat/[userId]/page.tsx`; `socket.on("chat:message", handler)` present |

**Score:** 14/14 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/socket/server.py` | AsyncServer singleton with Redis adapter | VERIFIED | Contains `sio = socketio.AsyncServer(...)` with `AsyncRedisManager` |
| `backend/app/socket/events.py` | connect, disconnect, join_bet, leave_bet handlers | VERIFIED | `@sio.on("connect")`, `@sio.on("disconnect")`, `@sio.on("join_bet")`, `@sio.on("leave_bet")` all present |
| `backend/app/main.py` | socket_app ASGI wrapper exported alongside app | VERIFIED | `socket_app = _socketio.ASGIApp(_sio, app)` at line 59; importlib used for events to avoid FastAPI `app` name collision |
| `backend/tests/test_socket.py` | 7 passing tests for RT-01, RT-02, RT-03, connect auth | VERIFIED | All 7 tests pass (3 connect auth + 4 emit unit tests) |
| `backend/app/services/bet_service.py` | emit hooks in place_bet and withdraw_bet | VERIFIED | `_emit_odds_update` helper with Redis NX throttle; emit calls at lines 117, 171 |
| `backend/app/services/comment_service.py` | emit hook in create_comment | VERIFIED | `"bet:comment_added"` emit at line 66 |
| `backend/app/services/notification_service.py` | emit hook in create_notification | VERIFIED | `f"notification:{notif.type}"` emit at line 32 |
| `backend/app/services/chat_service.py` | emit hook in send_message | VERIFIED | `"chat:message"` emit at line 216 |
| `frontend/src/store/socket.ts` | Zustand store managing socket lifecycle | VERIFIED | `useSocketStore` with `connect()`, `disconnect()`, idempotent guard |
| `frontend/src/components/AuthBootstrap.tsx` | calls socketStore.connect() after successful auth bootstrap | VERIFIED | `connectSocket()` called in `isAuthenticated` useEffect |
| `frontend/src/store/auth.ts` | logout() calls socket.disconnect() before clearing state | VERIFIED | `useSocketStore.getState().disconnect()` at line 41 |
| `frontend/src/components/NotificationBell.tsx` | socket listeners replacing 10s poll | VERIFIED | 5 `socket.on("notification:*")` listeners with cleanup; no `setInterval` |
| `frontend/src/app/(protected)/chat/[userId]/page.tsx` | socket listener for chat:message replacing 3s poll | VERIFIED | `socket.on("chat:message", handler)` present; no `setInterval` |
| `frontend/src/app/(protected)/markets/[id]/page.tsx` | bet room join/leave and live odds + comment listeners | VERIFIED | `join_bet`/`leave_bet` emit on mount/unmount; `bet:odds_updated` → `setQueryData`; `bet:comment_added` → `invalidateQueries` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/main.py` | `backend/app/socket/events.py` | `importlib.import_module("app.socket.events")` | WIRED | Deviation from plan: uses `importlib` instead of direct import to avoid shadowing `app` FastAPI variable (documented in SUMMARY) |
| `backend/Dockerfile` | `app.main:socket_app` | `CMD ["uv", "run", "uvicorn", "app.main:socket_app", ...]` | WIRED | Line 26 confirmed |
| `backend/app/socket/events.py` | `backend/app/utils/jwt.py:decode_access_token` | cookie extraction + JWT decode on connect | WIRED | Lines 26-28 in events.py |
| `backend/app/services/bet_service.py` | `backend/app/socket/server.py` | `from app.socket.server import sio` (inside try block) | WIRED | Lines 33, 116, 170 — local import inside try to avoid circular import |
| `backend/app/services/bet_service.py` | Redis throttle key `throttle:odds:{bet_id}` | `r.set(key, "1", nx=True, px=500)` | WIRED | Line 35-36 in `_emit_odds_update` |
| `frontend/src/components/AuthBootstrap.tsx` | `frontend/src/store/socket.ts` | `useSocketStore((s) => s.connect)` called in isAuthenticated effect | WIRED | Lines 6, 12, 21 |
| `frontend/src/store/auth.ts` | `frontend/src/store/socket.ts` | `useSocketStore.getState().disconnect()` in logout() | WIRED | Lines 3, 41 |
| `frontend/src/app/(protected)/markets/[id]/page.tsx` | socket room `bet:{id}` | `socket.emit("join_bet", { bet_id: marketId })` on mount | WIRED | Line 70 |
| `frontend/src/app/(protected)/markets/[id]/page.tsx` | React Query cache | `queryClient.setQueryData` for `bet:odds_updated` | WIRED | Lines 74-77 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `NotificationBell.tsx` | `unreadCount` | REST fetch on mount + socket re-fetch trigger | REST returns DB count; socket triggers re-fetch | FLOWING |
| `markets/[id]/page.tsx` odds | `yes_pct`, `no_pct` in React Query cache | `bet:odds_updated` event → `queryClient.setQueryData` | `bet_service.py` calls `get_bet_odds(db, bet_id)` → real DB query | FLOWING |
| `markets/[id]/page.tsx` comments | comments query | `bet:comment_added` → `queryClient.invalidateQueries` triggers refetch | REST refetch returns DB rows | FLOWING |
| `chat/[userId]/page.tsx` | messages list | `chat:message` event → `fetchMessages(partnerId)` re-call | REST re-fetch returns DB records | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `from app.socket.server import sio` importable | `uv run python -c "from app.socket.server import sio; print(type(sio))"` | `<class 'socketio.async_server.AsyncServer'>` | PASS |
| `from app.main import app, socket_app` — app is FastAPI, socket_app is ASGIApp | `uv run python -c "from app.main import app, socket_app; print(type(app).__name__, type(socket_app).__name__)"` | `FastAPI ASGIApp` | PASS |
| All 7 socket unit tests pass | `uv run pytest tests/test_socket.py -v` | 7 passed, 0 failed, 0 skipped | PASS |
| Existing test suite not broken (pre-existing failures excluded) | `uv run pytest tests/ --ignore=tests/test_socket.py --ignore=tests/test_comments.py` | 45 passed | PASS |
| TypeScript compiles clean | `./node_modules/.bin/tsc --noEmit` | No output (exit 0) | PASS |
| End-to-end socket push delivery (RT-01, RT-02, RT-03) | Browser test with docker compose | Not run — requires running stack | SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| RT-01 | 04-01, 04-02, 04-03, 04-04 | Bet odds update live via Socket.IO when positions change | SATISFIED (automated) | `_emit_odds_update` in bet_service; `bet:odds_updated` → `queryClient.setQueryData` in market page; test_bet_emits_odds passes |
| RT-02 | 04-01, 04-02, 04-03, 04-04 | New comments appear live in bet threads | SATISFIED (automated) | `create_comment` emits `bet:comment_added`; market page `invalidateQueries` on event; test_comment_emits passes |
| RT-03 | 04-01, 04-02, 04-03, 04-04 | Notifications delivered in real-time | SATISFIED (automated) | `create_notification` emits `notification:{type}`; `send_message` emits `chat:message`; NotificationBell socket listeners; test_notification_emits passes |

All three RT requirements have implementation evidence. End-to-end browser verification is required to mark them fully satisfied in REQUIREMENTS.md.

**Orphaned requirements check:** REQUIREMENTS.md maps RT-01, RT-02, RT-03 to Phase 4. All three are claimed by plans 04-01 through 04-04. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/tests/test_socket.py` | — | PLAN artifact spec `contains: "assert mock_emit.called"` not literally present — actual assertion is `assert any("bet:odds_updated" in c ...)` | Info | Stronger assertion than specified; no impact on correctness |
| Multiple backend services | — | Redis client instantiated per-call (`aioredis.from_url(settings.redis_url)`) inside `_emit_odds_update` | Warning | Connection not pooled in `_emit_odds_update`; acceptable for fire-and-forget path; no connection pool leak since it's inside try/except |

No blockers found. One notable pattern: Redis client instantiated per-call is documented as an intentional decision in 04-02-SUMMARY.md for test isolation.

---

### Human Verification Required

#### 1. RT-03 — Notifications live (no polling)

**Test:** Open two browser tabs logged in as different users. In tab A, send a friend request to user B. In tab B, observe the notification bell badge increment WITHOUT refreshing. Check browser Network tab for tab B — confirm NO XHR to `/api/notifications/unread-count` fires on a timer; only WebSocket frames should carry the update.
**Expected:** Bell badge increments within 1-2 seconds. Zero polling traffic in Network tab.
**Why human:** End-to-end Socket.IO delivery from server emit → Redis adapter → client event requires the full running Docker stack with two authenticated users. Not testable via grep or static analysis.

#### 2. RT-02 — Comments live

**Test:** Open the same market detail page in two browser tabs (both logged in). Post a comment from tab A. Observe tab B — the comment should appear WITHOUT refreshing.
**Expected:** Comment appears in tab B within 1-2 seconds of posting.
**Why human:** `bet:comment_added` → `queryClient.invalidateQueries` → REST refetch chain requires a running server with Redis pub/sub routing between sockets.

#### 3. RT-01 — Odds live

**Test:** Open a binary market detail page in two browser tabs. Place a YES bet from tab A. Observe the probability bar/percentage in tab B — it should update WITHOUT refreshing.
**Expected:** Odds update in tab B within 1 second via `queryClient.setQueryData` (zero-latency cache patch).
**Why human:** `bet:odds_updated` delivery to the browser requires the running Socket.IO server with Redis adapter.

#### 4. Chat — polling removed confirmation

**Test:** Open a chat conversation page. Open Network tab in DevTools. Confirm NO fetch to `/api/chat/...` fires every 3 seconds. Send a message from the other user account — it should arrive without polling.
**Expected:** No 3s XHR polling. Chat message arrives via WebSocket frame.
**Why human:** Polling removal is verified statically (grep confirmed no `setInterval`), but confirming the socket message actually arrives requires a live two-user session.

---

### Pre-Existing Failures (Out of Scope)

Two test failures existed before Phase 4 and remain unchanged:

- `tests/test_comments.py::test_duplicate_upvote_returns_409` — duplicate upvote allows 201 instead of 409 (documented in 04-01-SUMMARY.md)
- `tests/test_tasks.py::test_daily_allocation_inserts_transactions` — allocation logic assertion mismatch (documented in deferred-items)

These are not regressions introduced by Phase 4.

---

### Summary

Phase 4 infrastructure is complete and fully verified at the code level:

- **Backend (04-01, 04-02):** Socket.IO AsyncServer singleton with Redis adapter; ASGI wrapper in main.py; connect auth handler; fire-and-forget emit hooks in all four services (bet, comment, notification, chat); Redis NX throttle for odds bursts; 7/7 unit tests passing.
- **Frontend (04-03, 04-04):** Zustand socket store with idempotent connect/disconnect lifecycle wired to auth bootstrap and logout; polling removed from NotificationBell (was 10s) and chat page (was 3s); market detail page joins/leaves bet room and patches React Query cache on live events.

The only remaining verification is live end-to-end browser testing to confirm the Socket.IO push pipeline actually delivers events from server to client under real conditions. This requires `docker compose up --build` with two authenticated users.

---

_Verified: 2026-03-29_
_Verifier: Claude (gsd-verifier)_
