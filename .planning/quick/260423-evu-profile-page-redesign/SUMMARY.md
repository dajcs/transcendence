---
quick_id: 260423-evu
slug: profile-page-redesign
status: complete
date: 2026-04-23
---

# Profile Page Redesign

Implemented the requested profile and navigation changes.

## Changes

- Profile header now uses `blurb`, `Add mission statement`, and `Change mission` copy.
- Own-profile mission editing now uses an inline input. Empty missions show an input with `Add mission statement` placeholder; typing reveals `Accept`; accepted text becomes clickable mission text with a `Change mission` tooltip.
- Own-profile settings affordance is now a text `Settings` button/link instead of a cogwheel.
- Top navigation settings links were removed from desktop and mobile menus.
- Top navigation balances now render in order: `♥ <x> · BP <y> · TP <z>`.
- Profile stats now render five boxes: `♥`, `BP`, `TP`, `Total Bets`, and `Win Rate`.
- Profile stats format `♥` and `Total Bets` as integers; `BP`, `TP`, and `Win Rate` render with one decimal.
- The `♥` stats label is larger and red.
- Own-profile tabs render as `Points`, `Bets`, `Markets`.
- Other-user tabs remain username-scoped and their bets tab is now visible.
- Backend `GET /api/bets/positions` accepts optional `user_id` so profiles can display another user's bets.
- Public profile responses now include `bp`.
- Updated the Phase 05.1 UI spec to document the final inline mission editor, five-box stats row, own/other tab labels, and public viewed-profile bets behavior.

## Verification

- `git diff --check` passed.
- `python -m py_compile backend/app/api/routes/bets.py backend/app/schemas/profile.py backend/app/services/profile_service.py backend/tests/test_bets.py` passed.
- Re-ran `git diff --check` and backend Python syntax compilation after the inline mission changes; both passed.
- Focused frontend Jest could not execute because `frontend/node_modules` is missing and the environment falls back to a broken global Jest missing `import-local`.
- Focused backend pytest could not execute because the backend environment is missing `sqlalchemy`.
- Human visual check accepted on 2026-04-23.
