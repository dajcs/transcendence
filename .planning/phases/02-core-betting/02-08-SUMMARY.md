---
phase: 02-core-betting
plan: 08
subsystem: ui
tags: [comments, replies, author, fastapi, react, sqlalchemy]

requires:
  - phase: 02-core-betting
    provides: Comment model with parent_id and CommentUpvote; markets/[id] page with comment list

provides:
  - CommentResponse with author_username via User join in list_comments and create_comment
  - Reply UI: replyingTo state, inline reply form, indented replies, Reply button on top-level comments only

affects: [02-core-betting, discussion-features]

tech-stack:
  added: []
  patterns:
    - "SQLAlchemy join(User) to enrich comment responses with author_username"
    - "React replyingTo state pattern: toggle collapse/expand inline reply form"

key-files:
  created: []
  modified:
    - backend/app/schemas/comment.py
    - backend/app/services/comment_service.py
    - frontend/src/lib/types.ts
    - frontend/src/app/(protected)/markets/[id]/page.tsx

key-decisions:
  - "Join User in both list_comments and create_comment rather than a separate lookup endpoint — keeps API contract simple"
  - "One-level reply depth enforced in backend (replies to replies return 422) — Reply button hidden on comments with parent_id"

patterns-established:
  - "Comment enrichment: join User at query time, not via lazy load"
  - "Reply form rendered inline per-comment via replyingTo === comment.id toggle"

requirements-completed: [DISC-01, DISC-02]

duration: 2min
completed: 2026-03-26
---

# Phase 02 Plan 08: Comment Author Display and Reply UI Summary

**Comment responses now include author_username via User join; Reply button on top-level comments opens inline indented form with parent_id wiring.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T11:39:20Z
- **Completed:** 2026-03-26T11:41:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Backend CommentResponse now returns author_username populated from a User join in both list_comments and create_comment
- Frontend Comment interface includes author_username; each comment renders the username above content
- Reply button on top-level comments toggles an inline form; submitting posts with correct parent_id
- Reply comments are visually indented with ml-6

## Task Commits

1. **Task 1: Add author_username to backend schema and service** - `2980911` (feat)
2. **Task 2: Add author display and reply UI to frontend** - `9922941` (feat)

## Files Created/Modified

- `backend/app/schemas/comment.py` - Added author_username field to CommentResponse
- `backend/app/services/comment_service.py` - Import User model; join User in list_comments; query User in create_comment
- `frontend/src/lib/types.ts` - Added author_username to Comment interface
- `frontend/src/app/(protected)/markets/[id]/page.tsx` - Added replyingTo/replyText state; updated postComment mutation; reply UI with indented replies

## Decisions Made

- Join User at query time in both list and create paths — avoids lazy loading, keeps schema complete.
- One-level reply depth: Reply button hidden when comment.parent_id !== null; backend already enforces this with 422.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Comment author attribution complete; UAT Test 10 gap closed
- Real-time comment updates via Socket.IO (phase 03) can build on this UI
- Reply depth limit enforced both backend and frontend

---
*Phase: 02-core-betting*
*Completed: 2026-03-26*
