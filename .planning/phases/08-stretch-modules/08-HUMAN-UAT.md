---
status: partial
phase: 08-stretch-modules
source: [08-VERIFICATION.md]
started: 2026-04-30T00:00:00Z
updated: 2026-04-30T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Markets list at 360px — no horizontal overflow
expected: The markets list renders with no horizontal scrollbar. Activity column (bet count) and time-clock column are hidden. Market title and condensed odds column fill available width cleanly.
result: [pending]

### 2. SVG histogram overflow on mobile
expected: SVG histogram charts on /markets/[id] scroll horizontally within their overflow-x-auto container rather than overflowing the page boundary at 360px viewport.
result: [pending]

### 3. Sidebar hamburger drawer interaction
expected: On mobile (360px), tapping the hamburger button slides the sidebar in from the left. Tapping the dark backdrop closes it. Tapping any nav link also closes it.
result: [pending]

### 4. Auth pages top padding on mobile
expected: /login, /register, and /reset-password forms are visible without scrolling — top padding is 16px (pt-4) on mobile, clearing the fixed 48px top bar.
result: [pending]

### 5. Chat thread height on mobile
expected: At 360px viewport, the message thread is scrollable and the compose input is visible at the bottom — h-[calc(100vh-14rem)] keeps the bar in view.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
