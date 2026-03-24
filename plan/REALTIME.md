# Real-time Architecture (Socket.IO)

## Stack

- **Server:** python-socketio (async, ASGI) integrated with FastAPI
- **Client:** socket.io-client (TypeScript)
- **Transport:** WebSocket with HTTP long-polling fallback
- **Pub-Sub Backend:** Redis (for horizontal scaling)

---

## Room Hierarchy

```
namespace: /
  rooms:
    bet:{bet_id}        -- all users viewing a specific bet
    user:{user_id}      -- private channel per user (notifications)
    global              -- sitewide announcements (new trending bets, etc.)
```

### Join/Leave Rules
- Client joins `bet:{bet_id}` when opening a bet detail page; leaves on page close
- Server auto-joins `user:{user_id}` on authenticated connection
- `global` room: all authenticated clients join automatically

---

## Event Catalog

### Server → Client Events

| Event | Room | Payload |
|---|---|---|
| `bet:odds_updated` | `bet:{id}` | `{ bet_id, yes_pct, no_pct, total_votes }` |
| `bet:position_added` | `bet:{id}` | `{ user_id, side, placed_at }` |
| `bet:position_withdrawn` | `bet:{id}` | `{ user_id }` |
| `bet:comment_added` | `bet:{id}` | `{ comment_id, user_id, content, created_at }` |
| `bet:status_changed` | `bet:{id}` | `{ bet_id, new_status }` |
| `bet:resolved` | `bet:{id}` | `{ bet_id, outcome, tier }` |
| `dispute:opened` | `bet:{id}` | `{ dispute_id, opened_by, closes_at }` |
| `dispute:vote_added` | `bet:{id}` | `{ dispute_id, vote_count }` |
| `dispute:resolved` | `bet:{id}` | `{ dispute_id, outcome }` |
| `notification:bp_credited` | `user:{id}` | `{ amount, reason, new_balance }` |
| `notification:bet_resolved` | `user:{id}` | `{ bet_id, outcome, payout }` |
| `notification:dispute_result` | `user:{id}` | `{ dispute_id, result }` |
| `global:trending_bet` | `global` | `{ bet_id, title }` |

### Client → Server Events

| Event | Auth Required | Payload |
|---|---|---|
| `join_bet` | Yes | `{ bet_id }` |
| `leave_bet` | Yes | `{ bet_id }` |

All other client actions go through the REST API (not Socket.IO). Socket.IO is **read-only push** from client perspective.

---

## Authentication

- Client sends JWT in `auth` field during handshake:
  ```js
  socket = io({ auth: { token: accessToken } })
  ```
- Server validates JWT on `connect` event; disconnects if invalid
- Unauthenticated connections rejected immediately

---

## Backpressure & Rate Limiting

### Server-side Throttling
- `bet:odds_updated` is debounced: maximum 1 emit per bet per 500ms
  - Multiple votes arriving within 500ms are coalesced into one event
  - Implemented via Redis key with TTL: `throttle:odds:{bet_id}` = 500ms
- `bet:comment_added` not throttled (low volume, user-initiated)

### Per-User Emit Rate Limit
- Maximum 60 events/minute per connection
- Connections exceeding limit are warned then disconnected after second violation

### Message Queue
- No message history retention in Socket.IO
- Clients that reconnect re-fetch state via REST API, then subscribe to live updates
- No "missed events" delivery — clients pull on reconnect

---

## Reconnection Strategy

### Client Behavior
```js
socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})
```

### On Reconnect
1. Client REST-fetches current bet state (odds, comments, status)
2. Client re-emits `join_bet` for any open bet pages
3. Server sends no replay — client treats reconnect as fresh load

### Stale State Detection
- Each event payload includes a `seq` counter per bet room (incremented on each change)
- Client compares received `seq` to expected; if gap detected → full REST refresh

---

## Scaling Considerations

### Single-Server (v1)
- python-socketio in-process with FastAPI
- Redis pub-sub used even on single server (prep for multi-server)
- Connection limit: ~1000 concurrent WebSocket connections per server

### Multi-Server (if needed)
- python-socketio supports Redis adapter out of the box
- All servers connect to same Redis; events published to Redis are broadcast to all servers
- Load balancer must use **sticky sessions** (or Redis-backed session store)

---

## Error Handling

- Socket errors surfaced to client as `error` event: `{ code, message }`
- Server never crashes on client disconnect mid-event — all handlers wrapped in try/except
- Failed Redis pub-sub: fall back to direct emit (single-server mode)

---

*Last updated: 2026-03-24*
