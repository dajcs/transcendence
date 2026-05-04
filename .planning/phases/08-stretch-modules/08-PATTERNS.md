# Phase 8: Stretch Modules - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 17 (15 pages + Sidebar + AppShell)
**Analogs found:** 17 / 17

---

## IMPORTANT CORRECTION: CONTEXT.md Nav Reference Is Stale

CONTEXT.md lists `frontend/src/components/nav/TopNav.tsx` as the nav component needing mobile treatment. This is **incorrect as of the current codebase**.

`frontend/src/app/layout.tsx` (lines 4–5, 43–44) mounts `Sidebar` and `AppShell`, not `TopNav`. TopNav is **not rendered anywhere** — only referenced in its own test file. The actual nav components to modify are:

- `frontend/src/components/nav/Sidebar.tsx` — fixed `w-[220px]` left aside (must become collapsible on mobile)
- `frontend/src/components/AppShell.tsx` — hardcodes `ml-[220px]` for authenticated users (must become `md:ml-[220px]`)

TopNav does contain the best in-codebase hamburger menu pattern (lines 69, 142–154, 159–209) and serves as a code reference for the mobile drawer pattern — but it must not be the target of edits.

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `frontend/src/components/nav/Sidebar.tsx` | component (nav) | event-driven | `frontend/src/components/nav/TopNav.tsx` | role-match (TopNav has the hamburger pattern) |
| `frontend/src/components/AppShell.tsx` | component (layout) | request-response | self (1-liner) | exact |
| `frontend/src/app/layout.tsx` | layout | request-response | self | exact |
| `frontend/src/app/page.tsx` | page (landing) | request-response | `frontend/src/app/(auth)/login/page.tsx` | exact |
| `frontend/src/app/(auth)/login/page.tsx` | page (auth form) | request-response | `frontend/src/app/(auth)/register/page.tsx` | exact |
| `frontend/src/app/(auth)/register/page.tsx` | page (auth form) | request-response | `frontend/src/app/(auth)/login/page.tsx` | exact |
| `frontend/src/app/(auth)/reset-password/page.tsx` | page (auth form) | request-response | `frontend/src/app/(auth)/login/page.tsx` | role-match |
| `frontend/src/app/(protected)/markets/page.tsx` | page (data table) | CRUD | self (grid pattern) | exact |
| `frontend/src/app/(protected)/markets/[id]/page.tsx` | page (detail) | CRUD + event-driven | `frontend/src/app/(protected)/hall-of-fame/page.tsx` | role-match |
| `frontend/src/app/(protected)/markets/new/page.tsx` | page (form) | CRUD | `frontend/src/app/(protected)/settings/page.tsx` | role-match |
| `frontend/src/app/(protected)/friends/page.tsx` | page (list + form) | CRUD + event-driven | `frontend/src/app/(protected)/hall-of-fame/page.tsx` | role-match |
| `frontend/src/app/(protected)/chat/page.tsx` | page (list) | request-response | `frontend/src/app/(protected)/hall-of-fame/page.tsx` | role-match |
| `frontend/src/app/(protected)/chat/[userId]/page.tsx` | page (chat thread) | event-driven | self (flex-col layout) | exact |
| `frontend/src/app/(protected)/profile/[username]/page.tsx` | page (detail + form) | CRUD | self (already has `sm:` classes) | exact |
| `frontend/src/app/(protected)/hall-of-fame/page.tsx` | page (data table) | request-response | self (has `overflow-x-auto`) | exact |
| `frontend/src/app/(protected)/settings/page.tsx` | page (form) | CRUD | self (has `max-w-md`) | exact |
| `frontend/src/app/privacy/page.tsx` | page (content) | request-response | `frontend/src/app/terms/page.tsx` | exact |

---

## Pattern Assignments

### Group A: Navigation Shell — Sidebar.tsx + AppShell.tsx (highest priority)

