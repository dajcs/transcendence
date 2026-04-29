---
quick_id: 260426-abc
status: complete
date: 2026-04-26
---

# Summary: Market Reply Icon + Foldable Replies

## What was done

**Reply icon:** Replaced the `{t("market.reply")}` text button with an inline SVG corner-down-left arrow (13×13px), using `title={t("market.reply")}` for the tooltip. Removed the border box styling, kept hover color transition.

**Foldable replies:**
- Added `collapsedComments: Set<string>` state
- Built `commentParentMap` (id → parent_id) alongside existing depth/children maps
- Added `isCommentHidden(comment)` — walks ancestor chain, returns true if any ancestor is in `collapsedComments`
- Added `toggleCollapsed(id)` — toggles id in the set
- In render loop: skip hidden comments via early `return null`; show a chevron SVG toggle button on comments that have children (rotates 90° when collapsed via inline style)

**i18n:** Added `market.collapse_replies` / `market.expand_replies` in en, fr, de.

## Files changed
- `frontend/src/app/(protected)/markets/[id]/page.tsx`
- `frontend/src/i18n/en.ts`
- `frontend/src/i18n/fr.ts`
- `frontend/src/i18n/de.ts`
