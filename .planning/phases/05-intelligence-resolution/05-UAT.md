---
status: complete
phase: 05-intelligence-resolution
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md, 05-08-SUMMARY.md, 05-09-SUMMARY.md, 05-10-SUMMARY.md, 05-11-SUMMARY.md, 05-12-SUMMARY.md, 05-13-SUMMARY.md
started: 2026-04-14T14:44:55Z
updated: 2026-04-14T14:44:55Z
---

## Current Test

number: 20
name: Live Socket Updates — Resolution Events
expected: |
  Open a market detail page in two browser tabs. In one tab, submit a resolution (or trigger
  a dispute/vote action). The OTHER tab shows the status change without a page refresh —
  validated by Redis pub/sub cross-process delivery.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Run `docker compose up --build` from scratch. All services start without errors (backend, frontend, postgres, redis, celery, celery-beat). Alembic migrations run including 012 (llm_model field). Frontend loads at https://localhost, backend health at https://localhost/api/health returns 200.
result: pass

### 2. Market Status Colors
expected: On /markets list and /dashboard, market cards show different colors based on status — open=default white/gray, pending_resolution=red (if your market) or yellow (others'), proposer_resolved=blue, disputed=violet, closed=green. Confirm at least 2-3 statuses visually.
result: pass

### 3. Hide Place Bet When Not Open
expected: On a market that is NOT in "open" status (e.g., pending_resolution, closed), the Place Bet form/button is NOT visible. Only visible on open markets.
result: pass

### 4. Active Positions on Dashboard
expected: The /dashboard active positions tab shows bets on markets in ALL non-closed statuses (open, pending_resolution, proposer_resolved, disputed). Markets with status=closed do NOT appear in the active list — they go to history.
result: pass

### 5. Market Creation — Separate Date/Time Pickers
expected: On the create market form, the deadline field shows two separate inputs: a date picker and a time picker side-by-side (not a combined datetime-local input). Both combine into a valid deadline when submitted.
result: pass

### 6. Proposer Resolution — Submit Outcome
expected: On a market you created that is in pending_resolution status, a resolution form appears. You can enter the outcome and submit. After submitting, market status changes to "proposer_resolved" and the resolution outcome is visible on the page.
result: pass

### 7. LLM Resolution Hint — Markdown Rendered
expected: On the resolution form (proposer, market in pending_resolution), the "Get AI hint" button fetches a suggested outcome. The returned hint text renders as formatted markdown (bold, lists, etc.) — not raw asterisks. Requires OPENROUTER_API_KEY in .env; if absent, shows a graceful error.
result: pass

### 8. Open Dispute
expected: On a market in proposer_resolved status, a "Dispute" button is visible. Clicking it changes market status to "disputed". Confirm the button is present and the status change occurs.
result: pass

### 9. Community Vote — Binary Market (YES/NO)
expected: On a disputed binary market's detail page, the community vote section shows YES and NO buttons. Your active vote = green + bold + border-2. Inactive options = violet. If you voted NO, the YES button turns red (rejected). Voting registers and tally updates.
result: pass

### 10. Community Vote — Vote Weight Display
expected: The vote tally shows individual vote weights in (x.x) format — e.g., "2.0" for voters who bet against proposed outcome, "0.5" for those who bet same way, "1.0" for no position. Entries with 0-weight appear in list.
result: pass

### 11. Community Vote — Numeric Market
expected: On a disputed numeric market, the community vote section shows a value input (not YES/NO buttons). After votes are cast, a bar chart displays distribution of voted values sorted numerically. Your own vote and weight are shown.
result: pass
notes: "Updated to 20-bin histogram (matches Live Odds), H reduced to 60px to prevent label overlap."

### 12. LLM Thread Summary — Markdown Rendered
expected: On any market detail page with 2+ comments, a "Summarize discussion" button appears below the Comments heading. Clicking it calls the LLM and displays a text summary rendered as formatted markdown (bold, lists, line breaks) — not raw asterisks.
result: pass

### 13. LLM Rate Limit
expected: After 5 "Summarize discussion" calls (same user, same day), the 6th call returns an error or disabled state — not a raw 429. UI shows a specific message like "daily limit reached" rather than a generic error.
result: pass

### 14. Settings Link in TopNav
expected: In the top navigation bar, a "Settings" link is visible (may be in a dropdown or directly). Clicking it navigates to /settings.
result: pass

### 15. LLM Settings — Platform Default Conditional
expected: Navigate to /settings. If OPENROUTER_API_KEY is set in .env, a "Platform Default" radio option appears alongside "Disabled" and "My own API key". If the platform key is NOT set, "Platform Default" does NOT appear (only "Disabled" and "My own API key").
result: pass

### 16. LLM Settings — Custom API Key Form
expected: On /settings, selecting "My own API key" reveals a form with three fields: Provider, API key, and Model. Filling and saving these calls PATCH /api/users/me. Re-visiting /settings shows the saved provider and model (API key field is blank for security).
result: pass

### 17. Profile Page — Settings Cogwheel
expected: On your own profile page (/profile/{your-username}), a cogwheel or settings icon/button is visible. Clicking it navigates to /settings. The cogwheel does NOT appear when viewing another user's profile.
result: pass

### 18. Payout on Market Close — Proportional BP Split
expected: When a market closes (status=closed), the total staked BP pool is divided proportionally among winners by winning stake size — not a flat +1 per winner. The balance shown on dashboard/profile increases correctly for winning betters. (Test with a closed market or create+close one.)
result: pass

### 19. Resolution Due Notification in Bell
expected: When a market you created reaches its deadline without auto-resolution, a notification appears in the bell dropdown. Clicking the notification navigates to /dashboard?tab=my_markets. (Requires a market past its deadline — skip if none available.)
result: pass

### 20. Live Socket Updates — Resolution Events
expected: Open a market detail page in two browser tabs. In one tab, submit a resolution (or trigger a dispute/vote action). The OTHER tab shows the status change (pending_resolution → proposer_resolved, or disputed) without a page refresh — validated by Redis pub/sub cross-process delivery.
result: pass

## Summary

total: 20
passed: 20
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
