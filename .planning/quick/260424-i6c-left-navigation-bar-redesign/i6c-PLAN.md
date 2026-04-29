---
phase: quick-i6c
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/nav/Sidebar.tsx
autonomous: true
requirements: [UI-NAV-REDESIGN]

must_haves:
  truths:
    - "Vox Populi title appears at top of sidebar"
    - "Username and logout button appear in a row below a spacer"
    - "Point balances show LP as integer (pink bubble), BP as 1dp float (green bubble), TP as 1dp float (blue bubble) separated by ♦ dividers"
    - "Profile link and Search Users appear below balances"
    - "Controls row has: language dropdown (2-char wide, left), theme toggle (centered), notification bell (right)"
    - "Create Market button appears below controls"
    - "Nav links in order: Markets, Friends, Chat, Hall of Fame"
    - "Footer has Privacy Policy left-aligned and Terms of Service right-aligned"
  artifacts:
    - path: "frontend/src/components/nav/Sidebar.tsx"
      provides: "Redesigned left navigation sidebar"
  key_links:
    - from: "Sidebar.tsx"
      to: "useAuthStore"
      via: "user.lp / user.bp / user.tp"
      pattern: "user\\?\\.(lp|bp|tp)"
---

<objective>
Redesign the left navigation sidebar (Sidebar.tsx) to match the specified item order and visual layout.

Purpose: Current sidebar has the wrong item order (points shown before username, footer links centered). Bring layout in line with the spec.
Output: Rewritten Sidebar.tsx with the exact item order, point bubble format, controls row layout, and footer layout specified.
</objective>

<execution_context>
@/mnt/c/Users/dajcs/code/transcendence/.claude/get-shit-done/workflows/execute-plan.md
@/mnt/c/Users/dajcs/code/transcendence/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/mnt/c/Users/dajcs/code/transcendence/.planning/STATE.md

Existing Sidebar.tsx is at `frontend/src/components/nav/Sidebar.tsx` (220px wide, fixed left, already uses useAuthStore, useThemeStore, useFriendsStore, useLocaleStore, NotificationBell, UserSearch, useT).

User store exposes: `user.username`, `user.lp` (number), `user.bp` (number), `user.tp` (number).

i18n keys available: `nav.markets`, `nav.friends`, `nav.chat`, `nav.hall_of_fame`, `nav.logout`, `nav.search_users`, `nav.theme_light`, `nav.theme_dark`, `nav.language`, `footer.privacy`, `footer.terms`, `markets.create`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Sidebar.tsx to the specified layout</name>
  <files>frontend/src/components/nav/Sidebar.tsx</files>
  <action>
Rewrite `frontend/src/components/nav/Sidebar.tsx` in full. Keep all existing imports (Link, usePathname, useRouter, useAuthStore, useThemeStore, useFriendsStore, useLocaleStore, NotificationBell, UserSearch, useT, useState, useEffect) and all existing SVG icon components. Preserve `handleLogout`, `isActive`, `isDark`, `mounted`, `profileHref` logic unchanged.

Restructure the JSX body to implement the following item order exactly:

1. **Logo/title** — "Vox Populi" (existing logo block, link to /markets)
2. **Spacer** — `<div className="h-2 shrink-0" />`
3. **Username + logout row** — flex row: left side `@{user?.username}` (13px semibold, truncate), right side logout button (existing IconLogout). Same styling as current.
4. **Point balances row** — single flex row, items-center, gap-1, px-3 pb-2. Layout:
   - `<lp>` ❤️ in light pink bubble (existing rose classes): `❤️ {Math.round(user?.lp ?? 0)}`
   - `<span className="text-gray-400 dark:text-gray-600 text-[11px]">♦</span>`
   - `<bp>` in light green bubble (existing emerald classes): `♦ {(user?.bp ?? 0).toFixed(1)} BP`  — NOTE: the ♦ here is the diamond symbol inside the green bubble as per spec
   - `<span className="text-gray-400 dark:text-gray-600 text-[11px]">♦</span>`
   - `<tp>` in light blue bubble (existing sky classes): `✦ {(user?.tp ?? 0).toFixed(1)} TP`
   
   Wait — re-read spec: "LP `<lp>` ❤️ in light pink bubble | ♦ | `<bp>` BP in light green bubble | ♦ | `<tp>` TP in light blue bubble". The ♦ between bubbles are separators, not inside bubbles. Inside pink bubble: `❤️ {lp}`. Inside green bubble: `{bp} BP`. Inside blue bubble: `{tp} TP`. Use existing bubble classes.

