# Friend System

## Overview

Users can send, accept, decline, and cancel friend requests. Friends can be
removed or blocked at any time. The blocker can unblock. The system is built
on a single `friend_requests` table that tracks the full relationship lifecycle.

---

## Data Model

One row per user-pair. A **symmetric unique index** (`uq_friend_pair_symmetric`)
on `(LEAST(from,to), GREATEST(from,to))` prevents mirrored duplicate rows
regardless of request direction.

```
status transitions:
  (none) → pending   [send_request]
  pending → accepted  [accept_request]
  pending → declined  [reject_request]
  pending → (deleted) [cancel_request — sender only]
  accepted → (deleted)[remove_friend]
  any → blocked       [block_user — always from_user_id = blocker]
  blocked → (deleted) [unblock_user — blocker only]
```

`status = 'blocked'` always stores `from_user_id = blocker, to_user_id = blocked`.
This makes authorization checks simple and unambiguous.

---

## API Endpoints

All routes under `/api/friends/` require authentication (cookie-based JWT).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/friends` | List friends, pending received/sent, blocked users |
| `POST` | `/api/friends/request/{user_id}` | Send friend request (always 200 — errors in body) |
| `DELETE` | `/api/friends/request/{request_id}` | Cancel a pending sent request |
| `POST` | `/api/friends/accept/{request_id}` | Accept a received request |
| `POST` | `/api/friends/reject/{request_id}` | Decline a received request |
| `DELETE` | `/api/friends/{user_id}` | Remove an accepted friend |
| `POST` | `/api/friends/block/{user_id}` | Block a user (removes friendship if any) |
| `POST` | `/api/friends/unblock/{user_id}` | Unblock (blocker only) |

### `POST /api/friends/request/{user_id}` — special response shape

This endpoint always returns HTTP 200 to comply with the 42 project requirement
of no browser console errors. Expected errors (blocked, duplicate, etc.) are
signalled in the response body:

```json
{ "success": false, "detail": "Cannot send request to this user" }
{ "success": true }
```

All other endpoints use standard HTTP status codes (204 No Content for deletes,
200 for responses with a body).

---

## Business Rules

- A user cannot send a request to themselves (400).
- If A sends a request to B while B already has a pending request to A, it
  auto-accepts (mutual intent).
- A declined request can be re-sent (updates the existing row back to pending).
- The blocker is always `from_user_id`; only the blocker can unblock.
- A blocked user cannot send a request to the blocker (silently returns
  `success: false` — no indication of block to avoid information leakage).
- `remove_friend` and `unblock_user` use optimistic UI updates on the frontend:
  the item disappears immediately, then a server refetch confirms the final state.
  A `try/finally` ensures the refetch always runs even if the API call fails.

---

## Frontend

### Store — `src/store/friends.ts`

Zustand v5 store (curried form `create<T>()()`). State shape:

```typescript
{
  friends: Friend[]
  pendingReceived: FriendRequest[]
  pendingSent: FriendRequest[]
  blocked: BlockedUser[]
  isLoading: boolean
}
```

Actions: `fetch`, `sendRequest`, `acceptRequest`, `cancelRequest`,
`rejectRequest`, `removeFriend`, `blockUser`, `unblockUser`.

`sendRequest` returns `string | null` (error message or null on success) instead
of throwing, so React dev mode does not log it as a console error.

### Bootstrap

`AuthBootstrap` calls `fetchFriends()` once `isAuthenticated` becomes true.
This populates the store on any page, enabling the nav badge to work globally.

### Navigation badge

`TopNav` reads `pendingReceived.length` from the store and renders a red badge
on the Friends link when there are pending incoming requests.

### Friends page — `src/app/(protected)/friends/page.tsx`

Tabs:
| Tab | Content |
|---|---|
| Friends | Accepted friends with online indicator, Remove and Block buttons |
| Requests | Incoming pending requests with Accept / Decline buttons. Accepting switches to the Friends tab immediately. |
| Sent | Outgoing pending requests with Cancel button (optimistic removal) |
| Blocked | Users blocked by the current user with Unblock button. Tab only visible when list is non-empty. |

User search (debounced, 300 ms) queries `GET /api/users/search?q=...`. Results
show an Add Friend button per user; errors (e.g. blocked) are shown inline
below the button without throwing.

---

## Real-time

Not yet implemented. The nav badge and request list are populated on page load
via `AuthBootstrap`. Socket.IO integration is planned for a later phase; at that
point the `fetch` action will be triggered by incoming socket events instead of
only on mount.

---

*Last updated: 2026-03-28*
