---
status: complete
completed: 2026-04-23
commit: pending
---

# Summary

Removed the obsolete `/dashboard` page and all remaining live links or redirects to it.

Changed:
- Deleted `frontend/src/app/(protected)/dashboard/page.tsx`.
- Removed `/dashboard` from `frontend/src/proxy.ts` protected route matching.
- Changed notification, privacy, terms, and OAuth callback fallbacks from dashboard to `/markets`.
- Removed unused dashboard i18n keys from EN/FR/DE dictionaries.
- Updated `NotificationBell` test expectations.
- Updated current architecture/planning/state/handoff docs to record that profile tabs replace dashboard workflows.

Verification:
- `npm run type-check` passed.
- `npm test -- NotificationBell.test.tsx --runInBand` passed.
- `rg "Dashboard|/dashboard|dashboard\\." frontend/src backend/app` returns no live code matches.

Notes:
- User manually tested and approved before commit.
