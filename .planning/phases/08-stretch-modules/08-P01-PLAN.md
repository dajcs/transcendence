---
phase: 08-stretch-modules
plan: P01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/AppShell.tsx
  - frontend/src/components/nav/Sidebar.tsx
  - frontend/src/app/layout.tsx
autonomous: true
requirements:
  - STRETCH-01  # deferred per D-02; coverage acknowledgment only
  - STRETCH-03  # deferred per D-02; coverage acknowledgment only

must_haves:
  truths:
    - "On mobile (<768px), the sidebar is hidden by default and does not overlap page content"
    - "A hamburger button is always visible on mobile to open/close the sidebar"
    - "Tapping outside the sidebar drawer closes it via backdrop overlay"
    - "Navigating to any page via sidebar link closes the drawer"
    - "On desktop (>=768px), the sidebar is always visible and content is offset by 220px"
    - "On mobile, content is not offset (full-width viewport available)"
  artifacts:
    - path: "frontend/src/components/AppShell.tsx"
      provides: "Breakpoint-conditional margin offset"
      contains: "md:ml-[220px]"
    - path: "frontend/src/components/nav/Sidebar.tsx"
      provides: "Mobile slide-in drawer with hamburger toggle and backdrop"
      exports: ["default"]
    - path: "frontend/src/app/layout.tsx"
      provides: "Mobile top bar spacing compensation"
      contains: "pt-4 md:pt-8"
  key_links:
    - from: "frontend/src/components/nav/Sidebar.tsx"
      to: "mobile top bar trigger"
      via: "fixed top strip with hamburger button inside Sidebar"
      pattern: "md:hidden fixed top-0"
    - from: "frontend/src/components/AppShell.tsx"
      to: "sidebar width offset"
      via: "breakpoint-conditional ml class"
      pattern: "md:ml-\\[220px\\]"
---

<objective>
Make the navigation shell fully responsive: Sidebar becomes a mobile slide-in drawer with a hamburger toggle, and AppShell removes the unconditional 220px left margin so content is full-width on mobile.

Purpose: These two files control all authenticated page layout. Fixing them unblocks all 15 pages at once without touching any page file.

Output: Sidebar with mobile hamburger drawer; AppShell with breakpoint-conditional offset; layout.tsx with mobile top-bar padding compensation.

NOTE — Deferred items (acknowledged for requirement coverage tracking):
- STRETCH-01 (Public API): deferred per D-02 in CONTEXT.md. Not implemented in this phase.
- STRETCH-03 (PWA): deferred per D-02 in CONTEXT.md. Not implemented in this phase.
</objective>

<execution_context>
@/mnt/c/Users/dajcs/code/transcendence/.claude/get-shit-done/workflows/execute-plan.md
@/mnt/c/Users/dajcs/code/transcendence/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/08-stretch-modules/08-PATTERNS.md
@.planning/phases/08-stretch-modules/08-CONTEXT.md

<interfaces>
<!-- Key patterns extracted from PATTERNS.md for this plan. Executor does not need to explore the codebase. -->

From frontend/src/components/AppShell.tsx (current full file — 12 lines):
```tsx
"use client";
import { useAuthStore } from "@/store/auth";
export default function AppShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <div className={isAuthenticated ? "ml-[220px]" : ""}>
      {children}
    </div>
  );
}
```

From frontend/src/components/nav/Sidebar.tsx (line 100 — aside element):
```tsx
<aside className="fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r border-gray-200 dark:border-[oklch(22%_0.015_250)] transition-colors duration-200">
```

From frontend/src/components/nav/TopNav.tsx (hamburger pattern — use as code reference only, not target):
```tsx
// State:
const [mobileOpen, setMobileOpen] = useState(false);

// Hamburger button (mobile only):
<button
  onClick={() => setMobileOpen((v) => !v)}
  className="md:hidden p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
  aria-label="Toggle menu"
>
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {mobileOpen ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    )}
  </svg>
</button>
```

