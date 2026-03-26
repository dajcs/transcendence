---
status: complete
phase: 02-core-betting
source:
  - .planning/phases/02-core-betting/02-07-SUMMARY.md
  - .planning/phases/02-core-betting/02-08-SUMMARY.md
  - .planning/phases/02-core-betting/02-09-SUMMARY.md
started: 2026-03-26T14:10:00Z
updated: 2026-03-26T14:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Bet Cap Enforcement
expected: Place a bet with an amount exceeding your current cap. The request should be rejected with an error — not silently placed.
result: pass

### 2. Decimal Bet Amount
expected: On the market detail page, enter a decimal amount (e.g. 1.5) into the bet input field. The browser should accept it without showing a tooltip like "please enter a valid value, closest values are 1 and 2". The bet should submit normally.
result: pass

### 3. Comment Author Display
expected: Open a market that has comments. Each comment should display the author's username (e.g. "alice", "bob") above or beside the comment text.
result: pass

### 4. Comment Reply Button and Inline Form
expected: On a top-level comment, a Reply button should be visible. Clicking it opens an inline input below that comment. Typing a reply and submitting should create an indented reply nested under the parent comment.
result: pass

### 5. Reply Depth Limit
expected: On an existing reply (a comment already nested under another), there should be NO Reply button — only top-level comments can be replied to.
result: pass

### 6. Dashboard Portfolio Row — No View Label
expected: On the dashboard, active bet rows should not show an explicit "View →" or "View" label. The entire row should be clickable, navigating to the market detail page.
result: pass

### 7. Dashboard Portfolio Row — Own-Side Win Probability
expected: Each active bet row on the dashboard should show "Win X%" reflecting your own position's current winning probability (not both YES % and NO %).
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
