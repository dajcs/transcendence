---
status: resolved
phase: 02-core-betting
source:
  - .planning/phases/02-core-betting/02-01-SUMMARY.md
  - .planning/phases/02-core-betting/02-02-SUMMARY.md
  - .planning/phases/02-core-betting/02-03-SUMMARY.md
  - .planning/phases/02-core-betting/02-04-SUMMARY.md
  - .planning/phases/02-core-betting/02-05-SUMMARY.md
  - .planning/phases/02-core-betting/02-06-SUMMARY.md
started: 2026-03-25T16:22:20Z
updated: 2026-03-26T14:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop running services, then start the stack from scratch. Startup should complete without boot errors, migrations/seeding should succeed, and the app should respond to a primary request (homepage or health/API) with live data.
result: pass

### 2. Register + Signup Bonus
expected: Registering a new account succeeds and the authenticated user payload includes balance fields (bp/kp/tp) with signup bonus behavior reflected.
result: pass

### 3. Daily Login Bonus Once Per Day
expected: Accessing authenticated user data on a new UTC day applies a single daily bonus; repeated checks the same day do not repeatedly increase balance.
result: pass

### 4. Top Navigation Balance Display
expected: The top nav for authenticated users shows live bp/kp/tp balances and includes working navigation into Markets.
result: pass

### 5. Browse Markets Feed
expected: Markets page loads a list and supports observable feed behavior (sorting/filtering/pagination controls update results and state correctly).
result: pass

### 6. Create Market Flow
expected: Creating a market from the protected create page succeeds, persists the new market, and the user can navigate to it afterward.
result: pass

### 7. Market Detail + Positions View
expected: Market detail page loads current odds/market info and shows user position data section(s) without refresh glitches.
result: pass

### 8. Place Bet + Validation
expected: Placing a valid bet succeeds and updates displayed position/balance data; invalid/capped bet attempts show rejection behavior instead of silently succeeding.
result: issue
reported: "1) Bet cap not enforced — Alice (stackoverflow) could bet 42 when valid range is 8–40. 2) Bet input has implicit integer-only constraint (step=1 or similar) — browser tooltip 'please enter a valid value, closest values are 33 and 34' appears when entering 33.33; decimals should be allowed."
severity: major

### 9. Withdraw Bet Refund
expected: Withdrawing an existing position succeeds and the refund is reflected in visible balance/position state.
result: pass

### 10. Comments, Reply Depth, and Upvote
expected: Users can create comments, create one-level replies, are prevented from deeper reply nesting, and upvoting applies once with updated UI state.
result: issue
reported: "1) No reply button on comments — only top-level comments can be placed. 2) Comment author is not displayed."
severity: major

### 11. Dashboard Portfolio View
expected: Protected dashboard shows portfolio/position overview data from betting activity and remains consistent after bet/place/withdraw operations.
result: issue
reported: "Dashboard bet listing should match market listing style — no explicit 'View' button (clicking the row is obvious). Missing: user's own position amount and own winning probability on each portfolio entry."
severity: major

## Fix Notes

- Login now supports both username and email across UI and backend payload compatibility.
- Login form error rendering was hardened to avoid React runtime crashes on structured API validation errors.
- Access-token inactivity window increased from 15 minutes to 5 hours (JWT expiry + cookie max_age aligned).
- Voting on your own market now correctly rebates +1 bp (net cost 0); implemented in `bet_service.place_bet`.
- Top nav balance updates immediately after market creation, betting, and upvoting — `bootstrap()` called in mutation `onSuccess`.
- Markets support three types: `binary`, `multiple_choice` (choices stored as JSONB), `numeric` (min/max range); DB migration 002.
- Market listing shows comment count alongside vote count.
- Market detail shows yes/no vote counts for binary, per-choice progress bars for multichoice, and a histogram for numeric.
- `BetPlaceRequest.side` changed from `Literal["yes","no"]` to `str` to support multichoice and numeric voting.
- Market upvotes added (`bet_upvotes` table, migration 003); upvoting a market awards +1 kp to the proposer.
- Comment upvote KP and market upvote KP now reflected in top nav immediately after action.
- Daily allocation formula changed from `log10` to `log2` (faster growth at low kp counts).
- Market creation error messages now show the specific validation reason from the API response.
- Stale `celerybeat-schedule` file prevented midnight allocation from firing; resolved by deleting the file on restart. Daily allocation was applied manually for the missed cycle.
- Dashboard bet rows are now clickable and route to the market detail page.
- Dashboard withdraw button now opens the bet/market detail with a confirmation dialog instead of triggering immediate withdrawal.
- Withdrawal refund is now calculated based on the market's current probability for that position at time of withdrawal (probability-weighted refund), not a flat amount.

## Summary