5. **"Profile" link** — existing Link to profileHref with IconProfile, same active/inactive classes
6. **"Search Users" link/input** — existing `<UserSearch />` in px-3 pb-2 wrapper
7. **Spacer** — `<div className="h-2 shrink-0" />`
8. **Controls row** — flex row, items-center, px-3 pb-2, gap-1:
   - Language `<select>` on the LEFT: `w-[2ch]` (or `w-8`) width so only 2 chars show, showing locale abbreviation ("en", "fr", "de") — change option values/labels to just the 2-char code: `<option value="en">EN</option><option value="fr">FR</option><option value="de">DE</option>`. Use `text-[12px]` and existing border/bg styling. Left-aligned via natural flex start.
   - Theme toggle button in the CENTER: wrap in `<div className="flex-1 flex justify-center">` containing the existing theme button.
   - NotificationBell on the RIGHT: `<div className="ml-auto shrink-0">` containing `<NotificationBell dropdownAlign="left" />`.
9. **"Create Market" button** — existing Link to /markets/new, full width, existing accent classes
10. **Nav links** — existing nav block with Markets, Friends, Chat, Hall of Fame in the same order as current `navLinks` array
11. **Footer** — `border-t` row: flex row justify-between. Left: Privacy Policy link. Right: Terms of Service link. Both text-[10px] text-gray-400. Remove the current `justify-end` and `flex gap-2` and replace with `flex items-center justify-between`.
  </action>
  <verify>
    <automated>cd /mnt/c/Users/dajcs/code/transcendence/frontend && npx tsc --noEmit --project tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
TypeScript compiles without errors in Sidebar.tsx. Layout in browser (or code review) matches: logo → spacer → username+logout → point bubbles (LP int, BP 1dp, TP 1dp with ♦ separators) → Profile → Search Users → spacer → controls row (lang left, theme center, bell right) → Create Market → nav links → footer (privacy left, terms right).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Sidebar redesigned with new item order, point bubble format, controls row layout, and split footer.</what-built>
  <how-to-verify>
1. Open the app in Chrome (https://localhost or your dev URL).
2. Log in and observe the left sidebar. Verify top-to-bottom order:
   - "Vox Populi" logo/title
   - blank spacer
   - @username on left, logout icon on right
   - Three point bubbles: pink (LP, integer), ♦, green (BP, 1 decimal), ♦, blue (TP, 1 decimal)
   - "Profile" link
   - "Search Users" input
   - blank spacer
   - Controls row: language selector (narrow, EN/FR/DE, left) | theme toggle (center) | notification bell (right)
   - "+ Create Market" button
   - Markets / Friends / Chat / Hall of Fame links
   - Footer row: "Privacy Policy" left — "Terms of Service" right
3. Check dark mode looks correct (toggle theme).
  </how-to-verify>
  <resume-signal>Type "approved" if layout matches spec, or describe any issues to fix.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes in frontend/
- Sidebar item order matches the 13-item spec exactly
- LP shown as integer, BP and TP shown to 1 decimal place
- ♦ separators between the three point bubbles (not inside them)
- Language dropdown is ~2 chars wide showing EN/FR/DE abbreviations
- Theme toggle is centered in the controls row
- Notification bell is right-aligned in the controls row
- Footer has Privacy Policy left and Terms of Service right (justify-between)
</verification>

<success_criteria>
Sidebar.tsx TypeScript-clean and visually matches the specified layout in both light and dark mode.
</success_criteria>

<output>
After completion, create `.planning/quick/260424-i6c-left-navigation-bar-redesign/i6c-SUMMARY.md` following the summary template.
</output>
