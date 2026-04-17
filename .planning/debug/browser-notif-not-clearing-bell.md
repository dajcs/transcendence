---
status: root_cause_found
trigger: "when there is both a browser and a bell notification, and the user clicks on browser notification - this should clear the corresponding bell notification"
created: 2026-04-17
updated: 2026-04-17
---

## Symptoms

- **Expected**: Clicking a browser (OS/push) notification marks the corresponding in-app bell notification as read/cleared
- **Actual**: Bell notification remains unread after clicking the browser notification
- **Error**: None reported — purely a missing sync between browser notification click handler and in-app notification state
- **Context**: Both a browser notification and a bell (in-app) notification exist for the same event; clicking browser notification should dismiss/read the bell counterpart

## Current Focus

hypothesis: "two distinct defects in NotificationBell.tsx onclick handlers cause the bell to stay unread"
test: "traced showBrowserNotification onclick and requestNotifPermission onclick code paths"
expecting: "fix: await markAsRead([id]) before navigating; pass notification id through showBrowserNotification"
next_action: "apply fix to NotificationBell.tsx"
reasoning_checkpoint: "socket emits id field confirmed in notification_service.py line 32; handler types only expose payload, not id"
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-17T00:00:00Z
  file: frontend/src/components/NotificationBell.tsx
  lines: 101-110
  note: "showBrowserNotification builds Notification with onclick that calls markAllAsReadRef.current() (unawaited Promise) then immediately window.location.href — navigation cancels the in-flight POST before it reaches /api/notifications/mark-all-read"

- timestamp: 2026-04-17T00:00:00Z
  file: frontend/src/components/NotificationBell.tsx
  line: 87
  note: "requestNotifPermission path: notif.onclick only calls window.location.href and notif.close() — no markAsRead call at all"

- timestamp: 2026-04-17T00:00:00Z
  file: backend/app/services/notification_service.py
  lines: 30-39
  note: "socket emit payload includes 'id': str(notif.id) — notification id IS available on the wire"

- timestamp: 2026-04-17T00:00:00Z
  file: frontend/src/components/NotificationBell.tsx
  lines: 116-135
  note: "handler type signatures { payload?: string } do not expose 'id' field — id is on the wire but not extracted in TypeScript handlers"

## Eliminated Hypotheses

- Service worker involvement: no service worker (sw.js or similar) found in /frontend/public/ — browser notifications use Web Notification API directly from component code

## Resolution

root_cause: "Two defects in NotificationBell.tsx: (1) showBrowserNotification onclick calls markAllAsReadRef.current() as an unawaited Promise then navigates immediately, so the request is cancelled before completion; (2) requestNotifPermission onclick has no markAsRead call at all. Additionally, markAllAsRead is semantically wrong — should mark only the specific notification. The notification id is available in the socket payload but not extracted in handler type signatures."
fix: "Update showBrowserNotification to accept notificationId param; update handler types to include id: string; in onclick await markAsRead([notificationId]) before navigating. Fix requestNotifPermission path to also await markAsRead([n.id]) before navigating."
verification: ""
files_changed:
  - frontend/src/components/NotificationBell.tsx
