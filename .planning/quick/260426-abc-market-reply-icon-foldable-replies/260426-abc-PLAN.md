---
quick_id: 260426-abc
slug: market-reply-icon-foldable-replies
date: 2026-04-26
---

# Quick Task: Market Reply Icon + Foldable Replies

## Description
Adjust market detail page discussion section:
1. Replace "Reply" text button with a reply icon (↩ SVG) and "Reply" tooltip
2. Implement foldable/collapsible reply threads

## Tasks

### Task 1: Reply icon button
- **File**: `frontend/src/app/(protected)/markets/[id]/page.tsx`
- **Action**: Replace Reply text button with inline SVG icon + `title` tooltip attribute

### Task 2: Foldable replies
- **File**: `frontend/src/app/(protected)/markets/[id]/page.tsx`
- **Action**: Add `collapsedComments` state, parent map, `isCommentHidden` helper, `toggleCollapsed` fn; render chevron toggle on comments with children; skip hidden comments in DFS render loop

### Task 3: i18n keys
- **Files**: `frontend/src/i18n/en.ts`, `fr.ts`, `de.ts`
- **Action**: Add `market.collapse_replies` and `market.expand_replies` keys in all 3 locales
