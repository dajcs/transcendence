---
phase: 08-stretch-modules
plan: P02
type: execute
wave: 2
depends_on: ["P01"]
files_modified:
  - frontend/src/app/(protected)/markets/page.tsx
  - frontend/src/app/(protected)/markets/[id]/page.tsx
  - frontend/src/app/(auth)/login/page.tsx
  - frontend/src/app/(auth)/register/page.tsx
  - frontend/src/app/(auth)/reset-password/page.tsx
  - frontend/src/app/(protected)/chat/[userId]/page.tsx
autonomous: true
requirements:
  - STRETCH-02  # out of scope per CONTEXT.md — advanced search not implemented; coverage acknowledgment only

must_haves:
  truths:
    - "The markets list page renders correctly on 360px viewport (no horizontal overflow)"
    - "The markets list fixed grid columns are replaced with responsive Tailwind classes"
    - "The SVG histogram charts in market detail do not cause horizontal overflow on mobile"
    - "The chat thread height calculation accounts for the mobile top bar height"
    - "Auth pages do not waste excessive space on mobile when the top bar is present"
    - "No page has a bare inline style gridTemplateColumns"
  artifacts:
    - path: "frontend/src/app/(protected)/markets/page.tsx"
      provides: "Responsive market grid with mobile column hiding"
      contains: "grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]"
    - path: "frontend/src/app/(protected)/markets/[id]/page.tsx"
      provides: "SVG histograms wrapped in overflow-x-auto"
      contains: "overflow-x-auto"
    - path: "frontend/src/app/(protected)/chat/[userId]/page.tsx"
      provides: "Chat thread height adjusted for mobile top bar"
      contains: "calc(100vh-14rem) md:h-[calc(100vh-12rem)]"
    - path: "frontend/src/app/(auth)/login/page.tsx"
      provides: "Reduced top padding on mobile"
      contains: "pt-4 md:pt-12"
  key_links:
    - from: "frontend/src/app/(protected)/markets/page.tsx"
      to: "market row grid"
      via: "Tailwind responsive grid classes replacing inline style"
      pattern: "grid-cols-\\[1fr_84px\\]"
    - from: "frontend/src/app/(protected)/markets/[id]/page.tsx"
      to: "SVG histogram"
      via: "overflow-x-auto wrapper div"
      pattern: "overflow-x-auto"
---

<objective>
Fix page-level responsive issues across the six files that need concrete changes. The other 9 pages (halloffame, settings, friends, chat/list, profile, privacy, terms, landing, new-market) are already substantially responsive; this plan includes a grep-based audit pass to confirm no hidden fixed-width overflows exist.

Purpose: After Plan 01 unblocks the layout shell, these page-level fixes complete the RWD deliverable.

Output: Responsive markets list grid, overflow-safe SVG charts, mobile-adjusted chat height, reduced auth page top padding on mobile.

NOTE — STRETCH-02 (advanced search) is out of scope for Phase 8 per CONTEXT.md. Acknowledged in frontmatter for requirement coverage tracking only.
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
<!-- Key patterns from PATTERNS.md. Executor does not need to explore the codebase beyond the read_first files. -->

From markets/page.tsx (lines 254–258 and 503–507) — BEFORE:
```tsx
<div
  className="grid gap-x-3 px-3 py-2.5 items-center cursor-pointer ..."
  style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}
>
```

markets/page.tsx — AFTER (both occurrences):
```tsx
<div className="grid gap-x-3 px-3 py-2.5 items-center cursor-pointer ... grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]">
  {/* Remove the style={{ gridTemplateColumns }} prop entirely */}
```

Columns to hide on mobile (in market row and header row):
- Activity/stats column (col 2 — 110px): add `hidden sm:flex` to its container
- Time clock column (col 4 — 44px): add `hidden sm:flex` to its container

From markets/[id]/page.tsx (lines 582–613 and 1008–1044) — BEFORE:
```tsx
const W = 320, H = 60, pad = 4;
<svg width={W} height={H + 16} className="overflow-visible">
```

markets/[id]/page.tsx — AFTER (both SVG blocks):
```tsx
<div className="overflow-x-auto">
  <svg width={W} height={H + 16} className="overflow-visible">
    {/* ... existing SVG content unchanged ... */}
  </svg>
</div>
```

From markets/[id]/page.tsx (line 1293) — comment depth cap:
```tsx
// BEFORE:
style={{ marginLeft: `${depth * 20}px` }}
// AFTER:
style={{ marginLeft: `${Math.min(depth, 3) * 20}px` }}
```

