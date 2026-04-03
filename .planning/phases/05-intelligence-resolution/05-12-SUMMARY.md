---
phase: 05-intelligence-resolution
plan: 12
subsystem: api
tags: [llm, openrouter, config, pydantic-settings]

requires:
  - phase: 05-intelligence-resolution
    provides: llm_service.py with call_openrouter, summarize_thread, get_resolution_hint

provides:
  - settings.openrouter_model field wired to OPENROUTER_MODEL env var
  - Both LLM call sites use runtime-configurable model instead of hardcoded constant

affects: [llm_service, config, openrouter]

tech-stack:
  added: []
  patterns:
    - "pydantic-settings field with default = env-configurable LLM model"

key-files:
  created: []
  modified:
    - backend/app/config.py
    - backend/app/services/llm_service.py

key-decisions:
  - "openrouter_model field added to LLM block in Settings; pydantic-settings maps OPENROUTER_MODEL env var via case_sensitive=False"
  - "_DEFAULT_MODEL constant retained as fallback default in call_openrouter signature — not replaced"

patterns-established:
  - "LLM model selection: settings.openrouter_model passed explicitly at call sites, _DEFAULT_MODEL only as signature default"

requirements-completed: [LLM-01, LLM-02]

duration: 5min
completed: 2026-04-02
---

# Phase 05 Plan 12: OPENROUTER_MODEL env var wired to both LLM call sites

**settings.openrouter_model field added to config.py and forwarded as model= kwarg at both call_openrouter call sites in llm_service.py**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T22:00:00Z
- **Completed:** 2026-04-02T22:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `openrouter_model: str = "openai/gpt-4o-mini"` to Settings LLM block — pydantic-settings picks up `OPENROUTER_MODEL` env var automatically
- `summarize_thread` now calls `call_openrouter(..., model=settings.openrouter_model, ...)`
- `get_resolution_hint` now calls `call_openrouter(..., model=settings.openrouter_model, ...)`
- `_DEFAULT_MODEL` constant preserved as default parameter in `call_openrouter` signature and fallback retry logic

## Task Commits

1. **Task 1: Add openrouter_model to Settings** - `036ed38` (feat)
2. **Task 2: Pass settings.openrouter_model at both call sites** - `435c332` (feat)

## Files Created/Modified
- `backend/app/config.py` - Added `openrouter_model: str = "openai/gpt-4o-mini"` to LLM block
- `backend/app/services/llm_service.py` - Updated 2 call sites to pass `model=settings.openrouter_model`

## Decisions Made
- `_DEFAULT_MODEL` constant not removed — still used as default parameter value in `call_openrouter` signature and as fallback model in retry logic (line 195)
- Field name lowercase snake_case (`openrouter_model`) maps to `OPENROUTER_MODEL` env var via pydantic-settings case_sensitive=False

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Set `OPENROUTER_MODEL=<model-id>` in `.env` to override the default `openai/gpt-4o-mini`.

## Next Phase Readiness
- LLM model is now runtime-configurable without code changes
- Setting `OPENROUTER_MODEL=anthropic/claude-3-haiku` in `.env` will route both summarizer and resolution hint calls to that model

---
*Phase: 05-intelligence-resolution*
*Completed: 2026-04-02*
