# Phase 5: Intelligence & Resolution - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Full resolution system (Tier 1 auto, Tier 2 proposer, Tier 3 community vote) + LLM-powered features (thread summarizer, resolution assistant). Resolution UI is inline on the market detail page. Phase also wires the socket events deferred from Phase 4 (`bet:resolved`, `dispute:*`).

OAuth, i18n, dark mode, and GDPR are Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Tier 1 Auto-Resolution
- **D-01:** Use Open-Meteo as the real proof-of-concept integration. Free, no API key required. Fetch historical weather for a given location + date. Bet creator supplies `resolution_source` as a structured JSON field: `{"provider": "open-meteo", "location": "Paris", "date": "2026-04-01", "condition": "rain"}`. Celery task at deadline + 5min fetches and maps to YES/NO.
- **D-02:** If Open-Meteo returns ambiguous data or any error → fall through to Tier 2 (proposer resolution). Failure is logged for audit. This is the only Tier 1 integration for v1.
- **D-03:** Tier 1 Celery task: `check_auto_resolution` runs every 5 minutes, finds bets where `deadline < now AND status = 'open'`. Processes each: call Open-Meteo if source configured, else escalate to Tier 2 directly.

### Tier 2 Proposer Resolution
- **D-04:** Resolution form appears inline on the market detail page, visible only to the proposer when `bet.status = 'pending_resolution'`. Fields: outcome (YES/NO radio), justification text (min 20 chars). "Get AI suggestion" button inline in this form (see LLM section).
- **D-05:** On submit: `POST /api/bets/{id}/resolve` → sets `bet.status = 'proposer_resolved'`, creates `Resolution` record (tier=2), starts 48h dispute window. Immediate payout is NOT triggered yet — payout runs after dispute window closes (or dispute resolves).
- **D-06:** 7-day proposer window: if proposer hasn't resolved within 7 days of deadline, Celery auto-escalates to Tier 3 by creating a system-opened dispute.

### Tier 3 Community Dispute
- **D-07:** Dispute section appears inline below the resolution section, visible to all bet participants when `bet.status = 'proposer_resolved'` and dispute window is open. Shows: current resolution outcome, window closes at (datetime), weighted vote tally (YES Xw / NO Yw).
- **D-08:** "Open Dispute — costs 1 bp" button for eligible participants. Requires: user has active position, hasn't disputed this bet, hasn't opened a dispute in last 24h globally.
- **D-09:** Voting: [Vote YES] [Vote NO] buttons visible to all users once a dispute is open. Weight calculation per RESOLUTION.md rules (0.5x own winning side, 1x neutral, 2x own losing side).
- **D-10:** Dispute resolution Celery task (`check_dispute_deadlines`): runs every 15 minutes. Finds disputes where `closes_at < now AND status = 'open'`. Checks participation minimum (1% of bet participants, min 1). If valid: apply weighted majority outcome. If invalid: restore original resolution. Trigger payout in both cases.

