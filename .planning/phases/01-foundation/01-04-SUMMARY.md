---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [nextjs, react, tailwind, zustand, axios, react-hook-form, zod, typescript]

requires:
  - phase: 01-03
    provides: Backend auth API endpoints (/api/auth/login, /register, /me, /logout, /reset-request) consumed by frontend forms and Zustand store

provides:
  - Next.js 16.2.1 frontend scaffold with full auth UI
  - Zustand auth store (no tokens in JS — D-09 compliance)
  - Axios API client with withCredentials:true for cookie-based auth
  - Next.js 16 proxy route guard redirecting /dashboard to /login
  - Auth pages: /login, /register, /reset-password
  - Protected route: /dashboard (placeholder)
  - Landing page at /
  - /api/health route for Docker healthcheck
  - React Hook Form + Zod validation on all auth forms

affects:
  - 01-05 (Docker Compose integration — frontend service must build and healthcheck)
  - Phase 2+ (dashboard stub to be replaced with real market UI)

tech-stack:
  added:
    - next@16.2.1
    - react@19.2.4
    - react-dom@19.2.4
    - tailwindcss@4.2.2
    - "@tailwindcss/postcss"
    - zustand@5.0.12
    - react-hook-form@7.72.0
    - zod@4.3.6
    - "@hookform/resolvers@3.x"
    - axios@1.13.6
    - socket.io-client@4.8.3
    - "@tanstack/react-query@5.95.2"
  patterns:
    - Zustand store with bootstrap() pattern calling /api/auth/me on mount
    - AuthBootstrap client component for useEffect in Server Component layout
    - React Hook Form + Zod resolver for form validation
    - Axios instance with withCredentials:true (cookie-first auth)
    - Next.js 16 proxy.ts (renamed from middleware.ts per Next.js 16 convention)

key-files:
  created:
    - frontend/package.json
    - frontend/tsconfig.json
    - frontend/.prettierrc
    - frontend/next.config.ts
    - frontend/postcss.config.mjs
    - frontend/tailwind.config.ts
    - frontend/src/app/globals.css
    - frontend/src/lib/api.ts
    - frontend/src/store/auth.ts
    - frontend/src/proxy.ts
    - frontend/src/app/layout.tsx
    - frontend/src/components/AuthBootstrap.tsx
    - frontend/src/components/nav/TopNav.tsx
    - frontend/src/components/auth/LoginForm.tsx
    - frontend/src/components/auth/RegisterForm.tsx
    - frontend/src/components/auth/ResetForm.tsx
    - frontend/src/app/page.tsx
    - frontend/src/app/(auth)/login/page.tsx
    - frontend/src/app/(auth)/register/page.tsx
    - frontend/src/app/(auth)/reset-password/page.tsx
    - frontend/src/app/(protected)/dashboard/page.tsx
    - frontend/src/app/api/health/route.ts
  modified:
    - frontend/tsconfig.json (Next.js 16 auto-updated jsx and include fields)

key-decisions:
  - "Next.js 16 renames middleware.ts to proxy.ts — route guard uses src/proxy.ts with exported function named 'proxy' (not 'middleware')"
  - "AuthBootstrap client component pattern required because root layout.tsx is a Server Component; cannot call useEffect directly in layout"
  - "Zustand store logout() is async (calls /api/auth/logout) — plan template showed sync but async is correct for cookie clearing"

patterns-established:
  - "AuthBootstrap: client component wrapping Zustand bootstrap() in useEffect; rendered in root layout for session hydration on app load"
  - "proxy.ts: Next.js 16 route guard reads access_token cookie to protect /dashboard, redirects authenticated users away from /login and /register"
  - "API client: single axios instance in src/lib/api.ts with withCredentials:true; all auth forms import from here"

requirements-completed: [INFRA-01]

duration: 16min
completed: 2026-03-24
---

# Phase 1 Plan 4: Frontend Scaffold Summary