From frontend/src/app/layout.tsx (line 45 — main element):
```tsx
<main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix AppShell breakpoint-conditional offset</name>
  <files>frontend/src/components/AppShell.tsx</files>
  <read_first>
    - frontend/src/components/AppShell.tsx — read the current full file before editing
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — section "Breakpoint-conditional margin offset"
  </read_first>
  <action>
    Change the single class on line 8 of AppShell.tsx from `"ml-[220px]"` to `"md:ml-[220px]"`.

    The full resulting file:
    ```tsx
    "use client";

    import { useAuthStore } from "@/store/auth";

    export default function AppShell({ children }: { children: React.ReactNode }) {
      const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
      return (
        <div className={isAuthenticated ? "md:ml-[220px]" : ""}>
          {children}
        </div>
      );
    }
    ```

    This is the entire change to this file. Do not add anything else.
  </action>
  <verify>
    <automated>grep -c 'md:ml-\[220px\]' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/AppShell.tsx</automated>
    Expected output: 1
    <automated>grep -v 'md:' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/AppShell.tsx | grep -c 'ml-\[220px\]'</automated>
    Expected output: 0 (no unconditional ml-[220px] remains)
  </verify>
  <done>AppShell.tsx contains exactly `"md:ml-[220px]"` (breakpoint-conditional) and no bare `"ml-[220px]"`.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add hamburger drawer to Sidebar with mobile top bar and backdrop</name>
  <files>frontend/src/components/nav/Sidebar.tsx</files>
  <read_first>
    - frontend/src/components/nav/Sidebar.tsx — read the FULL file before editing (need to understand all nav Link elements and existing component structure)
    - frontend/src/components/nav/TopNav.tsx — lines 69, 142–154, 159–209 for the hamburger pattern (reference only, not target)
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — section "Group A: Navigation Shell" and "Shared Patterns"
  </read_first>
  <action>
    Make Sidebar.tsx a client component with mobile hamburger drawer behavior. Apply these changes:

    **1. Ensure `"use client"` directive is at top** (add if missing — useState requires it).

    **2. Add useState import** for `mobileOpen` state:
    ```tsx
    const [mobileOpen, setMobileOpen] = useState(false);
    ```

    **3. Change the `<aside>` element className** to be conditionally translated off-screen on mobile:
    ```tsx
    <aside className={`fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r border-gray-200 dark:border-[oklch(22%_0.015_250)] transition-colors duration-200 transition-transform ${
      mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    }`}>
    ```
    Note: keep all existing className tokens; only add the translate classes.

    **4. Add a mobile-only top bar INSIDE the return but BEFORE the `<aside>` element** (or as first child of the fragment). This bar is always visible regardless of sidebar state:
    ```tsx
    {/* Mobile-only top bar — always visible, contains logo and hamburger */}
    <div className="md:hidden fixed top-0 left-0 right-0 z-[99] flex items-center justify-between px-4 h-12 bg-white dark:bg-[oklch(14%_0.015_250)] border-b border-gray-200 dark:border-[oklch(22%_0.015_250)]">
      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Vox Populi</span>
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        aria-label="Toggle menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
    ```

    **5. Add backdrop overlay** between the top bar and the `<aside>`:
    ```tsx
    {/* Backdrop — closes sidebar on outside click (mobile only) */}
    {mobileOpen && (
      <div
        className="md:hidden fixed inset-0 z-[98] bg-black/40"
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
    )}
    ```

    **6. Add `onClick={() => setMobileOpen(false)}` to ALL nav `<Link>` elements** inside the `<aside>` so navigating to a page closes the drawer. Find every `<Link href=...>` in the Sidebar body and add the onClick prop. Do not modify Link props or hrefs — only add onClick.

    The component return must be wrapped in a React Fragment (`<>...</>`) or a `<div>` since it now renders multiple root elements (top bar + backdrop + aside).

    Do NOT modify the logo, nav links, user avatar, or any other visual elements — only the structural/behavioral changes above.
  </action>
  <verify>
    <automated>grep -c 'translate-x-0' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx</automated>
    Expected: >= 1
    <automated>grep -c '\-translate-x-full md:translate-x-0' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx</automated>
    Expected: 1
    <automated>grep -c 'mobileOpen' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx</automated>
    Expected: >= 3 (state declaration + toggle + translate conditional)
    <automated>grep -c 'md:hidden fixed top-0 left-0 right-0' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx</automated>
    Expected: 1
    <automated>grep -c 'bg-black/40' /mnt/c/Users/dajcs/code/transcendence/frontend/src/components/nav/Sidebar.tsx</automated>
    Expected: 1
  </verify>
  <done>
    Sidebar.tsx has: `mobileOpen` state, mobile-only top bar (md:hidden fixed strip), backdrop overlay (bg-black/40), aside with -translate-x-full/md:translate-x-0 conditional, and onClick on all Link elements.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Compensate layout.tsx main padding for mobile top bar</name>
  <files>frontend/src/app/layout.tsx</files>
  <read_first>
    - frontend/src/app/layout.tsx — read the full file before editing (need lines 40–50 for the main element)
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — section on layout.tsx (mobile top bar height compensation)
  </read_first>
  <action>
    The mobile top bar added to Sidebar.tsx is 48px tall (h-12). On mobile, authenticated pages need top padding to clear this bar. The main element in layout.tsx currently uses `py-8` (32px top). Change it so mobile gets `pt-14` (56px, clearing the 48px bar with a small gap) and desktop keeps `pt-8`.

    Find the `<main>` element (currently: `<main className="max-w-4xl mx-auto px-4 py-8">`).

    Change it to:
    ```tsx
    <main className="max-w-4xl mx-auto px-4 pt-14 pb-8 md:pt-8">
    ```

    This adds:
    - `pt-14` (56px top) on mobile — clears the 48px top bar
    - `pb-8` (32px bottom) on all viewports
    - `md:pt-8` overrides back to 32px on desktop (where there's no top bar)

    Do NOT change any other element in layout.tsx. Leave the `py-8` on public (unauthenticated) wrapper if one exists separately; only modify the single `<main>` element.
  </action>
  <verify>
    <automated>grep -c 'pt-14 pb-8 md:pt-8' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/layout.tsx</automated>
    Expected: 1
    <automated>grep -c 'max-w-4xl.*py-8\|py-8.*max-w-4xl' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/layout.tsx</automated>
    Expected: 0 (the main element's unconditional py-8 is replaced; no other max-w-4xl element uses bare py-8)
  </verify>
  <done>
    layout.tsx main element uses `pt-14 pb-8 md:pt-8` — mobile pages clear the mobile top bar, desktop retains original padding.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User→Mobile UI | User interacts with the mobile drawer via tap events |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-01 | Spoofing | Backdrop overlay z-index | accept | Backdrop uses z-[98], aside uses z-[100], mobile top bar uses z-[99]. Stacking order is correct; no spoofing vector. |
| T-08-02 | Denial of Service | Hamburger toggle state | accept | State is purely client-local (useState). No API calls, no persistence, no server interaction. Cannot be exploited remotely. |

Note: Public API (STRETCH-01) is deferred — CORS, rate-limit, and info-disclosure threats listed in planning_context are out of scope for this plan.
</threat_model>

<verification>
After executing all tasks:

1. `grep -c 'md:ml-\[220px\]' frontend/src/components/AppShell.tsx` → 1
2. `grep -v 'md:' frontend/src/components/AppShell.tsx | grep -c 'ml-\[220px\]'` → 0
3. `grep -c '\-translate-x-full md:translate-x-0' frontend/src/components/nav/Sidebar.tsx` → 1
4. `grep -c 'md:hidden fixed top-0 left-0 right-0' frontend/src/components/nav/Sidebar.tsx` → 1
5. `grep -c 'pt-14 pb-8 md:pt-8' frontend/src/app/layout.tsx` → 1
6. TypeScript compile: `cd frontend && npx tsc --noEmit` must produce no errors for modified files.
</verification>

<success_criteria>
- AppShell.tsx: `md:ml-[220px]` (not bare `ml-[220px]`)
- Sidebar.tsx: mobile top bar strip, hamburger button, backdrop overlay, translate classes on aside, onClick on all Links
- layout.tsx: `pt-14 pb-8 md:pt-8` on main element
- No TypeScript compile errors
- On mobile viewports, authenticated pages are full-width (no 220px margin)
- The sidebar slides in from the left on hamburger tap
</success_criteria>

<output>
After completion, create `.planning/phases/08-stretch-modules/08-P01-SUMMARY.md` following the summary template.
</output>
