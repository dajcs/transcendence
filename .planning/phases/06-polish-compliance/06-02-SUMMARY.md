---
phase: 06-polish-compliance
plan: 02
subsystem: ui
tags: [i18n, react, nextjs, typescript, privacy, terms, tailwind]

requires:
  - phase: 06-01
    provides: useT() hook, EN/FR/DE dictionaries, locale store — i18n infrastructure this plan extends

provides:
  - Privacy Policy page (/privacy) fully translated in EN, FR, DE via useT()
  - Terms of Service page (/terms) fully translated in EN, FR, DE via useT()
  - 49 privacy.* keys and 33 terms.* keys added to all three dictionaries

affects:
  - 06-03 (OAuth page — may also need i18n)
  - 06-04 (Chrome audit — no console errors from these pages)

tech-stack:
  added: []
  patterns:
    - "Static legal pages converted from Server Components to Client Components using useT() for i18n"
    - "export const metadata removed from 'use client' pages — metadata lives in parent layout"

key-files:
  created: []
  modified:
    - frontend/src/i18n/en.ts
    - frontend/src/i18n/fr.ts
    - frontend/src/i18n/de.ts
    - frontend/src/app/privacy/page.tsx
    - frontend/src/app/terms/page.tsx

key-decisions:
  - "metadata export removed from client components — incompatible with 'use client'; layout title fallback is acceptable"
  - "Table cell service names (Google OAuth, GitHub OAuth, etc.) left as EN literals — proper nouns, not translatable"

patterns-established:
  - "Legal pages use 'use client' + useT() — same pattern as other translated pages in the app"

requirements-completed: [COMP-02, COMP-03]

duration: 12min
completed: 2026-04-09
---

# Phase 06 Plan 02: Privacy and Terms i18n Summary

**Privacy Policy and Terms of Service pages converted to 'use client' components with full EN/FR/DE translation via useT() — 82 new translation keys across all three dictionaries.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-09T19:01:00Z
- **Completed:** 2026-04-09T19:13:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added 49 `privacy.*` keys and 33 `terms.*` keys to en.ts, fr.ts, and de.ts
- Converted `frontend/src/app/privacy/page.tsx` from static Server Component to `"use client"` component with 50 `t()` calls
- Converted `frontend/src/app/terms/page.tsx` from static Server Component to `"use client"` component with 33 `t()` calls
- All dark mode Tailwind classes preserved (32 dark: classes in privacy, 28 in terms)

## Task Commits

1. **Task 1: Add privacy and terms translation keys to all three dictionaries** - `1c72ef1` (feat)
2. **Task 2: Convert privacy and terms pages to i18n Client Components** - `65c5d5c` (feat)

## Files Created/Modified

- `frontend/src/i18n/en.ts` — 82 new keys: `privacy.*` and `terms.*` sections
- `frontend/src/i18n/fr.ts` — Full French translations for all 82 keys
- `frontend/src/i18n/de.ts` — Full German translations for all 82 keys
- `frontend/src/app/privacy/page.tsx` — Converted to `"use client"` with useT(); removed `export const metadata`
- `frontend/src/app/terms/page.tsx` — Converted to `"use client"` with useT(); removed `export const metadata`

## Decisions Made

- `export const metadata` removed from both client components — Next.js does not allow `metadata` exports from `"use client"` files. The layout.tsx default title ("Vox Populi") is an acceptable fallback for these legal pages.
- Table cell service names (Google OAuth, GitHub OAuth, 42 School OAuth, OpenRouter) kept as English literals — these are proper nouns and product names, not subject to translation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all visible text strings on both pages are wired to translation keys.

## Next Phase Readiness

- COMP-02 (Privacy Policy i18n) and COMP-03 (Terms of Service i18n) requirements satisfied
- Both pages render translated headings, body text, and navigation links when locale is toggled
- Ready for Phase 06-03 (OAuth i18n) and 06-04 (Chrome audit)

---
*Phase: 06-polish-compliance*
*Completed: 2026-04-09*
