---
status: testing
phase: 02-core-betting
source:
  - .planning/phases/02-core-betting/02-01-SUMMARY.md
  - .planning/phases/02-core-betting/02-02-SUMMARY.md
  - .planning/phases/02-core-betting/02-03-SUMMARY.md
  - .planning/phases/02-core-betting/02-04-SUMMARY.md
  - .planning/phases/02-core-betting/02-05-SUMMARY.md
  - .planning/phases/02-core-betting/02-06-SUMMARY.md
started: 2026-03-25T16:22:20Z
updated: 2026-03-26T00:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 7
name: Market Detail + Positions View
expected: |
  Market detail page loads current odds/market info and shows user position
  data section(s) without refresh glitches.
awaiting: user response

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
result: issue
reported: "1) Dashboard bets are listed but clicking a bet doesn't open market detail. 2) Withdraw button on dashboard withdraws immediately - should open bet detail with a confirmation dialog instead. 3) On withdrawal bp was not increased - refund should be based on market probability of that position before withdrawal."
severity: major

### 8. Place Bet + Validation
expected: Placing a valid bet succeeds and updates displayed position/balance data; invalid/capped bet attempts show rejection behavior instead of silently succeeding.
result: pending

### 9. Withdraw Bet Refund
expected: Withdrawing an existing position succeeds and the refund is reflected in visible balance/position state.
result: pending

### 10. Comments, Reply Depth, and Upvote
expected: Users can create comments, create one-level replies, are prevented from deeper reply nesting, and upvoting applies once with updated UI state.
result: pending

### 11. Dashboard Portfolio View
expected: Protected dashboard shows portfolio/position overview data from betting activity and remains consistent after bet/place/withdraw operations.
result: pending

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

## Summary

total: 11
passed: 6
issues: 1
pending: 4
skipped: 0
blocked: 0

## Gaps

- none
