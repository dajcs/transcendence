---
status: complete
completed_at: "2026-04-26T07:22:36.845Z"
---

# Summary

Fixed successful login navigation after an expired session redirects a protected page visit to `/login`.

## Changes
- Updated `LoginForm` to call `router.refresh()` after auth bootstrap so App Router server state observes the newly-set auth cookie.
- Replaced post-login `router.push("/markets")` with `router.replace("/markets")` so `/login` is not left in the back stack after a valid login.
- Added a regression test proving successful login now refreshes and replaces the login route.

## Verification
- Red check: temporarily restored the old `router.push("/markets")` behavior and confirmed `docker compose exec frontend npm test -- LoginForm.test.tsx --runInBand` failed because `router.refresh()` was not called.
- Green check: restored the fix and confirmed `docker compose exec frontend npm test -- LoginForm.test.tsx --runInBand` passed, 5/5 tests.
- Type check: `docker compose exec frontend npm run type-check` passed.
