---
status: complete
phase: 04-real-time
source: [04-UAT.md, 04-HUMAN-UAT.md, 04-VERIFICATION.md]
started: 2026-04-25T11:17:32+02:00
updated: 2026-04-25T18:44:53+02:00
redo_of: 04-UAT.md
automated:
  command: docker compose exec backend uv run pytest tests/test_socket.py -v
  result: pass
  evidence: 7 passed, 1 warning in 12.18s
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start / Running Stack Smoke Test
expected: With the current Docker stack running, open https://localhost:8443 in Chrome. The app loads over HTTPS with no blank page, backend API calls succeed, and there are no crash loops in the running services. If you restart the stack before testing, `docker compose up` should bring backend, frontend, nginx, redis, db, celery worker, and celery beat back without errors.
result: pass

### 2. WebSocket connects on login
expected: Open Chrome DevTools, use the Network tab with the WS filter, then log in. A WebSocket connection to `/socket.io/` appears with HTTP 101 Switching Protocols and stays open while logged in.
result: pass

### 3. WebSocket disconnects on logout
expected: While logged in with the WS connection visible, click Logout. The WebSocket stops being pending, closes, or disappears, and no new socket connection is established until login happens again.
result: pass
reported: "Going to the login page keeps the dev _next/webpack-hmr 101 websocket open. Logging in creates socket.io 101. Logging out leaves both connections open. Logging in again creates a new socket.io 101."
severity: major
note: "Follow-up observation: when logged in, /socket.io/ Time is Pending; after logout, Time changes to the elapsed logged-in duration. That indicates the app websocket has closed. /_next/webpack-hmr remains Pending because it is the Next dev-server HMR websocket."

### 4. Live odds update (RT-01)
expected: Open the same market detail page in two logged-in browser tabs. Place a bet in Tab B. Without refreshing Tab A, the displayed odds/probability changes within about 1 second.
result: pass

### 5. Live comment added (RT-02)
expected: Open the same market detail page in two logged-in browser tabs. Post a comment in Tab B. Without refreshing Tab A, the new comment appears in the comments section within about 1 second.
result: pass

### 6. Live notification delivery (RT-03)
expected: Log in as User A in one tab and User B in another or incognito. User B triggers a notification for User A, such as a friend request. User A's notification bell updates without a page refresh within about 1 second.
result: pass

### 7. Live chat message delivery (RT-03/chat)
expected: Open a chat conversation between User A and User B. User B sends a message. User A sees the new message appear in the chat window without refreshing, delivered immediately via WebSocket rather than delayed polling.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "WebSocket connection closes when user logs out"
  status: fixed
  reason: "User reported: Going to the login page keeps the dev _next/webpack-hmr 101 websocket open. Logging in creates socket.io 101. Logging out leaves both connections open. Logging in again creates a new socket.io 101."
  severity: major
  test: 3
  root_cause: "AuthBootstrap owned socket connection setup when isAuthenticated became true, but did not own teardown when isAuthenticated became false. Logout had a separate disconnect call, leaving auth-loss and redirect/bootstrap paths able to keep the app Socket.IO transport alive. The Next.js _next/webpack-hmr websocket is expected in dev mode and is not the app realtime socket."
  artifacts:
    - path: "frontend/src/components/AuthBootstrap.tsx"
      issue: "Connected Socket.IO on authenticated state but did not disconnect when auth state became false"
    - path: "frontend/src/components/__tests__/AuthBootstrap.test.tsx"
      issue: "Missing regression coverage for auth-loss socket teardown"
  missing:
    - "Added AuthBootstrap teardown path that calls socket disconnect whenever isAuthenticated is false"
    - "Added Jest regression test proving auth loss disconnects the socket"
    - "Stopped AuthBootstrap from probing /api/auth/me on logged-out auth pages, removing the visible 401 on /login"
    - "Added explicit Sidebar logo width and height classes to avoid Next Image aspect-ratio warning"
  fix_status: passed_user_confirmation
  verification:
    - "npm test -- AuthBootstrap.test.tsx --runInBand: first run failed before fix because disconnect was not called"
    - "timeout 60 npm test -- AuthBootstrap.test.tsx --runInBand: pass"
    - "timeout 90 npm test -- AuthBootstrap.test.tsx TopNav.test.tsx --runInBand: pass"
    - "npm run type-check: pass"
    - "timeout 140 npm test -- AuthBootstrap.test.tsx --runInBand: first run failed before 401 fix because bootstrap still ran on /login"
    - "timeout 140 npm test -- AuthBootstrap.test.tsx --runInBand: pass after 401 fix"
    - "timeout 140 npm test -- TopNav.test.tsx --runInBand: pass"
