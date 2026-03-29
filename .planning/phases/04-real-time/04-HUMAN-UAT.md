---
status: partial
phase: 04-real-time
source: [04-VERIFICATION.md]
started: 2026-03-29T00:00:00Z
updated: 2026-03-29T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. RT-03 — Notification bell updates without polling
expected: Open two browser tabs logged in as different users. In tab 2, trigger a friend request or bet resolution. In tab 1, the notification bell badge updates within 2s without a page reload. Network tab shows no XHR polling to /api/notifications — only the WebSocket frame carries the update.
result: [pending]

### 2. RT-02 — Comments appear live in a second tab
expected: Open a market detail page in two tabs. Post a comment in tab 2. The comment appears in tab 1 within 2s without refreshing.
result: [pending]

### 3. RT-01 — Odds update live in a second tab
expected: Open the same market in two tabs. Place a bet in tab 2. The odds percentages in tab 1 update within 1 second without refreshing. React Query devtools shows cache patched via setQueryData (not a full refetch).
result: [pending]

### 4. Chat — No polling; messages via WebSocket
expected: Open a chat conversation in two tabs. Send a message in tab 2. It appears in tab 1 within 1s. Network tab confirms no repeated XHR to /api/chat every 3s — delivery is via WebSocket frame only.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