The Sidebar is a fixed `w-[220px]` element. On viewports narrower than 220px + content, it covers the page. AppShell offsets content with a hardcoded `ml-[220px]` that must become breakpoint-conditional.

**Primary analog for hamburger pattern:** `frontend/src/components/nav/TopNav.tsx` (lines 69, 142–154, 159–209)
Even though TopNav is not rendered, it implements the exact mobile-toggle pattern needed for Sidebar.

---

#### `frontend/src/components/AppShell.tsx`

**Current code (entire file — 12 lines):**
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

**Required change:** `ml-[220px]` → `md:ml-[220px]` (one class change). On mobile, authenticated content should not be offset since the sidebar will be hidden by default.

---

#### `frontend/src/components/nav/Sidebar.tsx`

**Current structure (line 100):**
```tsx
<aside className="fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r ...">
```

The sidebar is always visible as a fixed 220px strip. On mobile it must:
1. Default to hidden (translate off-screen or `hidden`)
2. Reveal via hamburger toggle state

**Hamburger toggle pattern — adapts from TopNav.tsx (lines 69, 142–155, 159–209):**

```tsx
// State (line 69 of TopNav.tsx):
const [mobileOpen, setMobileOpen] = useState(false);

// Hamburger button — mobile only (lines 142–154 of TopNav.tsx):
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

// Mobile drawer panel (lines 159–209 of TopNav.tsx):
{mobileOpen && (
  <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-3">
    {/* nav links with onClick={() => setMobileOpen(false)} */}
  </div>
)}
```

**Adapted pattern for Sidebar (aside element):**
```tsx
// aside becomes: hidden on mobile, visible on md+
<aside className={`fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r ... transition-transform duration-200 ${
  mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
}`}>

// Hamburger trigger must live outside the aside — add to AppShell or layout.tsx
// Or use a thin "always-visible" mobile top bar at the top of the aside that doesn't slide away
```

**Recommended approach:** Add a `<div className="md:hidden fixed top-0 left-0 right-0 z-[99] ...">` mobile top bar that contains the logo + hamburger trigger. This bar is always visible. The aside slides in on hamburger tap. Use a backdrop overlay to close it on outside click.

**Close on link navigation:** All nav `<Link>` elements in Sidebar should call `onClick={() => setMobileOpen(false)}` — same pattern as TopNav.tsx lines 174–206.

---

#### `frontend/src/app/layout.tsx`

**Current main content wrapper (line 45):**
```tsx
<main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
```

On mobile (no sidebar offset), `max-w-4xl` with `px-4` is fine. The `py-8` top padding may need to increase on mobile to clear the mobile top bar. Suggested: `py-8 md:py-8` or add mobile top bar height as padding-top.

---

### Group B: Auth Pages — Already Mostly Responsive

**Files:** `login/page.tsx`, `register/page.tsx`, `reset-password/page.tsx`

These pages use `flex flex-col items-center gap-6 pt-12` — single-column centered layout that works on any width.

**Analog (login/page.tsx lines 9–31):**
```tsx
<div className="flex flex-col items-center gap-6 pt-12">
  <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
  {/* forms are single-column components */}
</div>
```

**Potential mobile issue:** The auth form components (`LoginForm`, `RegisterForm`, `ResetForm`) need to be checked for fixed-width inputs. Quick verification target:
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/RegisterForm.tsx`

Pattern to fix if found: replace `w-[Npx]` with `w-full max-w-[Npx]` or just `w-full`.

**Note:** `pt-12` on mobile means 48px from top — when there is a mobile top bar (~48–56px), this should become `pt-4 md:pt-12` to avoid double spacing.

---

### Group C: Landing + Static Pages — Minimal Work

**Files:** `app/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`

Landing page (page.tsx, lines 8–29) already uses responsive flex layout:
```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
  <div className="flex gap-4">   {/* buttons — wraps naturally */}
