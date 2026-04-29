---
phase: quick-i6c
plan: 01
subsystem: frontend-nav
tags: [sidebar, navigation, ui, layout]
dependency_graph:
  requires: []
  provides: [redesigned-sidebar-layout]
  affects: [frontend/src/components/nav/Sidebar.tsx]
tech_stack:
  added: []
  patterns: [flex-layout, bubble-pills, justify-between-footer]
key_files:
  modified:
    - frontend/src/components/nav/Sidebar.tsx
decisions:
  - "♦ separators placed between bubbles as standalone spans, not inside bubble text"
  - "Language select uses w-8 fixed width with 2-char options (EN/FR/DE) instead of flex-1"
  - "Theme toggle wrapped in flex-1 justify-center div for true centering in controls row"
  - "NotificationBell wrapped in ml-auto shrink-0 div for right-alignment"
  - "Footer rewritten as single flex justify-between row, removing nested div"
metrics:
  duration: 5min
  completed: "2026-04-24"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-i6c Plan 01: Left Navigation Bar Redesign Summary

**One-liner:** Sidebar reordered and restructured — username+logout before point bubbles, ♦ separators between pills, narrow 2-char language select, centered theme toggle, split footer.

## What Was Built

Rewrote `frontend/src/components/nav/Sidebar.tsx` to match the specified 11-item layout order:

1. Logo/title (Vox Populi)
2. Spacer (h-2)
3. Username + logout row (username left, logout icon right)
4. Point balances row — pink (LP int), ♦, green (BP 1dp), ♦, blue (TP 1dp) — no symbols inside green/blue bubbles
5. Profile link
6. Search Users
7. Spacer (h-2)
8. Controls row — language select left (w-8, EN/FR/DE), theme toggle centered (flex-1 justify-center), notification bell right (ml-auto)
9. Create Market button
10. Nav links (Markets, Friends, Chat, Hall of Fame)
11. Footer (Privacy Policy left, Terms of Service right via justify-between)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passed with zero errors
- All existing logic preserved: handleLogout, isActive, isDark, mounted, profileHref, navLinks array, all SVG icon components
- Point bubble format: pink `❤️ {lp}` (integer), green `{bp} BP` (1dp), blue `{tp} TP` (1dp), ♦ separators between bubbles

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- File exists: `/mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx` — FOUND
- TypeScript: no errors
- No commit made (user requested review before commit)