### Payout
- **D-11:** Payout (bp + tp) is triggered atomically after a bet reaches final CLOSED status (after dispute window or dispute resolution). Formula per ECONOMY.md: +1 bp per winner + `floor(t_win / t_bet * 100) / 100 tp`. All in one DB transaction. Emit `bet:resolved` socket event on close.
- **D-12:** Proposer penalty if overturned: -50% of staked bp (floor, can't go below 0). Applied in same payout transaction.

### LLM Features
- **D-13:** Thread Summarizer: "Summarize discussion" button below the comments section on bet detail page. Available to any authenticated user. Calls `POST /api/bets/{id}/summary`. Result shown inline below the button (replaces button with summary card + refresh link). Per-user limit: 5/day tracked in Redis (`llm_usage:summary:{user_id}:{date}` with EOD TTL).
- **D-14:** Resolution Assistant: "Get AI suggestion" button inside the proposer resolution form. Calls `POST /api/bets/{id}/resolution-hint`. Proposer provides evidence text (max 500 chars) in a textarea; LLM returns YES/NO + 1-2 sentence reasoning shown inline. Per-user limit: 3/day.
- **D-15:** LLM opt-out: toggle in user settings page (`/settings`). If opted out, buttons are hidden. Stored as `user.llm_opt_out` boolean in the users table (add column via migration).
- **D-16:** OpenRouter provider: `openai/gpt-4o-mini` as default (cost-effective, available). Fallback: `openai/gpt-3.5-turbo`. Monthly budget cap via `LLM_MONTHLY_BUDGET_USD` env var; tracked in Redis `llm_spend:{YYYY-MM}`. Graceful degradation when budget exceeded.
- **D-17:** Prompt injection prevention per LLM_INTEGRATION.md spec: user content in User: turn only, strip control chars, prepend override warning in System: turn, validate response (no code blocks, <500 chars).

### Socket Events (Phase 4 Deferred)
- **D-18:** Wire `bet:resolved` emit in payout service when bet closes. Payload: `{bet_id, outcome, payout_summary}`. Emits to `bet:{id}` room.
- **D-19:** Wire `dispute:opened`, `dispute:voted`, `dispute:closed` events. `dispute:opened` → `bet:{id}` room. `dispute:voted` → `bet:{id}` room (anonymized: just updated vote counts). `dispute:closed` → `bet:{id}` room with final outcome.
- **D-20:** Frontend: bet detail page listens for `bet:resolved` and `dispute:*` events. On `bet:resolved`: show payout banner + update status display. On `dispute:opened`: show dispute section. On `dispute:voted`: update weighted vote tally.

### Claude's Discretion
- Open-Meteo API response parsing and condition mapping logic
- Exact `check_auto_resolution` and `check_dispute_deadlines` Celery task scheduling intervals
- Whether `llm_opt_out` column lives in `users` table or a separate `user_settings` table
- LLM response caching strategy (don't re-call for same bet if summary already exists)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Resolution Logic
- `plan/RESOLUTION.md` — Full tier logic, state machine, vote weights, dispute validity, penalty rules, payout formulas, edge cases

### LLM Integration
- `plan/LLM_INTEGRATION.md` — Prompt templates, usage limits, budget cap, security rules, response validation, privacy rules

### Economy / Payout
- `plan/ECONOMY.md` — tp formula (`t_win / t_bet`), bp earning events, proposer penalty calculation

### Existing Models (already migrated)
- `backend/app/db/models/bet.py` — `Bet`, `Resolution`, `Dispute`, `DisputeVote` models already exist; check fields before adding new ones
- `backend/app/workers/tasks/daily.py` — Existing Celery task pattern to follow for new tasks

### Existing Frontend
- `frontend/src/app/(protected)/bets/[id]/page.tsx` — Bet detail page where resolution/dispute UI goes inline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/economy_service.py` — bp/tp transaction logic; payout function extends this pattern
- `backend/app/services/notification_service.py` — Fire-and-forget emit pattern (model for socket emit calls in resolution service)
- `backend/app/socket/server.py` — AsyncServer singleton `sio`; import for new emit calls
- `backend/app/api/deps.py` — JWT/cookie auth; reuse for LLM endpoint auth
- `frontend/src/store/` — Zustand store pattern for resolution/dispute state
- `frontend/src/lib/api.ts` — Axios singleton for LLM API calls

### Established Patterns
- Services raise `HTTPException`; socket emits are fire-and-forget (try/except, never block REST response)
- Routes are thin (delegate to service); all logic in service layer
- Celery tasks: `max_retries=1`, no retry backoff (per LLM_INTEGRATION.md, extend to resolution tasks too)
- Redis keys: `{namespace}:{entity_id}:{qualifier}` pattern (throttle, llm_usage, llm_spend)
- All DB writes in atomic transactions; payout MUST be a single transaction

### Integration Points
- `backend/app/workers/tasks/`: Add `resolution.py` for `check_auto_resolution` + `check_dispute_deadlines` tasks
- `backend/app/services/`: Add `resolution_service.py` and `llm_service.py`
- `backend/app/api/routes/`: Add `resolution.py` (proposer resolve, dispute open/vote, payout) and `llm.py` (summary, hint)
- `frontend/src/app/(protected)/bets/[id]/page.tsx`: Add `ResolutionSection` and `DisputeSection` components
- `frontend/src/app/(protected)/settings/page.tsx`: Add LLM opt-out toggle (page may need creating)
- `backend/app/db/models/user.py`: Add `llm_opt_out` boolean column + Alembic migration

</code_context>

<specifics>
## Specific Ideas

- Open-Meteo integration chosen: free, no API key, reliable. Bet creator sets structured `resolution_source` JSON (not arbitrary URL) to make parsing predictable.
- Resolution + dispute UI is inline on the market detail page (not separate routes). Same layout mockup: Resolution section → Dispute section, each collapsible.
- LLM buttons inline: "Summarize discussion" below comments; "Get AI suggestion" inside resolution form. Not a sidebar/panel.
- Socket events fully wired in this phase — completes the real-time module.

</specifics>

<deferred>
## Deferred Ideas

- Generic URL + JSONPath Tier 1 resolver — more flexible but significant extra scope; Open-Meteo proof-of-concept is sufficient for 42 module credit
- Additional Tier 1 data sources (sports APIs, NewsAPI) — can be added as plugins post-v1
- LLM caching (avoid re-calling for same bet summary) — Claude's discretion to implement if simple
- `global:trending_bet` socket room — already deferred to Phase 6/backlog in Phase 4

</deferred>

---

*Phase: 05-intelligence-resolution*
*Context gathered: 2026-03-30*
