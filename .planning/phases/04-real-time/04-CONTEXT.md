# Phase 4: Real-time - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Live updates via Socket.IO throughout the app: bet odds update when positions change, comments appear without refresh, notifications arrive instantly. Replace existing polling (chat every 3s, notifications every 10s) with push. Online status tracking via connection presence.

Resolution system, LLM, OAuth, and i18n are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Backend Integration Architecture
- **D-01:** Mount python-socketio as `socketio.ASGIApp(sio, fastapi_app)` ASGI wrapper — this replaces `app` as the uvicorn entrypoint. The Dockerfile/entrypoint command changes from `uvicorn app.main:app` to `uvicorn app.main:socket_app` (or equivalent).
- **D-02:** `sio` (AsyncServer) is a module-level singleton in `backend/app/socket/server.py`. All services and event handlers import from this file. Avoids circular imports since `main.py` imports services and services import `sio` — both trace to the shared singleton, not to each other.
- **D-03:** python-socketio uses Redis adapter (`python-socketio[asyncio_client]` + `aioredis` pub-sub) even on single server — prep for horizontal scale as per REALTIME.md. Redis is already in the stack.

### Authentication
- **D-04:** REALTIME.md spec (`auth: { token: accessToken }`) is incompatible with the locked httpOnly cookie decision (D-08 from Phase 1). Override: socket.io-client connects with `withCredentials: true` (same pattern as axios singleton). Browser sends the `access_token` cookie automatically on WebSocket upgrade.
- **D-05:** Server reads `access_token` cookie from the ASGI scope headers in the `connect` event handler — same decoding logic as `_get_current_user()` in REST routes. Unauthenticated connections are disconnected immediately.
- **D-06:** Server auto-joins the authenticated user to their private `user:{user_id}` room on connect. Client emits `join_bet` / `leave_bet` to join/leave bet rooms.

### Emit Hook Placement
- **D-07:** Emit calls go inside service functions, not route handlers:
  - `bet_service.place_bet()` → emit `bet:odds_updated` + `bet:position_added` to `bet:{id}` room
  - `bet_service.withdraw_bet()` → emit `bet:odds_updated` + `bet:position_withdrawn`
  - `comment_service.create_comment()` → emit `bet:comment_added` to `bet:{id}` room
  - `notification_service.create_notification()` → emit `notification:*` to `user:{id}` room
  - Celery resolution tasks → emit `bet:resolved` / `bet:status_changed` when resolution completes
- **D-08:** Emit calls are fire-and-forget in services (wrapped in `try/except`, same pattern as existing notification dispatch). Emit failure never blocks the REST response.

### Frontend Socket Lifecycle
- **D-09:** Single shared socket instance per authenticated session. Created and managed in a new Zustand store (`frontend/src/store/socket.ts`) or a `SocketContext` React context wrapping the protected layout. Socket connects on auth bootstrap, disconnects on logout.
- **D-10:** Replace `setInterval` polling in `NotificationBell.tsx` (10s interval) with socket event listener for `notification:*` events. Keep the initial fetch on mount (REST) for already-stored notifications; socket handles new arrivals.
- **D-11:** Replace `setInterval` polling in `chat/[userId]/page.tsx` (3s interval) with socket listener for incoming messages in `user:{id}` room (server emits to recipient's user room when a message is stored). Sender sees optimistic update; recipient gets push.
- **D-12:** Bet detail page joins `bet:{id}` room on mount, leaves on unmount. Incoming `bet:odds_updated` and `bet:comment_added` events trigger local state updates (refetch or append) without full page reload.

### Event Scope (Phase 4)
- **D-13:** Phase 4 implements RT-01 (bet odds live), RT-02 (comments live), RT-03 (notifications live). The full REALTIME.md event catalog is the target; dispute/resolution events (`dispute:*`, `bet:resolved`) are wired in Phase 5 when resolution is built.
- **D-14:** Odds throttle: Redis key `throttle:odds:{bet_id}` with 500ms TTL as per REALTIME.md. Skip emit if key exists; set key and emit if not.
- **D-15:** Nginx `/socket.io/` location block already exists with WebSocket upgrade headers — no Nginx config changes needed.

### Claude's Discretion
- Exact ASGI entrypoint variable name (`socket_app` vs `application`)
- Whether socket singleton lives in Zustand store or React context (both valid)
- Redis pub-sub channel naming convention for python-socketio adapter
- Exact `seq` counter implementation for stale-state detection (REALTIME.md mentions this but it's optional for v1)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Real-time Spec
- `plan/REALTIME.md` — Full Socket.IO event catalog, room hierarchy, auth spec, throttling, reconnection strategy, scaling notes

### Existing Integration Points
- `backend/app/main.py` — Current ASGI app; needs to become `socketio.ASGIApp` wrapper
- `backend/app/services/notification_service.py` — Fire-and-forget emit pattern (model for all socket emits)
- `backend/app/services/bet_service.py` — place_bet and withdraw_bet — emit hooks go here
- `backend/app/services/comment_service.py` — create_comment — emit hook goes here
- `frontend/src/lib/api.ts` — Axios singleton pattern; socket singleton follows same shape
- `frontend/src/components/NotificationBell.tsx` — Current polling to replace
- `frontend/src/app/(protected)/chat/[userId]/page.tsx` — Current chat polling to replace
- `nginx/nginx.conf` — Already has /socket.io/ WebSocket proxy block (no changes needed)

### Stack
- `backend/pyproject.toml` — Add `python-socketio[asyncio_client]` dependency
- `frontend/package.json` — `socket.io-client ^4.0.0` already present

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/deps.py` — JWT decode logic reusable for socket auth (same cookie-reading pattern)
- `backend/app/services/notification_service.py` — Fire-and-forget pattern (try/except wrapping) is the model for all emit calls
- `frontend/src/store/` — All 5 Zustand stores follow the same shape; socket store follows the same pattern
- `frontend/src/lib/api.ts` — Axios singleton with `withCredentials: true`; socket client mirrors this

### Established Patterns
- Services raise HTTPException; emit failures are silently swallowed (same as notification fire-and-forget)
- All protected frontend pages use `useEffect` for data fetching — socket listeners use the same cleanup pattern (`return () => socket.off(event)`)
- Backend routes are thin (3-line delegation to service); emit hooks go in services, not routes

### Integration Points
- `backend/app/main.py`: Add `socketio.ASGIApp(sio, app)` wrapper; expose as `socket_app`
- `backend/app/workers/tasks/`: Celery resolution tasks (Phase 5) must import `sio` to emit `bet:resolved`
- `frontend/src/app/layout.tsx` or `(protected)/layout.tsx`: Mount SocketProvider/connect on auth
- `frontend/src/store/auth.ts`: `logout()` must call `socket.disconnect()` before clearing state

</code_context>

<specifics>
## Specific Ideas

- Auth approach confirmed: cookie forwarding via `withCredentials: true` (not JWT in auth field as REALTIME.md spec says — that was incompatible with httpOnly cookies)
- Nginx WebSocket config already done — no Nginx changes needed in this phase

</specifics>

<deferred>
## Deferred Ideas

- `dispute:*` and `bet:resolved` socket events — wired in Phase 5 when resolution system is built
- `global:trending_bet` room — not required for 42 module; defer to Phase 6 polish or backlog
- Per-user emit rate limiting (60 events/min) — implement only if needed; not a 42 requirement
- `seq` stale-state detection counter — optional for v1; reconnect REST-refetch covers the use case

</deferred>

---

*Phase: 04-real-time*
*Context gathered: 2026-03-29*
