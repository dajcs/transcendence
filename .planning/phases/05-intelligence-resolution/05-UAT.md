---
status: complete
phase: 05-intelligence-resolution
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md
started: 2026-04-01T15:20:00Z
updated: 2026-04-01T15:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Run `docker compose up --build` from scratch. All services start without errors (backend, frontend, postgres, redis, celery). Alembic migrations run (009, 010, 011 visible in logs). Frontend loads at https://localhost, backend health at https://localhost/api/health returns 200.
result: pass

### 2. Market Status Colors
expected: On /markets list and /dashboard, market cards show different colors based on status: open=default/white text, pending_resolution=red (if your market) or yellow, proposer_resolved=blue, disputed=violet, closed=green. Open a market in each status and confirm the card color matches.
result: pass

### 3. Hide Place Bet When Not Open
expected: On a market that is NOT in "open" status (e.g., pending_resolution, closed), the Place Bet form/button is NOT visible. Only visible on open markets.
result: pass

### 4. Your Position — Withdraw/Refund Hidden When Not Open
expected: On the market detail page for a market that is not open, the Your Position section does NOT show withdraw or refund buttons. Those buttons only appear when market is open.
result: pass

### 5. Active Positions on Dashboard
expected: The /dashboard active positions tab shows bets on markets in ALL non-closed statuses: open, pending_resolution, proposer_resolved, and disputed. Markets with status=closed do NOT appear in the active list (they go to history).
result: pass

### 6. Proposer Resolution — Submit Outcome
expected: On a market you created that is in pending_resolution status, a resolution form appears. You can enter the outcome and submit. After submitting, market status changes to "proposer_resolved" and the resolution outcome is visible.
result: pass

### 7. LLM Resolution Hint
expected: On the resolution form (for proposer, market in pending_resolution), there is a "Get AI hint" button. Clicking it fetches a suggested outcome from the LLM and shows it. Requires OPENROUTER_API_KEY configured; if not configured, should show a graceful error or null response.
result: pass

