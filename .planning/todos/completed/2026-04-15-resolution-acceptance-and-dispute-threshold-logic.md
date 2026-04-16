---
created: 2026-04-15T08:04:09.820Z
title: Resolution acceptance and dispute threshold logic
area: api
files:
  - backend/app/services/resolution_service.py
  - backend/app/workers/tasks/resolution.py
---

## Problem

Current resolution flow does not implement participant-based acceptance/dispute thresholds. The correct logic is:

- **Auto-accept:** If > 90% of participants accept the proposer's resolution → market is immediately considered solved (skip 48h window)
- **Auto-dispute:** If > 10% of participants dispute the resolution → market enters `disputed` state immediately
- **Timeout fallback:** If neither threshold is reached after 48 hours → market is considered solved (dispute window expired)

## Solution

1. Track participant votes on proposer resolution (accept/dispute actions)
2. After each vote, recompute percentages: `accept_pct = accepts / total_participants`, `dispute_pct = disputes / total_participants`
3. If `accept_pct > 0.9` → trigger payout immediately, set status=closed
4. If `dispute_pct > 0.1` → set status=disputed, start community vote
5. Celery beat task: after 48h from `proposer_resolved` timestamp, if still in `proposer_resolved`, close with payout