total: 11
passed: 8
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Bet cap is enforced server-side and client-side; bet input accepts decimal amounts without browser validation errors."
  status: resolved
  reason: "User reported: 1) Bet cap not enforced — Alice (stackoverflow) could bet 42 when valid range is 8–40. 2) Bet input has implicit integer-only constraint (step=1 or similar) — browser tooltip 'please enter a valid value, closest values are 33 and 34' appears when entering 33.33; decimals should be allowed."
  severity: major
  test: 8
  root_cause: |
    1) BET CAP: _check_bet_cap (bet_service.py:40-51) counts active positions per market (always 0 since only 1 position/market allowed), so cap is never triggered. Additionally BetPlaceRequest has no amount field — all bets hard-coded to bp_staked=1.0. compute_bet_cap uses log2 but docstring says log10 (digit count), producing inconsistent caps. The cap needs to gate stake amount, not position count, and BetPlaceRequest needs a validated amount field (ge=min, le=cap).
    2) DECIMAL INPUT: frontend/src/app/(protected)/markets/[id]/page.tsx:315-322 — <input type="number"> has no step attribute, so browser defaults to step=1, rejecting decimals. Fix: add step="any".
  artifacts:
    - path: "backend/app/services/bet_service.py"
      issue: "_check_bet_cap compares position count (always 0) against cap instead of bet amount"
    - path: "backend/app/services/economy_service.py"
      issue: "compute_bet_cap line 21 uses log2 instead of log10 (digit count)"
    - path: "backend/app/schemas/bet.py"
      issue: "BetPlaceRequest missing amount field with range validation"
    - path: "frontend/src/app/(protected)/markets/[id]/page.tsx"
      issue: "line ~320: <input type=number> missing step='any', defaults to step=1"
  missing:
    - "Add amount: float field to BetPlaceRequest with ge=min_bet, le=cap validation"
    - "Rewrite _check_bet_cap to validate amount <= compute_bet_cap(kp)"
    - "Fix compute_bet_cap to use log10 (digit count) per docstring"
    - "Add step='any' to numeric bet input in market detail page"
  debug_session: ""

- truth: "Comments show reply button for one-level nesting; comment author is visible on each comment."
  status: resolved
  reason: "User reported: 1) No reply button on comments — only top-level comments can be placed. 2) Comment author is not displayed."
  severity: major
  test: 10
  root_cause: |
    1) REPLY BUTTON: Frontend never implemented reply UI. page.tsx:72 postComment mutation sends only {content}, no parent_id. Comment render loop (lines 354-367) has only upvote button, no reply button, no replyingTo state. Backend is fully ready (CommentCreate accepts parent_id, service enforces one-level depth).
    2) AUTHOR: Backend CommentResponse only returns user_id (UUID), never joins User table — no author_username field. Frontend Comment type (types.ts:61-69) has user_id only. page.tsx:356 renders only comment.content.
  artifacts:
    - path: "frontend/src/app/(protected)/markets/[id]/page.tsx"
      issue: "lines 354-367: no reply button, no replyingTo state, postComment sends no parent_id"
    - path: "backend/app/schemas/comment.py"
      issue: "CommentResponse missing author_username field"
    - path: "backend/app/services/comment_service.py"
      issue: "list_comments/create_comment never joins User table to populate author"
    - path: "frontend/src/lib/types.ts"
      issue: "Comment interface missing author_username field"
  missing:
    - "Add author_username to CommentResponse schema and join User in comment_service"
    - "Add author_username to frontend Comment type"
    - "Add replyingTo state + Reply button + inline reply input in market detail page"
    - "Pass parent_id in postComment mutation when replying"
    - "Visually indent replies (parent_id !== null) in comment list"
  debug_session: ""

- truth: "Dashboard portfolio entries styled like market listing (clickable rows, no explicit View button); each entry shows user's own position amount and winning probability."
  status: resolved
  reason: "User reported: Dashboard bet listing should match market listing style — no explicit 'View' button (clicking the row is obvious). Missing: user's own position amount and own winning probability on each portfolio entry."
  severity: major
  test: 11
  root_cause: |
    Row is already a <Link> (lines 35-48) so it is clickable — "View →" (line 42) is just a redundant label inside it, delete the span. bp_staked already returned by API and rendered. Winning probability for user's side is derivable from existing data: position.side === "yes" ? position.yes_pct : position.no_pct — no backend change needed.
  artifacts:
    - path: "frontend/src/app/(protected)/dashboard/page.tsx"
      issue: "line 42: redundant 'View →' span inside already-clickable Link row; line 44-46: show win probability for user's own side instead of both percentages"
  missing:
    - "Remove <span className='text-xs text-gray-500'>View →</span> from line 42"
    - "Show win probability: position.side === 'yes' ? position.yes_pct : position.no_pct"
  debug_session: ""
