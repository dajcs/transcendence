---
phase: 05-intelligence-resolution
plan: "07"
subsystem: llm-settings
tags: [llm, settings, migration, config-endpoint, profile]
dependency_graph:
  requires: [05-05, 05-06]
  provides: [llm-model-field, llm-available-endpoint, settings-redesign, profile-cogwheel]
  affects: [frontend/settings, frontend/profile, backend/users, backend/config]
tech_stack:
  added: []
  patterns: [conditional-ui-from-env-flag, per-user-llm-model-selection]
key_files:
  created:
    - backend/alembic/versions/012_add_llm_model_field.py
    - backend/app/api/routes/config.py
  modified:
    - backend/app/db/models/user.py
    - backend/app/api/routes/users.py
    - backend/app/main.py
    - frontend/src/app/(protected)/settings/page.tsx
    - frontend/src/app/(protected)/profile/[username]/page.tsx
decisions:
  - "GET /api/config/llm-available reads OPENROUTER_API_KEY from env; never exposes the value — only bool presence"
  - "Settings page defaults to 'disabled' when platform key unavailable to avoid broken default mode"
  - "Settings cogwheel uses Link (not router.push) for clean Next.js navigation"
metrics:
  duration: 5min
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 7
---

# Phase 05 Plan 07: LLM Settings Redesign Summary

Redesigned LLM settings to match D-15 spec: conditional platform-default option, full custom-key form with provider+key+model fields, DB migration for llm_model, new config endpoint for key presence, and Settings cogwheel on profile page.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add llm_model to User model and migration 012 | dda0eb1 | user.py, 012_add_llm_model_field.py, users.py, config.py, main.py |
| 2 | Redesign settings page and add profile cogwheel button | 765fd8a | settings/page.tsx, profile/[username]/page.tsx |

## What Was Built

- **Migration 012** (`backend/alembic/versions/012_add_llm_model_field.py`): Adds `llm_model` TEXT nullable column to users table; down_revision="011"
- **User model** (`backend/app/db/models/user.py`): Added `llm_model: Mapped[str | None]` mapped column
- **Config endpoint** (`backend/app/api/routes/config.py`): `GET /api/config/llm-available` returns `{available: bool}` from `OPENROUTER_API_KEY` env presence; key value never exposed
- **Users API** (`backend/app/api/routes/users.py`): `llm_model` added to `UpdateUserRequest`, GET response, and PATCH response
- **Main.py**: `config_router` registered with `prefix="/api"` making endpoint `GET /api/config/llm-available`
- **Settings page**: Fetches `/api/config/llm-available` on mount; Platform Default radio only rendered when `llmAvailable === true`; adds model text input in custom mode; defaults to "disabled" when platform key unavailable
- **Profile page**: Settings cogwheel `<Link href="/settings">` visible only when `isOwnProfile === true`

## Decisions Made

1. `GET /api/config/llm-available` reads `OPENROUTER_API_KEY` from environment; returns only `{available: bool}` — key value is never exposed to the client
2. Settings page defaults to `"disabled"` when `llmAvailable === false` and saved mode was `"default"` — prevents users being stuck on a broken default
3. Cogwheel button uses Next.js `<Link>` component for client-side navigation to `/settings`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields are wired to real API endpoints.

## Self-Check: PASSED

Files exist:
- backend/alembic/versions/012_add_llm_model_field.py: FOUND
- backend/app/api/routes/config.py: FOUND
- frontend/src/app/(protected)/settings/page.tsx: FOUND (modified)
- frontend/src/app/(protected)/profile/[username]/page.tsx: FOUND (modified)

Commits exist:
- dda0eb1: FOUND (Task 1)
- 765fd8a: FOUND (Task 2)
