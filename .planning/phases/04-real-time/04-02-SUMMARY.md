---
phase: 04-real-time
plan: "02"
subsystem: backend
tags: [socket.io, python, services, real-time, redis, throttle]

requires:
  - phase: 04-real-time/04-01
    provides: sio AsyncServer singleton in backend/app/socket/server.py

provides:
  - bet_service: _emit_odds_update with 500ms Redis throttle; place_bet emits bet:position_added; withdraw_bet emits bet:position_withdrawn
  - comment_service: create_comment emits bet:comment_added after db.commit()
  - notification_service: create_notification emits notification:{type} to user room after db.commit()
  - chat_service: send_message emits chat:message to recipient room after db.commit()
  - All 7 test_socket.py tests passing (3 connect auth + 4 emit unit tests)

affects: [04-real-time, RT-01, RT-02, RT-03]

tech-stack:
  added:
    - fakeredis (test dependency for Redis throttle patching)
  patterns:
    - "Fire-and-forget emit: try/except Exception: pass — REST response never blocked"
    - "Redis NX key throttle: r.set(key, '1', nx=True, px=500) — deduplicates burst emits"
    - "Local import inside try block: from app.socket.server import sio — avoids circular import at module load"

key-files:
  created: []
  modified:
    - backend/app/services/bet_service.py
    - backend/app/services/comment_service.py
    - backend/app/services/notification_service.py
    - backend/app/services/chat_service.py
    - backend/tests/test_socket.py

key-decisions:
  - "Local import `from app.socket.server import sio` inside each try block — prevents circular import at module-level while still resolving correctly at runtime"
  - "Redis client instantiated per-call (not shared module-level) to avoid async context issues in tests"
  - "test_bet_emits_odds: used BpTransaction + KpEvent seed records to satisfy place_bet balance/cap checks"
  - "Bet model requires deadline (NOT NULL) — tests add timedelta(days=1) future deadline"

patterns-established:
  - "Emit hook placement: always AFTER db.commit() and db.refresh() to guarantee data is persisted before broadcast"
  - "Throttle pattern: nx=True Redis SET with px TTL prevents duplicate odds broadcasts within burst windows"

requirements-completed: [RT-01, RT-02, RT-03]

duration: ~5min (code committed in prior session; tests fixed and committed in resume)
completed: 2026-03-29
---

# Phase 4 Plan 02: Backend Service Emit Hooks Summary

**Fire-and-forget socket emit hooks wired into all four backend services; all 7 RT unit tests pass.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- `bet_service.py`: `_emit_odds_update` helper with 500ms Redis NX throttle; `place_bet` emits `bet:odds_updated` + `bet:position_added`; `withdraw_bet` emits `bet:odds_updated` + `bet:position_withdrawn`
- `comment_service.py`: `create_comment` emits `bet:comment_added` with comment metadata to `bet:{id}` room
- `notification_service.py`: `create_notification` emits `notification:{notif.type}` with full payload to `user:{id}` room
- `chat_service.py`: `send_message` emits `chat:message` with sender info to `user:{to_user_id}` room
- `test_socket.py`: All 7 tests passing — 3 connect auth + test_bet_emits_odds, test_odds_throttle, test_comment_emits, test_notification_emits

## Task Commits

1. **Task 1: Add emit hooks to four services** — `a9e9294` (feat)
2. **Task 2: Activate test_socket.py** — `a90f9e0` (feat)

## Files Created/Modified

- `backend/app/services/bet_service.py` — `_emit_odds_update` with Redis throttle; emit calls in place_bet/withdraw_bet
- `backend/app/services/comment_service.py` — `bet:comment_added` emit in create_comment
- `backend/app/services/notification_service.py` — `notification:{type}` emit in create_notification
- `backend/app/services/chat_service.py` — `chat:message` emit in send_message
- `backend/tests/test_socket.py` — All stubs replaced with real assertions using fakeredis + AsyncMock

## Decisions Made

- Local sio import inside try blocks to avoid circular import at module load time
- Redis client instantiated per-call (not module-level) for test isolation
- Bet deadline NOT NULL — test fixtures use future deadline

## Deviations from Plan

- Test fixes required for correct User/Bet model construction (no bp_balance column; Bet requires deadline) — plan template assumed simplified models

## Issues Encountered

- None blocking. Minor model schema mismatch in test templates corrected during task 2.

## Next Phase Readiness

- Backend emits complete (04-01 server + 04-02 hooks)
- Frontend socket store complete (04-03)
- Frontend component wiring complete (04-04)
- Phase 4 ready for human verification: RT-01 (live odds), RT-02 (live comments), RT-03 (notifications/chat)

---
*Phase: 04-real-time*
*Completed: 2026-03-29*
