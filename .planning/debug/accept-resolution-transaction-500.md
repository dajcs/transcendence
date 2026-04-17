---
status: resolved
trigger: "on a market where the author didn't put a bet, after deadline proposed a solution, the other two participants accepted the solution - but when last participant accepted this happened on backend trace: POST /api/bets/{id}/accept-resolution 500 Internal Server Error — sqlalchemy.exc.InvalidRequestError: A transaction is already begun on this Session."
created: 2026-04-17
updated: 2026-04-17
---

## Symptoms

- **Expected**: Last participant accepts resolution → market transitions from "Resolution Proposed" to resolved, payouts triggered
- **Actual**: 500 Internal Server Error on POST /api/bets/5809420f-21d6-4236-a2c2-58fe800d91aa/accept-resolution; market stuck in "Resolution Proposed"
- **Error**: `sqlalchemy.exc.InvalidRequestError: A transaction is already begun on this Session.`
- **Stacktrace**:
  - `resolution.py:211` `accept_resolution` calls `await trigger_payout(db, bet_id, resolution.outcome, overturned=False)`
  - `resolution_service.py:139` `trigger_payout` calls `async with db.begin():`
  - SQLAlchemy raises: `A transaction is already begun on this Session.`
- **Context**: Market where the author (proposer) did NOT place a bet. Deadline passed, solution proposed, 2 of 2 participants accepted (author not a bettor). The last acceptor triggers the error.
- **Reproduction**: Create market, don't bet as author, have 2 others bet, pass deadline, propose resolution, have all bettors accept one by one — last accept fails.

## Current Focus

hypothesis: "CONFIRMED: trigger_payout receives a db session that already has an open autobegun transaction from post-commit queries in accept_resolution"
test: "read resolution.py and resolution_service.py — confirmed"
expecting: "fix: add await db.commit() after eligibility queries, before trigger_payout call"
next_action: "done"
reasoning_checkpoint: "SQLAlchemy async sessions use autobegin — after db.commit() on line 195, the very next query (line 197 _get_review_counts) autobegins a new transaction. By line 211, when trigger_payout calls async with db.begin(), the session already has an active transaction → InvalidRequestError."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-17T00:00:00Z
  file: backend/app/api/routes/resolution.py
  lines: 194-211
  note: "db.add(ResolutionReview) + await db.commit() at line 195. Then _get_review_counts (line 197) and eligible_voters query (lines 201-207) execute inside the autobegun transaction. trigger_payout at line 211 calls async with db.begin() on a session that already has a transaction open."

- timestamp: 2026-04-17T00:00:00Z
  file: backend/app/services/resolution_service.py
  lines: 127-139
  note: "trigger_payout docstring explicitly states: 'Must be called OUTSIDE an existing transaction — creates its own async with db.begin()'. The contract was violated by the autobegun transaction from post-commit reads in the caller."

- timestamp: 2026-04-17T00:00:00Z
  file: backend/app/db/session.py
  lines: 10
  note: "async_sessionmaker(engine, expire_on_commit=False) — no autobegin=False, so SQLAlchemy default autobegin is active. Any statement after a commit starts a new implicit transaction."

## Eliminated Hypotheses

- "The session was created inside an already-open transaction context manager" — eliminated: get_db yields a plain session with no wrapping transaction.

## Resolution

root_cause: "After `await db.commit()` on line 195 of accept_resolution, SQLAlchemy autobegins a new transaction when `_get_review_counts` and the `eligible_voters` query execute (lines 197-207). When `trigger_payout` then calls `async with db.begin()`, the session already has this autobegun transaction open, raising InvalidRequestError."
fix: "Added `await db.commit()` after the eligibility query (after line 207, before the trigger_payout call). This is a no-op commit (no pending writes) that closes the autobegun read transaction, allowing trigger_payout's `async with db.begin()` to succeed."
verification: "Reproduce: create market, don't bet as author, 2 bettors accept in sequence — last accept should now return 200 with auto_closed=true and market status=closed."
files_changed:
  - backend/app/api/routes/resolution.py
