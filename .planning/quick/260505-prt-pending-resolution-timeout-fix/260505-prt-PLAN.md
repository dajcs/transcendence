# Quick Task 260505-prt: Pending Resolution Timeout Fix

## Goal

Markets in `pending_resolution` must move to community vote after the proposer misses the 2-day resolution window.

## Tasks

1. Add regression coverage for the timeout behavior.
   - Verify pending markets older than 2 days auto-escalate to `disputed`.
   - Verify a late proposer resolution attempt opens community voting instead of returning a dead-end expiration error.

2. Implement the timeout transition in the backend resolution flow.
   - Use one shared proposer timeout constant.
   - Apply it in the worker escalation query and proposer resolve route.
   - Keep socket/status notifications and dispute deadline scheduling intact.

3. Run focused backend tests and record the result in quick-task artifacts.
