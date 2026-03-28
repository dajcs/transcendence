# Phase 4: Real-time - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-29
**Phase:** 04-real-time
**Mode:** assumptions
**Areas analyzed:** Backend Integration Architecture, Authentication, Emit Hook Placement, Frontend Socket Lifecycle

## Assumptions Presented

### Backend Integration Architecture
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| python-socketio as `socketio.ASGIApp` wrapper, not FastAPI router | Confident | `backend/app/main.py` structure; WebSocket handshake fails if mounted as router |
| `sio` singleton in `backend/app/socket/server.py` to avoid circular imports | Confident | `notification_service.py` called from multiple services; would create import cycle if sio in main.py |

### Authentication
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| REALTIME.md `auth: { token }` is incompatible with httpOnly cookie design | Confident | D-08 from Phase 1; `frontend/src/lib/api.ts` withCredentials pattern; tokens not JS-accessible |
| Resolution: `withCredentials: true` on socket.io-client; server reads cookie in connect handler | Likely | Browser sends httpOnly cookies on WebSocket upgrade to same origin; `nginx/nginx.conf` has /socket.io/ block |

### Emit Hook Placement
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Emit calls inside service functions, not route handlers | Likely | Routes are 3-line thin wrappers; Celery tasks call services directly and would miss events if emits were in routes |

### Frontend Socket Lifecycle
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Single shared socket instance per session (Zustand store or React context) | Likely | `NotificationBell.tsx` and `chat/[userId]/page.tsx` have isolated polling loops; Zustand stores are existing integration point |

## Corrections Made

No corrections — all assumptions confirmed by user.

## External Research Identified (resolved via codebase)

- **Nginx WebSocket support**: `nginx/nginx.conf` already has `/socket.io/` location block with upgrade headers — no changes needed (resolved via grep)
- **ASGI composition pattern**: Standard python-socketio `socketio.ASGIApp(sio, app)` wrapper — confirmed by architecture analysis
