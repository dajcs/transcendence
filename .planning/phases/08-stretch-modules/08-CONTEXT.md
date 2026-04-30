# Phase 8: Stretch Modules - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers optional 42 module points beyond the 14-point baseline. Primary goal is Responsive Web Design (RWD) — making the app fully mobile-friendly (2pts major). Public REST API and PWA are secondary candidates if RWD completes early, but are not committed deliverables.

</domain>

<decisions>
## Implementation Decisions

### Module Scope
- **D-01:** Primary deliverable is RWD only (+2pts major). This is the target for planning and execution.
- **D-02:** Public API (+1pt minor) and PWA (+2pts major) are noted as potential additions if implementation goes quickly — but carry no commitment. They should appear in plans as optional/deferred, not as primary goals.
- **D-03:** If Public API or PWA are attempted, they follow RWD completion — not in parallel.
- **D-04:** After RWD UAT passed on 2026-04-30, continue Phase 8 with the recommended read-only Public API scope. The API must expose public list/detail endpoints for markets, comments, participants, payouts, public profiles, and leaderboards. It must not expose write actions, API keys, private settings, notification data, chat data, friend data, account data export/delete, or LLM endpoints.

### Claude's Discretion
- RWD breakpoints (Tailwind's default sm/md/lg are fine)
- Which pages to prioritize within RWD (markets list + market detail + nav are highest-traffic)
- Whether to use a hamburger menu or collapsing nav on mobile
- Mobile layout for the chat thread and friends pages
- Exact order of page retrofits within the RWD plan
- Public API should use a dedicated `/api/public/` prefix so the stretch module is obvious in Swagger/OpenAPI and cannot accidentally inherit authenticated write routes.
- PWA library choice (next-pwa or manual service worker) if attempted

</decisions>

<specifics>
## Specific Ideas

- "Start conservative" — the 14pt baseline is secured; RWD is bonus points, not a requirement for passing
- Leave room in notes for Public API and PWA in case RWD goes quickly

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and module requirements
- `.planning/ROADMAP.md` — Phase 8 goal, deliverables, module points breakdown (RWD 2pts, Public API 1pt, PWA 2pts)
- `.planning/REQUIREMENTS.md` — STRETCH-01 (Public API), STRETCH-02 (advanced search), STRETCH-03 (PWA) definitions

### Frontend codebase
- `.planning/codebase/STRUCTURE.md` — full directory layout and where to add code
- `.planning/codebase/CONVENTIONS.md` — Tailwind CSS patterns, component naming conventions
- `frontend/src/app/layout.tsx` — root layout; TopNav is mounted here
- `frontend/src/components/nav/TopNav.tsx` — navigation bar (needs mobile treatment)

### Pages to make responsive (15 total)
- `frontend/src/app/page.tsx` — public landing page
- `frontend/src/app/(auth)/login/page.tsx`
- `frontend/src/app/(auth)/register/page.tsx`
- `frontend/src/app/(auth)/reset-password/page.tsx`
- `frontend/src/app/(protected)/markets/page.tsx` — markets list (highest traffic)
- `frontend/src/app/(protected)/markets/[id]/page.tsx` — market detail + betting (highest traffic)
- `frontend/src/app/(protected)/markets/new/page.tsx`
- `frontend/src/app/(protected)/friends/page.tsx`
- `frontend/src/app/(protected)/chat/page.tsx`
- `frontend/src/app/(protected)/chat/[userId]/page.tsx`
- `frontend/src/app/(protected)/profile/[username]/page.tsx`
- `frontend/src/app/(protected)/hall-of-fame/page.tsx`
- `frontend/src/app/(protected)/settings/page.tsx`
- `frontend/src/app/privacy/page.tsx`
- `frontend/src/app/terms/page.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tailwind CSS 4.0 is already installed with full responsive breakpoint support (`sm:`, `md:`, `lg:` prefixes)
- TopNav (`frontend/src/components/nav/TopNav.tsx`) — shared nav bar; needs mobile-responsive treatment as part of RWD
- All pages already use Tailwind utility classes; RWD is mostly adding breakpoint variants, not rewriting

### Established Patterns
- App Router (Next.js 15) — server components for pages, client components where needed
- FastAPI already generates OpenAPI docs at `/api/docs` — Public API module has a head start
- Auth uses JWT cookies via httpOnly — public endpoints would need explicit exemption from auth dependency
- Existing route protection via `frontend/src/proxy.ts`

### Integration Points
- RWD touches all 15 page files + TopNav component
- Public API (if attempted): new router in `backend/app/api/routes/public.py`, registered in `main.py`, rate-limit middleware
- PWA (if attempted): `next.config.ts` + `public/manifest.json` + service worker config

</code_context>

<deferred>
## Deferred Ideas

- Public API (+1pt minor) — secondary candidate if RWD finishes early; otherwise defer to backlog
- PWA (+2pts major) — secondary candidate if both RWD and Public API complete; otherwise defer
- Advanced search (STRETCH-02) — not in ROADMAP Phase 8 deliverables; move to backlog

</deferred>

---

*Phase: 08-stretch-modules*
*Context gathered: 2026-04-29*
