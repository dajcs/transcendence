---
phase: 02-core-betting
plan: 05
subsystem: api
tags: [comments, celery, tasks]
requires:
  - phase: 02-03
    provides: market entities
  - phase: 02-04
    provides: position lifecycle
provides:
  - Comments API (create/list/upvote)
  - One-level reply depth enforcement
  - Daily allocation task and Celery beat scheduling
affects: [backend, infra]
tech-stack:
  added: []
  patterns: ["comment upvote to kp ledger event"]
key-files:
  created:
    - backend/app/services/comment_service.py
    - backend/app/schemas/comment.py
    - backend/app/api/routes/comments.py
    - backend/app/workers/tasks/daily.py
    - backend/app/workers/tasks/__init__.py
  modified:
    - backend/app/workers/celery_app.py
    - docker-compose.yml
    - backend/app/main.py
key-decisions:
  - "Scheduled daily allocation using Celery beat crontab at 00:00 UTC."
patterns-established:
  - "Comment upvote writes both upvote edge and kp event in one request flow"
requirements-completed: [BET-07, DISC-01, DISC-02, DISC-03]
duration: 26 min
completed: 2026-03-25
---

# Phase 02 Plan 05 Summary

**Discussion threads and upvote karma are active, and daily economy allocation is scheduled through Celery beat.**

## Accomplishments
- Added comment creation, listing, reply-depth guardrails, and upvote endpoint.
- Added daily allocation worker task and beat schedule wiring.
- Added `celery-beat` service to compose configuration.

## Deviations from Plan
- [Rule 1 - Bug] Converted inner transaction blocks to explicit commit/rollback in upvote flow to keep session transaction state valid.

## Issues Encountered
None after transaction-boundary adjustment.
