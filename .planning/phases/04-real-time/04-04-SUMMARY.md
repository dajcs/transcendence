---
phase: 04-real-time
plan: "04"
subsystem: ui
tags: [socket.io, react, zustand, react-query, real-time, notifications, chat, markets]

requires:
  - phase: 04-real-time/04-03
    provides: useSocketStore with socket singleton connected on auth

provides:
  - NotificationBell socket listeners replacing 10s poll (notification:friend_request/accepted/new_message/bet_resolved/bet_disputed)
  - Chat page socket listener replacing 3s poll (chat:message)
  - Market detail page bet room join/leave (join_bet/leave_bet) with live odds and comments

affects: [04-real-time, RT-01, RT-02, RT-03]

tech-stack:
  added: []
  patterns:
    - "useSocketStore((s) => s.socket) selector in components needing live events"
    - "socket.on/off with named handler in useEffect for proper cleanup"
    - "queryClient.setQueryData for direct cache patching (odds); queryClient.invalidateQueries for full refetch (comments)"
    - "socket.emit('join_bet'/'leave_bet') in useEffect mount/unmount for room membership"

key-files:
  created: []
  modified:
    - frontend/src/components/NotificationBell.tsx
    - frontend/src/app/(protected)/chat/[userId]/page.tsx
    - frontend/src/app/(protected)/markets/[id]/page.tsx

key-decisions:
  - "Keep initial REST fetch on mount for notifications already stored; socket events only trigger re-fetch, not full payload delivery"
  - "fetchMessages/markRead re-called on chat:message event (refetch pattern) rather than appending socket payload directly — avoids duplicates and keeps pagination/read-status consistent"
  - "bet:odds_updated patches setQueryData directly (zero-latency visual update); bet:comment_added uses invalidateQueries (full refetch guarantees authoritative comment list)"

patterns-established:
  - "Socket event cleanup: always use named handler variable (not inline arrow) so socket.off(event, handler) correctly removes only the registered listener"
  - "Room join/leave: single useEffect with [socket, marketId, queryClient] deps handles both setup and teardown atomically"

requirements-completed: [RT-01, RT-02, RT-03]

duration: 2min
completed: 2026-03-28
---

# Phase 4 Plan 04: Socket Frontend Wiring Summary

**Three polling-based components (NotificationBell 10s, chat 3s) replaced with socket push listeners; market detail page joined to bet room with live odds and comment updates via React Query cache patching.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-28T23:38:18Z
- **Completed:** 2026-03-28T23:40:03Z
- **Tasks:** 2 auto (+ 1 checkpoint reached)
- **Files modified:** 3

## Accomplishments

- NotificationBell: removed 10s setInterval; added socket.on for 5 notification event types with proper cleanup
- Chat page: removed 3s setInterval; added chat:message socket listener that refetches conversation on new message
- Market detail: added useSocketStore, join_bet emit on mount, leave_bet on unmount, bet:odds_updated patches React Query cache (RT-01), bet:comment_added invalidates comments query (RT-02)

## Task Commits

1. **Task 1: Replace NotificationBell polling with socket listeners** - `c2508a4` (feat)
2. **Task 2: Replace chat polling + add market detail room join/live updates** - `331f00c` (feat)

## Files Created/Modified

- `frontend/src/components/NotificationBell.tsx` - 10s poll removed; socket listeners for 5 notification event types added
- `frontend/src/app/(protected)/chat/[userId]/page.tsx` - 3s setInterval removed; chat:message socket listener added
- `frontend/src/app/(protected)/markets/[id]/page.tsx` - useSocketStore added; join_bet/leave_bet; bet:odds_updated + bet:comment_added handlers

## Decisions Made

- Initial REST fetch retained on mount for notifications already in DB; socket events only trigger re-fetches
- Chat uses refetch pattern on socket event (not append) to preserve read-status consistency
- Odds use setQueryData for zero-latency visual update; comments use invalidateQueries for authoritative list

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Socket end-to-end wiring complete: backend emits events (04-01/02), frontend consumes them (04-04)
- Human verification checkpoint pending: RT-01 (live odds), RT-02 (live comments), RT-03 (live notifications) need browser confirmation
- No polling remains in NotificationBell or chat page

---
*Phase: 04-real-time*
*Completed: 2026-03-28*