From chat/[userId]/page.tsx (line 68) — BEFORE:
```tsx
<div className="flex flex-col h-[calc(100vh-12rem)]">
```
AFTER:
```tsx
<div className="flex flex-col h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]">
```

Auth pages (login/page.tsx, register/page.tsx, reset-password/page.tsx) — BEFORE:
```tsx
<div className="flex flex-col items-center gap-6 pt-12">
```
AFTER:
```tsx
<div className="flex flex-col items-center gap-6 pt-4 md:pt-12">
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix markets list grid — replace inline style with responsive Tailwind classes</name>
  <files>frontend/src/app/(protected)/markets/page.tsx</files>
  <read_first>
    - frontend/src/app/(protected)/markets/page.tsx — read the full file; focus on lines 250–270 (market row div) and 495–520 (column header row div) and the children of each for column elements
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — section "Group D: Markets List — Critical Fixed Grid"
  </read_first>
  <action>
    There are exactly two occurrences of `style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}` in this file (lines 257 and 504). Apply the following changes to both:

    **Change 1: Remove inline gridTemplateColumns style, add responsive Tailwind grid classes.**

    Find each occurrence of the div with `style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}` and:
    1. Remove the `style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}` prop
    2. Add `grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]` to the `className` string of that same div

    The resulting className for each such div should include all existing classes PLUS `grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]` and must NOT include a `style` prop with gridTemplateColumns.

    **Change 2: Hide the 110px activity/stats column (col 2) on mobile.**

    In the market row children (under the first occurrence's div), find the element that renders the activity stats — it is the second grid child column (the 110px slot). Add `hidden sm:flex` to its className. Look for a `<div>` or `<span>` that contains bet count or participant numbers.

    In the column header row (under the second occurrence's div), find the header cell for that same column and add `hidden sm:flex` to its className.

    **Change 3: Hide the 44px time clock column (col 4) on mobile.**

    In the market row, find the element that renders the time remaining (the 44px slot, 4th column). Add `hidden sm:flex` to its className.

    In the column header row, find the header cell for the 44px column and add `hidden sm:flex` to its className.

    Do NOT touch any other elements, filtering logic, search bars, sort pills, pagination, or market cards.
  </action>
  <verify>
    <automated>grep -c 'gridTemplateColumns:' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/markets/page.tsx</automated>
    Expected: 0
    <automated>grep -c 'grid-cols-\[1fr_84px\] sm:grid-cols-\[1fr_110px_84px_44px\]' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/markets/page.tsx</automated>
    Expected: 2
    <automated>grep -c 'hidden sm:flex' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/markets/page.tsx</automated>
    Expected: >= 4 (2 columns x 2 rows: market row + header row)
  </verify>
  <done>
    markets/page.tsx has zero `gridTemplateColumns:` occurrences and two `grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]` occurrences. At least 4 elements have `hidden sm:flex`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Fix market detail SVG overflow, comment depth, and minor page fixes</name>
  <files>
    frontend/src/app/(protected)/markets/[id]/page.tsx
    frontend/src/app/(protected)/chat/[userId]/page.tsx
    frontend/src/app/(auth)/login/page.tsx
    frontend/src/app/(auth)/register/page.tsx
    frontend/src/app/(auth)/reset-password/page.tsx
  </files>
  <read_first>
    - frontend/src/app/(protected)/markets/[id]/page.tsx — read lines 575–620 and 1005–1050 (SVG blocks) and line 1293 (comment depth)
    - frontend/src/app/(protected)/chat/[userId]/page.tsx — read lines 60–80 (chat height calc)
    - frontend/src/app/(auth)/login/page.tsx — read lines 9–20 (outer div with pt-12)
    - frontend/src/app/(auth)/register/page.tsx — read lines 9–20 (outer div with pt-12)
    - frontend/src/app/(auth)/reset-password/page.tsx — read lines 9–20 (outer div with pt-12)
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — sections "Group E: Market Detail", "Group G: Chat Pages", "Group B: Auth Pages"
  </read_first>
  <action>
    Apply these targeted changes across the listed files:

    **markets/[id]/page.tsx — SVG histogram wrapping (2 occurrences):**

    Locate the two SVG histogram blocks (around lines 589 and 1021). Each has `<svg width={W} height={H + 16} className="overflow-visible">`. Wrap each `<svg ...>` element in:
    ```tsx
    <div className="overflow-x-auto">
      <svg width={W} height={H + 16} className="overflow-visible">
        {/* existing SVG content unchanged */}
      </svg>
    </div>
    ```
    The `const W = 320, H = 60, pad = 4;` declarations and all JSX inside the `<svg>` elements remain unchanged.

    **markets/[id]/page.tsx — Comment depth cap (1 occurrence):**

    Find line ~1293: `style={{ marginLeft: `${depth * 20}px` }}`.
    Change to: `style={{ marginLeft: `${Math.min(depth, 3) * 20}px` }}`.
    This caps the left indent at 60px (3 levels × 20px) on mobile.

    **chat/[userId]/page.tsx — Viewport height calculation (1 occurrence):**

    Find line ~68: `<div className="flex flex-col h-[calc(100vh-12rem)]">`.
    Change to: `<div className="flex flex-col h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]">`.
    The extra 2rem (32px) on mobile accounts for the new mobile top bar from Sidebar.tsx.

    **login/page.tsx — Reduce top padding on mobile (1 occurrence):**

    Find the outermost `<div className="flex flex-col items-center gap-6 pt-12">` and change `pt-12` to `pt-4 md:pt-12`.

    **register/page.tsx — Reduce top padding on mobile (1 occurrence):**

    Same change: find `pt-12` in the outermost flex div and change to `pt-4 md:pt-12`.

    **reset-password/page.tsx — Reduce top padding on mobile (1 occurrence):**

    Same change: find `pt-12` in the outermost flex div and change to `pt-4 md:pt-12`.

    Do NOT change any other elements. Do not modify form components, API calls, state, translations, or any other logic.
  </action>
  <verify>
    <automated>grep -c 'overflow-x-auto' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/markets/\[id\]/page.tsx</automated>
    Expected: >= 2 (one per SVG histogram)
    <automated>grep -c 'Math.min(depth, 3)' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/markets/\[id\]/page.tsx</automated>
    Expected: 1
    <automated>grep -c 'calc(100vh-14rem)' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(protected\)/chat/\[userId\]/page.tsx</automated>
    Expected: 1
    <automated>grep -c 'pt-4 md:pt-12' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(auth\)/login/page.tsx</automated>
    Expected: 1
    <automated>grep -c 'pt-4 md:pt-12' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(auth\)/register/page.tsx</automated>
    Expected: 1
    <automated>grep -c 'pt-4 md:pt-12' /mnt/c/Users/dajcs/code/transcendence/frontend/src/app/\(auth\)/reset-password/page.tsx</automated>
    Expected: 1
  </verify>
  <done>
    - markets/[id]/page.tsx: 2+ overflow-x-auto wrappers on SVG histograms; Math.min(depth, 3) for comment indent
    - chat/[userId]/page.tsx: h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)]
    - login, register, reset-password: pt-4 md:pt-12 on outer container
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Audit the 9 already-responsive pages for hidden overflow issues</name>
  <files>
    frontend/src/app/(protected)/friends/page.tsx
    frontend/src/app/(protected)/hall-of-fame/page.tsx
    frontend/src/app/(protected)/settings/page.tsx
    frontend/src/app/(protected)/profile/[username]/page.tsx
    frontend/src/app/(protected)/markets/new/page.tsx
    frontend/src/app/(protected)/chat/page.tsx
    frontend/src/app/page.tsx
    frontend/src/app/privacy/page.tsx
    frontend/src/app/terms/page.tsx
  </files>
  <read_first>
    - .planning/phases/08-stretch-modules/08-PATTERNS.md — sections F, G (chat list), H, I, J, K, and C for the pattern expectations per page
  </read_first>
  <action>
    Run the following grep commands to detect remaining responsive issues in the 9 already-mostly-responsive pages. For each finding, apply the minimal fix described:

    **Step 1 — Detect bare fixed-width inline styles (non-max-width):**
    ```bash
    grep -n "style={{" frontend/src/app/(protected)/friends/page.tsx \
      frontend/src/app/(protected)/hall-of-fame/page.tsx \
      frontend/src/app/(protected)/settings/page.tsx \
      frontend/src/app/(protected)/profile/\[username\]/page.tsx \
      frontend/src/app/(protected)/markets/new/page.tsx \
      frontend/src/app/(protected)/chat/page.tsx \
      frontend/src/app/page.tsx \
      frontend/src/app/privacy/page.tsx \
      frontend/src/app/terms/page.tsx
    ```

    For any `style={{ width: "Npx" }}` or `style={{ minWidth: "Npx" }}` findings on container elements (not avatars or icons — those are intentional), replace with equivalent Tailwind classes (e.g., `w-[Npx]` or `min-w-[Npx]`). Avatar fixed sizes (24px–48px) are intentional — leave those.

    **Step 2 — Detect tables without overflow-x-auto wrappers:**
    ```bash
    grep -n "<table" frontend/src/app/(protected)/friends/page.tsx \
      frontend/src/app/(protected)/hall-of-fame/page.tsx \
      frontend/src/app/(protected)/settings/page.tsx \
      frontend/src/app/(protected)/profile/\[username\]/page.tsx \
      frontend/src/app/(protected)/markets/new/page.tsx
    ```

    For any `<table>` found, check if the immediate parent `<div>` has `overflow-x-auto`. If missing, add a wrapping `<div className="overflow-x-auto">` around the `<table>`.

    Expected findings from PATTERNS.md:
    - hall-of-fame already has `overflow-x-auto` (line 100) — no change needed
    - profile already has `overflow-x-auto` on all tables (lines 363, 455, 490, 540) — no change needed
    - settings uses `max-w-md` with no tables — no change needed
    - friends has no fixed-width columns beyond avatar — no change needed
    - new market uses `w-full` inputs — no change needed

    **Step 3 — Verify terms/page.tsx has prose + overflow-x-auto on tables:**
    ```bash
    grep -n "overflow-x-auto\|prose" frontend/src/app/terms/page.tsx
    ```

    If `overflow-x-auto` is missing from the terms page (unlike privacy which PATTERNS.md confirms has it), add it around any markdown table containers.

    **Report findings:** After running all greps, document in a comment at the top of the summary:
    - Which files needed changes (if any)
    - Which files were confirmed responsive with no changes needed

    If NO changes are needed in any of the 9 files (all patterns already correct), this task is complete with no file edits required — that is a valid and expected outcome.
  </action>
  <verify>
    <automated>grep -rn 'style={{' frontend/src/app/\(protected\)/friends/page.tsx frontend/src/app/\(protected\)/hall-of-fame/page.tsx frontend/src/app/\(protected\)/settings/page.tsx frontend/src/app/\(protected\)/markets/new/page.tsx frontend/src/app/\(protected\)/chat/page.tsx frontend/src/app/page.tsx frontend/src/app/privacy/page.tsx frontend/src/app/terms/page.tsx | grep -v 'marginLeft\|avatar\|icon\|width.*[0-9][0-9]px.*avatar'</automated>
    Expected: any remaining inline styles should be for intentional icon/avatar sizes only; no layout-breaking fixed widths
    <automated>grep -c 'overflow-x-auto' frontend/src/app/terms/page.tsx</automated>
    Expected: >= 1 (either already present or added in this task)
  </verify>
  <done>
    All 9 audit pages verified: tables have overflow-x-auto wrappers, no layout-breaking inline style={{ width }} on containers. Findings documented in summary.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User→Browser | All changes are frontend-only, client-side CSS/layout |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-03 | Information Disclosure | markets/page.tsx hidden columns | accept | Columns hidden via `hidden sm:flex` are still in the DOM. This is fine — they contain non-sensitive market metadata (activity counts, time). No PII involved. |
| T-08-04 | Tampering | Comment depth cap | accept | `Math.min(depth, 3)` is a display-only change. The backend still enforces the 8-level depth limit per DISC-03. |

Note: STRETCH-02 (advanced search) is out of scope per CONTEXT.md — no search API surface to assess.
</threat_model>

<verification>
After executing all tasks:

1. `grep -c 'gridTemplateColumns:' frontend/src/app/\(protected\)/markets/page.tsx` → 0
2. `grep -c 'grid-cols-\[1fr_84px\] sm:grid-cols-\[1fr_110px_84px_44px\]' frontend/src/app/\(protected\)/markets/page.tsx` → 2
3. `grep -c 'overflow-x-auto' frontend/src/app/\(protected\)/markets/\[id\]/page.tsx` → 2 (SVG wrappers)
4. `grep -c 'Math.min(depth, 3)' frontend/src/app/\(protected\)/markets/\[id\]/page.tsx` → 1
5. `grep -c 'calc(100vh-14rem)' frontend/src/app/\(protected\)/chat/\[userId\]/page.tsx` → 1
6. `grep -c 'pt-4 md:pt-12' frontend/src/app/\(auth\)/login/page.tsx` → 1
7. TypeScript compile: `cd frontend && npx tsc --noEmit` — no errors on modified files
</verification>

<success_criteria>
- markets/page.tsx: zero inline gridTemplateColumns, responsive Tailwind grid in place, activity and clock columns hidden on mobile
- markets/[id]/page.tsx: both SVG histograms wrapped in overflow-x-auto, comment depth capped at 3×20px
- chat/[userId]/page.tsx: chat container height uses 14rem on mobile, 12rem on desktop
- login/register/reset-password: pt-4 md:pt-12 on outer container
- 9 audit pages: confirmed responsive or minimal fixes applied
</success_criteria>

<output>
After completion, create `.planning/phases/08-stretch-modules/08-P02-SUMMARY.md` following the summary template.
</output>
