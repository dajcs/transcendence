---
phase: 04-real-time
plan: 03
subsystem: frontend/realtime
tags: [socket.io, zustand, auth, lifecycle]
dependency_graph:
  requires: []
  provides: [socket-store, socket-lifecycle]
  affects: [frontend/src/store/socket.ts, frontend/src/components/AuthBootstrap.tsx, frontend/src/store/auth.ts]
tech_stack:
  added: []
  patterns: [zustand-singleton-store, outside-react-getState]
key_files:
  created:
    - frontend/src/store/socket.ts
  modified:
    - frontend/src/components/AuthBootstrap.tsx
    - frontend/src/store/auth.ts
decisions:
  - "useSocketStore.getState() used in logout() (non-React context) per Zustand outside-React pattern"
  - "Socket connects with withCredentials: true (no auth token field) — D-04 constraint"
  - "connect() is idempotent via socket?.connected guard"
metrics:
  duration: 3min
  completed: "2026-03-28"
  tasks: 2
  files: 3
---

# Phase 04 Plan 03: Frontend Socket Store Summary

Socket.io-client singleton Zustand store wired to auth lifecycle — connect on bootstrap, disconnect on logout.

## What Was Built

Created `useSocketStore` Zustand store managing a socket.io-client Socket singleton. The socket connects with `withCredentials: true` (httpOnly cookie auth, D-04 constraint). Connected the store's lifecycle to auth state: `AuthBootstrap` calls `connect()` after successful auth; `useAuthStore.logout()` calls `disconnect()` before clearing auth state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create socket Zustand store | d3f270f | frontend/src/store/socket.ts |
| 2 | Wire connect/disconnect into AuthBootstrap and auth logout | bd23148 | frontend/src/components/AuthBootstrap.tsx, frontend/src/store/auth.ts |

## Decisions Made

- **useSocketStore.getState() in logout():** logout() runs outside React render (async action), so the Zustand hook cannot be used. Standard pattern is `Store.getState().action()`.
- **withCredentials: true, no auth field:** D-04 decision — server reads httpOnly `access_token` cookie from ASGI scope headers. No auth token passed in socket options.
- **Idempotent connect():** Guard `if (get().socket?.connected) return` prevents duplicate connections if component re-renders.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - store is fully wired. Consumer components (NotificationBell, bet detail page) will use `useSocketStore` in plan 04-04.

## Self-Check: PASSED

- frontend/src/store/socket.ts: FOUND
- frontend/src/components/AuthBootstrap.tsx: modified with useSocketStore import and connectSocket() call
- frontend/src/store/auth.ts: modified with useSocketStore import and disconnect() call
- Commits d3f270f, bd23148: FOUND
- npx tsc --noEmit: exits 0