### 8. Open Dispute
expected: On a market in proposer_resolved status, a "Dispute" button is visible (even if you don't have a position). Clicking it opens a dispute, changing market status to "disputed". Requires enough other betters, or just test the button is present and triggers the call.
result: pass
note: "User observed market status changes are not reflected live on other clients' screens — this is expected and covered by plan 05-06 (socket event wiring, not yet executed)"

### 9. Community Vote — Binary Market (YES/NO buttons)
expected: On a disputed binary market's detail page, the community vote section shows YES and NO buttons. Active vote = green+bold+border-2; inactive options = violet (same as multichoice). If you voted NO, the YES button turns red (rejected).
result: pass
note: "Design updated — inactive buttons are violet (not default). Recorded in 05-CONTEXT.md D-09 and STATE.md."

### 10. Community Vote — Vote Weight Tally
expected: The vote tally / weight display shows individual vote weights in (x.x) format (e.g. "2.0", "0.5", "1.0"). Higher weight (2.0) for voters who bet against proposed outcome, lower (0.5) for those who bet same way, 1.0 for no position. Entries with 0-weight still appear in list.
result: pass

### 11. Community Vote — Numeric Market (Bar Chart)
expected: On a disputed numeric market, the community vote section shows a value input (not YES/NO buttons). After votes are cast, a bar chart displays the distribution of voted values sorted numerically. Your own vote and weight are shown.
result: pass

### 12. LLM Thread Summary
expected: On any market detail page with comments, there is a "Summarize discussion" button below the Comments heading. Clicking it calls the LLM and displays a text summary of the comment thread. Rate limited to 5/day per user.
result: pass
note: "Was broken (validate_response 500-char limit too tight for summaries). Fixed: max_response_len=2200 for both summarize and hint."

### 13. Settings Page — LLM Opt-Out
expected: Navigate to /settings. A settings page appears with an "LLM opt-out" checkbox (or toggle). Checking it and saving calls PATCH /api/users/me and persists the preference. Re-visiting /settings shows the saved value.
result: issue
reported: "Design changed: (1) Profile page needs Settings button/cogwheel → /settings. (2) Platform default option only shown when OPENROUTER_API_KEY is set in .env. (3) If no API key in .env, default is 'Disabled — hide AI features'. (4) My own API key needs 3 fields: Provider, API key, Model. (5) Own API key stored in DB with row-level auth so only user can access their own secrets."
severity: major

### 14. Payout on Market Close
expected: When a market closes (status=closed), winners receive +1 Karma Point and Truth Points based on their bet weight. The balance shown on dashboard/profile increases for winning betters. (Test by creating and closing a market, or observing an existing closed market's payout banner.)
result: issue
reported: "Design changed: (1) BP payout: the total staked BP pool is divided proportionally among winners (not flat +1 per winner). (2) TP calculation: when a user has multiple positions, tp is calculated per position (0 for losing), final tp = average of all positions' tp including 0s."
severity: major

### 15. Resolution Due Notification
expected: When a market created by you reaches its deadline without auto-resolution, a notification bell alert appears. Clicking the notification navigates to /dashboard?tab=my_markets. (May be hard to trigger manually — skip if no pending resolution deadlines exist.)
result: issue
reported: "No bell notification, not even after page reload."
severity: major

## Summary

total: 15
passed: 12
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "LLM settings: Platform default conditional on .env OPENROUTER_API_KEY; Disabled hides all AI buttons; My own API key stores provider+key+model per user with row-level auth. Profile page has cogwheel → /settings."

  status: failed
  reason: "User reported: design changed — platform default conditional on .env key; own API key needs provider+key+model fields; DB row-level auth for user's key; profile page needs Settings button."
  severity: major
  test: 13
  root_cause: ""
  artifacts: []
  missing:
    - "Profile page: add Settings/cogwheel button → /settings"
    - "Backend: expose OPENROUTER_API_KEY presence as /api/config/llm-available (no key value)"
    - "Settings page: conditional render of Platform Default option"
    - "User model: llm_mode (string), llm_provider, llm_api_key, llm_model fields + migration"
    - "PATCH /api/users/me: accept provider+key+model, never return llm_api_key in GET"
    - "Backend: row-level auth enforcement (only own user can write their key)"
  debug_session: ""

- truth: "Resolution due notification appears in bell when proposer's market deadline passes without auto-resolution. Clicking navigates to /dashboard?tab=my_markets."
  status: failed
  reason: "User reported: no bell notification, not even after page reload."
  severity: major
  test: 15
  root_cause: "sio in server.py used in-memory manager — sio.emit() from Celery worker processes emits to nobody (different process, no connected clients). All Celery socket emits failed silently. Fixed: AsyncRedisManager added to server.py; celery_emit() helper added; notification_service, resolution_service, resolution.py tasks updated to use celery_emit()."
  artifacts:
    - path: "backend/app/socket/server.py"
      issue: "In-memory manager — fixed by adding AsyncRedisManager client_manager"
    - path: "backend/app/services/notification_service.py"
      issue: "sio.emit → celery_emit"
    - path: "backend/app/services/resolution_service.py"
      issue: "sio.emit → celery_emit"
    - path: "backend/app/workers/tasks/resolution.py"
      issue: "sio.emit → celery_emit (2 places)"
  missing: []
  debug_session: ""

- truth: "BP payout = total pool divided proportionally among winners by winning stake. TP payout = per-position tp (0 for losers), final tp = average across all user positions including 0s."
  status: failed
  reason: "User reported: design changed — BP pool divided proportionally (not +1 flat); TP per position averaged across all positions including losers."
  severity: major
  test: 14
  root_cause: ""
  artifacts:
    - path: "backend/app/services/resolution_service.py"
      issue: "trigger_payout uses flat +1bp per winner and single tp formula; needs pool-split BP and per-position averaged TP"
  missing:
    - "resolution_service.py: rewrite trigger_payout — compute total_bp_pool, split proportionally among winners"
    - "resolution_service.py: rewrite compute_tp_earned — group bets by user, compute per-position tp (0 for losers), return average"
  debug_session: ""
