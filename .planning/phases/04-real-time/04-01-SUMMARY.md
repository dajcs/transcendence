---
phase: 04-real-time
plan: 01
subsystem: backend/socket
tags: [socket.io, real-time, websocket, redis, auth]
dependency_graph:
  requires: []
  provides: [sio-singleton, socket_app-asgi, connect-auth-handler, test-stubs-rt]
  affects: [backend/app/main.py, backend/Dockerfile]
tech_stack:
  added: [python-socketio==5.16.1, python-engineio, aiohttp]
  patterns: [AsyncServer-singleton, ASGI-wrapper, cookie-auth-on-connect]
key_files:
  created:
    - backend/app/socket/__init__.py
    - backend/app/socket/server.py
    - backend/app/socket/events.py
    - backend/tests/test_socket.py
  modified:
    - backend/app/main.py
    - backend/Dockerfile
    - backend/pyproject.toml
    - backend/uv.lock
decisions:
  - "importlib.import_module used to register socket events to avoid shadowing the FastAPI `app` variable in main.py"
  - "cors_allowed_origins=[] on AsyncServer — Nginx handles CORS; wildcard would conflict with withCredentials"
  - "Dockerfile CMD updated to app.main:socket_app; tests still use FastAPI app directly via conftest"
metrics:
  duration: 8min
  completed: "2026-03-28"
  tasks: 2
  files: 8
---

# Phase 4 Plan 1: Socket.IO Foundation Summary

python-socketio installed with Redis adapter; AsyncServer singleton, event handlers, ASGI wrapper, and test stubs — foundation for all real-time plans.

## Tasks Completed

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Install python-socketio and create socket module | 52d6884 | pyproject.toml, uv.lock, app/socket/__init__.py, app/socket/server.py, app/socket/events.py |
| 2 | Wire ASGI wrapper into main.py, update Dockerfile, write test stubs | 8c947c5 | app/main.py, Dockerfile, tests/test_socket.py |

## Decisions Made

1. **importlib.import_module for event registration**: `import app.socket.events` at module level in `main.py` would rebind the local name `app` to the package object, overwriting the FastAPI instance. Used `importlib.import_module("app.socket.events")` instead — same side-effect (decorators registered) without polluting the namespace.

2. **cors_allowed_origins=[]**: Nginx terminates TLS and handles CORS for the whole app. Setting wildcard on the Socket.IO server would conflict with the `withCredentials` flag required for httpOnly cookie auth.

3. **socket_app as ASGI wrapper**: Uvicorn serves `socket_app` (Socket.IO ASGI wrapper) in production; conftest.py uses the inner FastAPI `app` directly via ASGITransport — no test infrastructure changes needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] importlib used instead of direct import to prevent FastAPI app name collision**
- **Found during:** Task 2 verification
- **Issue:** `import app.socket.events` in `main.py` rebinds the module-level name `app` to the `app` package, overwriting the FastAPI instance. `from app.main import app` in conftest.py then imports the package object instead of the FastAPI app, causing `AttributeError: module 'app' has no attribute 'dependency_overrides'` in all existing tests.
- **Fix:** Replaced `import app.socket.events` with `_importlib.import_module("app.socket.events")` — achieves the same decorator registration effect without name collision.
- **Files modified:** backend/app/main.py
- **Commit:** 8c947c5

### Pre-existing Failures (Out of Scope)

Two test failures existed before this plan and remain unchanged:
- `tests/test_comments.py::test_duplicate_upvote_returns_409` — duplicate upvote allows 201 instead of 409
- `tests/test_tasks.py::test_daily_allocation_inserts_transactions` — allocation logic assertion mismatch

These are documented in deferred-items.md for future fix.

## Verification Results

```
# Smoke test imports
from app.main import app, socket_app; from app.socket.server import sio; print('OK')
→ OK

# Connect auth tests
tests/test_socket.py: 3 passed, 4 skipped

# Full suite (excluding pre-existing failures)
48 passed (all previously-passing tests still green)
```

## Known Stubs

| File | Stub | Reason |
|---|---|---|
| backend/tests/test_socket.py | test_bet_emits_odds, test_odds_throttle | Wired in plan 04-02 when bet service emits |
| backend/tests/test_socket.py | test_comment_emits | Wired in plan 04-02 when comment service emits |
| backend/tests/test_socket.py | test_notification_emits | Wired in plan 04-02 when notification service emits |

These stubs are intentional — they verify the test scaffold exists and are filled in plan 04-02.

## Self-Check: PASSED