```

Privacy page (privacy/page.tsx, line 13) uses Tailwind prose:
```tsx
<article className="prose prose-sm max-w-3xl mx-auto dark:prose-invert">
```

Both are inherently responsive. The main concern is the `prose` tables inside privacy/terms pages already use `overflow-x-auto` wrappers (privacy/page.tsx line 45).

**No significant changes needed.** Verify `terms/page.tsx` uses the same prose + overflow-x-auto pattern.

---

### Group D: Markets List — Critical Fixed Grid

**File:** `frontend/src/app/(protected)/markets/page.tsx`

**Critical non-responsive pattern (lines 254–258, 503–507):**
```tsx
<div
  className="grid gap-x-3 px-3 py-2.5 items-center cursor-pointer ..."
  style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}
>
```

This inline style uses fixed pixel columns (110px + 84px + 44px = 238px minimum for the non-title columns). On a 360px viewport with no sidebar offset, `1fr` gets only 122px — survivable but tight. With the sidebar still present on desktop, this is fine. On mobile the sidebar will be hidden, so the full viewport width is available.

**Column budget on 360px mobile:**
- Total: 360px - 24px padding (px-3 both sides) = 336px
- Fixed cols: 110 + 84 + 44 = 238px
- `1fr` gets: 98px — too narrow for title + avatar

**Required fix:** On mobile, hide the less-critical columns using responsive display:
```tsx
{/* Col 2: activity numbers — hide on mobile */}
<div className="hidden sm:flex text-right flex-col items-end gap-0.5">

{/* Col 4: time clock — hide on mobile */}
<div className="hidden sm:flex justify-center">
```

And the inline grid style should become responsive. Since Tailwind 4 can't conditionally apply `style={}` props, use a `className` grid instead:

```tsx
{/* Mobile: title + outcome only. Desktop: full 4 columns */}
className="grid gap-x-3 px-3 py-2.5 items-center cursor-pointer grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]"
{/* Remove the style={{ gridTemplateColumns }} prop */}
```

**Column headers div (line 503–507):** Apply the same responsive grid — or hide the header entirely on mobile if columns are hidden.

**Search + create row (lines 426–450):**
```tsx
<div className="flex items-center gap-3 mb-3">
  <div className="relative flex-1 max-w-[480px]">
  <Link href="/markets/new" ...>+ {t("markets.create")}</Link>
```
This is fine — flex already wraps on narrow viewports.

**Sort + filter pills (lines 464–499):** Already uses `flex-wrap` — works on mobile.

---

### Group E: Market Detail — Mostly Fine, One Fix

**File:** `frontend/src/app/(protected)/markets/[id]/page.tsx`

Market detail sections use `space-y-3` stacking (line 505) with `rounded-[10px] ... p-4` cards — naturally single-column and mobile-friendly.

**Already responsive patterns found:**
- `flex flex-wrap gap-2` on option buttons (lines 796, 935, 1088, 1193)
- `flex items-center gap-3 flex-wrap` on confirm buttons (line 725)
- `flex gap-4 text-sm flex-wrap` on vote displays (line 1053)

**Participants table (lines 655–688):**
```tsx
<div className="overflow-auto max-h-64 rounded-[8px] border ...">
  <table className="w-full">
