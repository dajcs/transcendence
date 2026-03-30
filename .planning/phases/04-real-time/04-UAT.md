---
status: testing
phase: 04-real-time
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
---

## Current Test

number: 7
name: Live chat message delivery (RT-03/chat)
expected: |
  Open a chat conversation between User A and User B. User B sends a message.
  User A sees the new message appear in the chat window without refreshing —
  no 3s delay, pushed immediately via WebSocket.
awaiting: blocked - chat route 404

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Run `docker compose up --build` from scratch. All services (backend, frontend, nginx, redis, db) start without errors. The backend health check at https://localhost/api/health returns {"status":"ok"}. No crash logs in `docker compose logs`.
result: pass

### 2. WebSocket connects on login
expected: Open browser DevTools → Network → WS filter. Log in to the app. A WebSocket connection to `wss://localhost/socket.io/` appears in the list and shows status "101 Switching Protocols". The connection stays open while you're logged in.
result: pass

### 3. WebSocket disconnects on logout
expected: While logged in with DevTools WS tab open, click Logout. The WebSocket connection closes (status changes to "Finished" or disappears). No new connection is established until you log back in.
result: pass
note: Fixed — socket.io._close() added. 101 status in DevTools is normal (upgrade handshake code); duration replacing Pending confirms close.

### 4. Live odds update (RT-01)
expected: Open a market detail page in two browser tabs (both logged in). In Tab B, place a bet on the market. Without refreshing Tab A, the odds/percentage display updates automatically within ~1 second to reflect the new bet.
result: pass

### 5. Live comment added (RT-02)
expected: Open the same market detail page in two browser tabs. In Tab B, post a comment. Without refreshing Tab A, the new comment appears in the comments section automatically within ~1 second.
result: pass

### 6. Live notification delivery (RT-03)
expected: Log in as User A in one tab, User B in another (or incognito). User B sends User A a friend request (or triggers any notification). User A's notification bell updates without a page refresh — the bell badge increments or a new notification appears within ~1 second.
result: pass

### 7. Live chat message delivery (RT-03/chat)
expected: Open a chat conversation between User A and User B. User B sends a message. User A sees the new message appear in the chat window without refreshing — no 3s delay, pushed immediately via WebSocket.
result: blocked
blocked_by: other
reason: "/chat/[userId] returns 404 in Docker production. Route IS compiled (manifest correct, files present, identical structure to working /markets/[id]). Root cause unidentified — needs /gsd:debug session."

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "WebSocket connection closes when user logs out"
  status: fixed
  reason: "User reported: The WebSocket connection is not closed: Status Code: 101 Switching Protocols, State (Time column): Pending"
  severity: major
  test: 3
  root_cause: "socket.disconnect() calls manager._destroy() which skips _close() if any namespace socket still reports active=true (subs not yet undefined). Added explicit socket.io._close() to force-close the Manager/transport directly, bypassing namespace state checks."
  artifacts:
    - path: "frontend/src/store/socket.ts"
      issue: "disconnect() only called socket.disconnect() — manager._close() not guaranteed"
  missing:
    - "Added socket.io._close() after socket.disconnect() in store disconnect()"
  debug_session: ""
