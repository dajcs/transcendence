---
status: partial
phase: 05-intelligence-resolution
source: [05-VERIFICATION.md]
started: 2026-04-02T09:30:00Z
updated: 2026-04-02T09:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Per-bet ETA scheduling smoke test
expected: Create a market with deadline = now+2 min. After deadline+5 min, Celery worker log shows resolve_market_at_deadline running for that bet_id. If no resolution_source, status becomes pending_resolution and a resolution_due notification appears on proposer's bell.
result: [pending]

### 2. LLM summarize and hint with real API key
expected: With OPENROUTER_API_KEY set in .env, clicking "Summarize discussion" on a market with 2+ comments returns plain-text summary (no code fences, under 2200 chars). "Get AI hint" for proposer returns YES/NO reasoning. After 5 summary calls, next call returns error/disabled state.
result: [pending]

### 3. Budget cap enforcement
expected: Set LLM_MONTHLY_BUDGET_USD=0.0001. After one LLM call, subsequent calls return 503 (budget exceeded).
result: [pending]

### 4. Socket events reach browser from Celery
expected: Open market detail page in two browser tabs. Trigger resolution (or wait for Celery auto-resolve). Other tab shows payout banner/status update without refresh — validates Redis pub/sub cross-process delivery.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