```
Uses `overflow-auto` — scrolls horizontally on narrow viewports. Acceptable.

**Comment indentation (line 1293):**
```tsx
style={{ marginLeft: `${depth * 20}px` }}
```
At depth 7 (max), this is 140px. On a 360px viewport, deeply nested comments get ~220px of content width. Acceptable — consider capping: `Math.min(depth, 3) * 20` for mobile.

**SVG histogram (line 582, W=320):**
```tsx
const W = 320, H = 60, pad = 4;
<svg width={W} height={H + 16} className="overflow-visible">
```
Hard-coded 320px SVG. On narrower viewports, this overflows. Wrap in `overflow-x-auto` or use `viewBox` with `width="100%"`.

---

### Group F: Friends Page — Mostly Fine

**File:** `frontend/src/app/(protected)/friends/page.tsx`

**Already responsive:**
- Filter tabs use `flex items-center gap-1.5 mb-3 flex-wrap` (line 205)
- Avatar + text rows use flex patterns

**Potential issue:** The friend search result rows and friend list items are flex rows — check that they don't have fixed-width columns. From the grep, only avatar (26px) has a fixed width, which is fine.

---

### Group G: Chat Pages — Fine with One Viewport Fix

**File:** `frontend/src/app/(protected)/chat/[userId]/page.tsx`

**Chat thread height (line 68):**
```tsx
<div className="flex flex-col h-[calc(100vh-12rem)]">
```

`12rem = 192px`. On desktop this accounts for the page header area. On mobile with a top nav bar (~56px) + AppShell padding, this calculation may be off. If the mobile top bar is added, this becomes `h-[calc(100vh-14rem)]` on mobile or use CSS custom properties.

**Message bubbles (line 113):**
```tsx
<div className={`max-w-[70%] rounded-lg px-3 py-2 ...`}>
```
`max-w-[70%]` is viewport-relative — works on any width.

**Chat list (chat/page.tsx):** Simple flex rows, inherently responsive.

---

### Group H: Profile Page — Already Partially Responsive

**File:** `frontend/src/app/(protected)/profile/[username]/page.tsx`

This page already has the most responsive classes of any page in the codebase:

**Existing responsive patterns (lines 275, 280, 312):**
```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
<input className="... sm:max-w-md" />
<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
```

**Data tables (lines 363, 455, 490, 540):**
```tsx
<div className="overflow-x-auto">
  <table className="...">
```
All tables already have `overflow-x-auto` wrappers — correct pattern.

**Minor fix:** `max-w-[180px]` and `max-w-[220px]` truncated cells (lines 399, 468, 503, 553) are fine — truncation prevents overflow.

---

### Group I: Hall of Fame — Already Has overflow-x-auto

**File:** `frontend/src/app/(protected)/hall-of-fame/page.tsx`

**Correct existing pattern (line 100):**
```tsx
<div className="overflow-x-auto">
  <table className="min-w-full">
