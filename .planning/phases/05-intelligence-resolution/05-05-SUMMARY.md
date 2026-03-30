---
phase: 05-intelligence-resolution
plan: 05
subsystem: ui
tags: [react, nextjs, tanstack-query, fastapi, pydantic, resolution, dispute, llm]

requires:
  - phase: 05-04
    provides: GET /api/bets/{id}/resolution, POST /api/bets/{id}/resolve, POST /api/bets/{id}/dispute, POST /api/bets/{id}/vote
  - phase: 05-03
    provides: POST /api/bets/{id}/summary, POST /api/bets/{id}/resolution-hint

provides:
  - ResolutionSection inline on market detail page (proposer form + AI hint + outcome display)
  - DisputeSection inline on market detail page (Open Dispute + Vote YES/NO + weight display)
  - LLM Summarize discussion button in comments section
  - Settings page at /settings with LLM opt-out toggle
  - PATCH /api/users/me endpoint accepting llm_opt_out
  - GET /api/users/me endpoint for settings page
  - ResolutionRecord, DisputeRecord, ResolutionState types in frontend/src/lib/types.ts

affects:
  - frontend navigation (settings page added)
  - phase 05 end-to-end UX
  - REQUIREMENTS.md RES-02, RES-03, RES-04, RES-05, LLM-01, LLM-02

tech-stack:
  added: []
  patterns:
    - useQuery with enabled guard for resolution state (only fetches when market status != open)
    - useMutation + queryClient.invalidateQueries for optimistic cache invalidation on resolution actions

key-files:
  created:
    - frontend/src/app/(protected)/settings/page.tsx
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/app/(protected)/markets/[id]/page.tsx
    - backend/app/api/routes/users.py

key-decisions:
  - "GET /api/users/me added alongside PATCH because settings page needs to read current llm_opt_out value (Rule 2)"
  - "resolutionQuery enabled only when market.status !== open to avoid 404 on open markets"
  - "payoutBanner state added as a display slot — populated by future socket event handler or backend response"

requirements-completed: [RES-02, RES-03, RES-04, RES-05, LLM-01, LLM-02]

duration: 10min
completed: 2026-03-30
---

# Phase 05 Plan 05: Intelligence-Resolution Frontend Summary

**Inline resolution/dispute UI wired to Phase 5 backend — ResolutionSection + DisputeSection + LLM buttons on market detail, settings page with LLM opt-out**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T22:37:00Z
- **Completed:** 2026-03-30T22:42:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended Market.status union and added ResolutionRecord/DisputeRecord/ResolutionState types to types.ts
- Market detail page has full inline resolution/dispute flow: proposer form with AI hint, community vote section, dispute open button
- LLM summarize discussion button visible below Comments heading
- Settings page created at /settings with LLM opt-out checkbox calling PATCH /api/users/me
- Backend users.py has UpdateUserRequest with llm_opt_out + PATCH /api/users/me handler

## Task Commits

1. **Task 1: Extend types.ts** - `da55913` (feat)
2. **Task 2: Backend PATCH + market detail UI + settings page** - `cf28d00` (feat)

## Files Created/Modified

- `frontend/src/lib/types.ts` - Added ResolutionRecord, DisputeRecord, ResolutionState; extended Market.status union
- `frontend/src/app/(protected)/markets/[id]/page.tsx` - ResolutionSection, DisputeSection, LLM buttons added inline
- `frontend/src/app/(protected)/settings/page.tsx` - New settings page with LLM opt-out toggle
- `backend/app/api/routes/users.py` - UpdateUserRequest + PATCH /api/users/me + GET /api/users/me

## Decisions Made

- Added GET /api/users/me endpoint (not in plan) because settings page calls it and the existing GET /{username} route would not match "me" — Rule 2 auto-fix.
- resolutionQuery has `enabled: !!marketId && !!market && market.status !== "open"` to avoid 404s for open markets where no resolution record exists yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GET /api/users/me endpoint**
- **Found during:** Task 2 (settings page creation)
- **Issue:** Settings page's profileQuery calls `GET /api/users/me`. Without this endpoint the existing `GET /{username}` route would match "me" as a username and return 404 (no user named "me").
- **Fix:** Added `GET /api/users/me` returning `{llm_opt_out: bool}` before the `GET /{username}` route so FastAPI route priority works correctly.
- **Files modified:** backend/app/api/routes/users.py
- **Verification:** Endpoint verified via grep; route ordering confirmed in file
- **Committed in:** cf28d00 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing endpoint for correctness)
**Impact on plan:** Essential for settings page to work correctly. No scope creep.

## Issues Encountered

None — plan mapped cleanly to existing backend endpoints from Plans 02-04.

## Known Stubs

- `payoutBanner` state is initialized to `null` and never set — it exists as a display slot for future socket event (e.g., `bet:payout`) that will be wired in a future plan or manually. The resolution UI works without it; it only affects the payout confirmation banner.

## Next Phase Readiness

- All Phase 5 frontend UI is now wired to the backend
- Manual verification needed: test the resolution flow end-to-end in browser with Docker stack running
- Settings page accessible at /settings (no nav link added — can be added via profile menu in a future plan)

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-03-30*
