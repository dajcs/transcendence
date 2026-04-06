---
status: resolved
phase: 05-intelligence-resolution
source: [05-VERIFICATION.md]
started: 2026-04-02T09:30:00Z
updated: 2026-04-03T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Per-bet ETA scheduling smoke test
expected: Create a market with deadline = now+2 min. After deadline+5 min, Celery worker log shows resolve_market_at_deadline running for that bet_id. If no resolution_source, status becomes pending_resolution and a resolution_due notification appears on proposer's bell.
result: pass

### 2. LLM summarize and hint with real API key
expected: With OPENROUTER_API_KEY set in .env, clicking "Summarize discussion" on a market with 2+ comments returns plain-text summary (no code fences, under 2200 chars). "Get AI hint" for proposer returns YES/NO reasoning. After 5 summary calls, next call returns error/disabled state.
result: pass
notes: "Spec changes identified: (1) OPENROUTER_MODEL env var should select model when set; (2) AI response is markdown — UI should render it as markdown not plain text"

### 3. Budget cap enforcement
expected: Set LLM_MONTHLY_BUDGET_USD=0.0001. After one LLM call, subsequent calls degrade gracefully — no LLM summary is returned and the UI shows "Summary unavailable — monthly AI budget exceeded." instead of a generic error.
result: pass
notes: "Spec updated: implementation degrades gracefully (returns null) rather than raising 503. Frontend now shows specific reason strings per error code (503 → budget exceeded, 429 → daily limit reached)."

### 4. Socket events reach browser from Celery
expected: Open market detail page in two browser tabs. Trigger resolution (or wait for Celery auto-resolve). Other tab shows status update (pending_resolution → proposer_resolved) without refresh; after full payout, shows payout banner — validates Redis pub/sub cross-process delivery.
result: skipped
notes: "Requires full Docker stack with Celery worker + Beat + Redis running. Redesigned: (1) ETA task_id now stored on Bet.celery_task_id for revocation; (2) bet:status_changed socket event emitted on every state transition (pending_resolution, proposer_resolved, disputed); (3) 5-min sweep (check_auto_resolution) is safety net for lost ETA tasks. Frontend listens for bet:status_changed and refreshes market state without polling."

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "OPENROUTER_MODEL env var should control which model is used for LLM calls"
  status: resolved
  reason: "User reported: spec change — when OPENROUTER_MODEL is set in .env that model should be used"
  severity: major
  test: 2
  root_cause: "OPENROUTER_MODEL is in .env/.env.example but Settings class in config.py has no openrouter_model field; call_openrouter always uses _DEFAULT_MODEL constant"
  artifacts:
    - path: "backend/app/config.py:37-38"
      issue: "openrouter_model field missing from Settings"
    - path: "backend/app/services/llm_service.py:22"
      issue: "_DEFAULT_MODEL hardcoded, never reads from settings"
    - path: "backend/app/services/llm_service.py:257"
      issue: "summarize_thread calls call_openrouter without model arg"
    - path: "backend/app/services/llm_service.py:329"
      issue: "get_resolution_hint calls call_openrouter without model arg"
  missing:
    - "Add openrouter_model: str = 'openai/gpt-4o-mini' to Settings in config.py"
    - "Pass model=settings.openrouter_model in call_openrouter calls in summarize_thread and get_resolution_hint"

- truth: "AI response content (summary, hint) should be rendered as markdown in the UI"
  status: resolved
  reason: "User reported: spec change — AI response is markdown formatted, the display should render the markdown formatting"
  severity: minor
  test: 2
  root_cause: "Summary (line 864) and hint (line 572) rendered as raw text nodes in plain elements; react-markdown not installed"
  artifacts:
    - path: "frontend/src/app/(protected)/markets/[id]/page.tsx:864"
      issue: "summary rendered as <p>{summary}</p>, no markdown parsing"
    - path: "frontend/src/app/(protected)/markets/[id]/page.tsx:572"
      issue: "hint rendered as plain {hint} text node"
  missing:
    - "npm install react-markdown"
    - "Wrap summary and hint in <ReactMarkdown className='prose prose-sm max-w-none'>"
