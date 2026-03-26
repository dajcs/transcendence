---
phase: 02-core-betting
plan: 09
subsystem: ui
tags: [nextjs, react, dashboard, betting, portfolio]

requires:
  - phase: 02-core-betting
    provides: "Dashboard portfolio rows with bet position data (yes_pct, no_pct, side)"

provides:
  - "Clean dashboard active bet rows showing own-side win probability"
  - "Redundant View label removed from active bet rows"

affects: [02-core-betting]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - frontend/src/app/(protected)/dashboard/page.tsx

key-decisions:
  - "Display own-side win probability (Win X%) instead of both YES/NO percentages — simpler, user-centric"
  - "Remove flex justify-between wrapper since View span was the only right-aligned element"

patterns-established:
  - "Portfolio row UX: row is the affordance; no redundant navigation labels"

requirements-completed: [BET-07]

duration: 2min
completed: 2026-03-26
---

# Phase 02 Plan 09: Dashboard Portfolio Row Cleanup Summary

**Dashboard active bet rows now show own-side win probability (Win X%) with the redundant "View ->" label removed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T13:19:00Z
- **Completed:** 2026-03-26T13:19:49Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed redundant "View ->" span from active bet rows (row itself is the clickable Link)
- Replaced `YES X% / NO Y%` display with `Win Z%` computed from user's position side
- Simplified row markup by removing the now-unnecessary flex justify-between wrapper div

## Task Commits

1. **Task 1: Remove View label and show own-side win probability** - `d21d8d2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/app/(protected)/dashboard/page.tsx` - Removed View span, replaced dual probability with own-side Win %

## Decisions Made

- Removed the `flex items-center justify-between` wrapper div since the View span was the only right-aligned element; title paragraph now sits directly under the Link without extra div nesting.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard portfolio rows now match UAT Test 11 expectations
- Active bets clearly show the user's own win probability for their side

---
*Phase: 02-core-betting*
*Completed: 2026-03-26*