**Next.js 16 app shell with Zustand auth store, axios cookie client, proxy route guard, and complete auth UI (login/register/reset/dashboard)**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-24T21:56:41Z
- **Completed:** 2026-03-24T22:13:23Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Complete Next.js 16.2.1 frontend with Tailwind CSS 4, Zustand, React Hook Form, and Zod
- Zustand auth store with bootstrap() pattern — no tokens in JS state (D-09 compliant)
- All auth pages functional: /login, /register, /reset-password with validated forms
- Dashboard placeholder at /dashboard with proxy guard redirecting unauthenticated users to /login
- npm run build and npm run type-check both pass with zero errors

## Task Commits

1. **Task 1: Frontend package setup** - `c24a98b` (feat)
2. **Task 2: App layout, auth store, API client, proxy guard, all pages** - `217071b` (feat)

## Files Created/Modified

- `frontend/src/lib/api.ts` — axios instance with withCredentials:true and configurable baseURL
- `frontend/src/store/auth.ts` — Zustand store: {user, isAuthenticated}, bootstrap(), logout()
- `frontend/src/proxy.ts` — Next.js 16 route guard for /dashboard, /login, /register
- `frontend/src/app/layout.tsx` — root layout with AuthBootstrap + TopNav
- `frontend/src/components/AuthBootstrap.tsx` — client component calling bootstrap() on mount
- `frontend/src/components/nav/TopNav.tsx` — navigation with conditional login/logout
- `frontend/src/components/auth/LoginForm.tsx` — email+password form, calls /api/auth/login
- `frontend/src/components/auth/RegisterForm.tsx` — email+username+password form, calls /api/auth/register
- `frontend/src/components/auth/ResetForm.tsx` — email form, calls /api/auth/reset-request
- `frontend/src/app/(auth)/login/page.tsx`, `register/page.tsx`, `reset-password/page.tsx` — auth pages
- `frontend/src/app/(protected)/dashboard/page.tsx` — placeholder dashboard
- `frontend/src/app/api/health/route.ts` — Docker healthcheck endpoint

## Decisions Made

- Next.js 16 renames `middleware.ts` to `proxy.ts` with a `proxy` named export — applied automatically during build verification
- Zustand `logout()` made async (calls /api/auth/logout before clearing state) — plan template showed sync but async is correct for server-side cookie clearing
- AuthBootstrap pattern used (client component) because root layout is a Server Component and cannot directly use useEffect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 middleware → proxy file rename**
- **Found during:** Task 2 (build verification)
- **Issue:** Next.js 16 deprecated `src/middleware.ts` convention; build emitted warning, then error when both files existed
- **Fix:** Renamed `src/middleware.ts` to `src/proxy.ts`; renamed the exported function from `middleware` to `proxy` per Next.js 16 requirement
- **Files modified:** `frontend/src/proxy.ts` (replaces `frontend/src/middleware.ts`)
- **Verification:** `npm run build` passes with no warnings
- **Committed in:** `217071b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/breaking change in Next.js 16)
**Impact on plan:** Required for build to succeed. Plan was written targeting Next.js 15; installed version is 16.2.1. No scope creep.

## Issues Encountered

- Background npm install (run_in_background) held a lock on node_modules, causing the second npm install call to fail with EACCES. Waited for the background process to complete before proceeding.

## Known Stubs

- `frontend/src/app/(protected)/dashboard/page.tsx` — dashboard shows "Prediction markets coming in Phase 2." This is intentional per plan (placeholder dashboard for Phase 1 auth flow demo).

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Frontend is fully scaffolded and builds cleanly
- Docker Compose integration (Plan 05) will wire the frontend container to the Nginx proxy and verify `https://localhost:8443` serves the frontend
- The /api/health route is ready for Docker healthcheck configuration

## Self-Check: PASSED

All 10 key files verified present. Both task commits (c24a98b, 217071b) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-03-24*