```

Tab filter uses `flex-wrap`. No changes needed.

---

### Group J: Settings Page — Already Responsive

**File:** `frontend/src/app/(protected)/settings/page.tsx`

**Correct existing pattern (line 90):**
```tsx
<div className="max-w-md space-y-6">
```

`max-w-md` (448px) on a 360px viewport fills full width minus padding — correct. Sections use `rounded border ... p-4 space-y-4`. GDPR buttons use `flex flex-wrap gap-3` (line 223). No changes needed.

---

### Group K: New Market Form

**File:** `frontend/src/app/(protected)/markets/new/page.tsx`

Uses `flex flex-wrap gap-2` for multi-choice buttons (line 170). Form inputs use `w-full` pattern. No significant responsive issues expected — verify with quick scroll of the rest of the file (not read here beyond line 80).

**Safe assumption:** Follow `settings/page.tsx` pattern — wrap in `max-w-*` container with `space-y-*` sections.

---

## Shared Patterns

### Mobile Sidebar Trigger Placement

The hamburger button must be visible when the sidebar is off-screen. Two viable placements:

**Option A (recommended): Thin mobile-only top strip inside Sidebar**
Add a `<div className="md:hidden fixed top-0 left-0 right-0 z-[99] flex items-center px-4 h-12 ...">` that contains logo + hamburger. This div is always rendered regardless of sidebar state.

**Option B: Move trigger to AppShell or layout.tsx**
Add a floating hamburger button anchored top-left, visible only on mobile (`md:hidden`). Simpler but less polished.

### Breakpoint-conditional margin offset
**Source:** `frontend/src/components/AppShell.tsx` (line 8)
**Apply to:** AppShell only

```tsx
// Current:
<div className={isAuthenticated ? "ml-[220px]" : ""}>
// After:
<div className={isAuthenticated ? "md:ml-[220px]" : ""}>
```

### Sidebar show/hide on mobile
**Source pattern:** `frontend/src/components/nav/TopNav.tsx` (lines 69, 142–154, 159–209)
**Apply to:** `Sidebar.tsx`

Core toggle state:
```tsx
const [mobileOpen, setMobileOpen] = useState(false);
```

Aside visibility with translate:
```tsx
// On aside className:
`... transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`
```

Backdrop overlay (close on outside click):
```tsx
{mobileOpen && (
  <div
    className="md:hidden fixed inset-0 z-[98] bg-black/40"
    onClick={() => setMobileOpen(false)}
    aria-hidden
  />
)}
```

All nav `<Link>` elements in Sidebar add `onClick={() => setMobileOpen(false)}` to auto-close.

### Responsive grid pattern for markets list
**Source:** `frontend/src/app/(protected)/markets/page.tsx` (lines 257, 504)
**Apply to:** `MarketRow` and column headers in markets/page.tsx

Replace inline `style={{ gridTemplateColumns: "1fr 110px 84px 44px" }}` with responsive Tailwind class:
```tsx
className="grid gap-x-3 px-3 py-2.5 items-center grid-cols-[1fr_84px] sm:grid-cols-[1fr_110px_84px_44px]"
```

Hide dropped columns on mobile:
```tsx
// Activity column (col 2): className="hidden sm:flex ..."
// Time clock (col 4): className="hidden sm:flex ..."
```

### overflow-x-auto for data tables
**Source:** `frontend/src/app/(protected)/hall-of-fame/page.tsx` (line 100), `profile/[username]/page.tsx` (line 363)
**Apply to:** Any `<table>` that isn't already wrapped

```tsx
<div className="overflow-x-auto">
  <table className="min-w-full ...">
```

### SVG charts — make fluid
**Source:** `frontend/src/app/(protected)/markets/[id]/page.tsx` (line 589)
**Apply to:** Both SVG histogram blocks in market detail (lines 582–613 and 1020–1044)

```tsx
// Current:
<svg width={W} height={H + 16} className="overflow-visible">
// After: wrap in overflow-x-auto div, or use viewBox + width="100%"
<div className="overflow-x-auto">
  <svg width={W} height={H + 16} className="overflow-visible">
  {/* ... */}
  </svg>
</div>
```

### Auth page top padding reduction on mobile
**Source:** `frontend/src/app/(auth)/login/page.tsx` (line 12)
**Apply to:** login, register, reset-password pages

```tsx
// Current:
<div className="flex flex-col items-center gap-6 pt-12">
// After (if mobile top bar ~48px is added):
<div className="flex flex-col items-center gap-6 pt-4 md:pt-12">
```

---

## No Analog Found

No files are in this category — all 17 files/components have close analogs in the codebase.

---

## Priority Order for Implementation

Based on visual impact and user-facing severity:

1. **AppShell.tsx** — one-line fix, unblocks all mobile layout
2. **Sidebar.tsx** — hamburger + slide-in drawer, the main UX change
3. **layout.tsx** — may need mobile top bar height compensation
4. **markets/page.tsx** — grid breakpoints, column hide/show
5. **markets/[id]/page.tsx** — SVG overflow, comment depth cap
6. **Auth pages** — `pt-4 md:pt-12` on mobile, form input widths
7. **chat/[userId]/page.tsx** — `calc(100vh - ...)` fix
8. **markets/new/page.tsx** — verify form widths (likely fine)
9. **All others** — already responsive or near-responsive

---

## Metadata

**Analog search scope:** `frontend/src/app/`, `frontend/src/components/nav/`, `frontend/src/components/`
**Files scanned:** 23 source files + directory listing
**Pattern extraction date:** 2026-04-29
