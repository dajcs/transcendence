---
created: 2026-04-15T08:04:09.820Z
title: Fix header row flexbox layout
area: ui
files: []
---

## Problem

Header row has a flexbox layout issue. Noticed during UAT testing of Phase 05. Exact symptoms not yet described — needs investigation on the relevant page(s).

## Solution

Inspect the header row component(s) for incorrect flex direction, alignment, or wrapping. Apply the correct Tailwind flex utilities (e.g., `flex`, `items-center`, `justify-between`, `flex-wrap`) as needed.
