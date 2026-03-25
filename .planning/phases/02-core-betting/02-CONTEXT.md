# Phase 2: Core Betting - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create markets, place YES/NO bets, discuss, and earn karma. Delivers:
Market CRUD, betting (place/withdraw with odds), points economy with Celery daily
allocation, comment threads with upvotes, and a personal dashboard.

Resolution (Tiers 1–3), social features, and real-time updates are separate phases.

</domain>

<decisions>
## Implementation Decisions

### UI Design Level
- **D-01:** Functional Tailwind utilities only — no custom design tokens, no visual polish. Visual design (PLANNING.md color scheme, Inter/JetBrains Mono fonts, shadows) is deferred to Phase 6. Phase 2 ships features, not aesthetics.

### Markets Feed & List
- **D-02:** Default sort: deadline soonest first (ascending). One-click sort toggle for "Most active" (by position count) and "Newest" — sort buttons in the list header, no dropdown needed.
- **D-03:** Filter tabs: All / Open / Resolved. Three tabs, no more. "Mine" tab deferred to dashboard.
- **D-04:** Pagination: simple Previous/Next page buttons. No infinite scroll (conflicts with Phase 4 real-time approach).

### Market Creation Form
- **D-05:** Form fields: title, description, resolution_criteria, deadline. resolution_source is hidden — Tier 1 auto-resolution is Phase 5.
- **D-06:** Creating a market costs 1 bp (deducted atomically, same pattern as bet placement). Must have bp > 0 before submitting. ECONOMY.md does not specify this cost; user confirmed 1 bp.
- **D-07:** Any authenticated user can create a market. No role restrictions.

### Balance Computation
- **D-08:** bp/kp/tp balances computed via SUM aggregation from ledger tables on every request. No denormalized balance columns on User — ledger is the single source of truth. Add index on (user_id) for bp_transactions, tp_transactions, kp_events if not already present.
- **D-09:** kp is computed from kp_events. No kp_balance column on User. Celery daily task: SUM kp_events for each user → credit floor(log10(kp+1)) bp → insert negative kp reset event. Pure ledger.

### Points Economy (Celery Tasks)
- **D-10:** Celery daily task runs at 00:00 UTC: compute karma_bp per user, insert bp_transaction (+karma_bp), insert kp reset event (large negative). Formula: floor(log10(kp + 1)) as specified in ECONOMY.md.
- **D-11:** Sign-up bonus (+10 bp) credited as a bp_transaction at registration. Daily login bonus (+1 bp) credited as a bp_transaction on first authenticated request of the day (backend checks last_login date).

### Betting Mechanics
- **D-12:** Odds displayed as simple pool probability: yes_pct = yes_pool / (yes_pool + no_pool). Shown as percentage. Pool = SUM(bp_staked) for each side.
- **D-13:** Withdrawal refund: refund_bp = round(current_winning_probability_of_position, 2) as specified in ECONOMY.md. Withdrawn positions are excluded from pool calculations immediately.
- **D-14:** Bet placement and market creation use SELECT FOR UPDATE on user row to prevent double-spend. bp balance check + deduction in a single DB transaction.

### Comment Threads
- **D-15:** 1-level deep replies (parent_id supported in Comment model). Flat render with visual indent for replies. No collapse/expand — keep it simple.
- **D-16:** Upvoting a comment earns +1 kp for the author. Self-upvotes blocked by unique constraint (comment_id, user_id on comment_upvotes). Implemented as atomic insert — duplicate = no-op with 409 response.

### Dashboard
- **D-17:** Dashboard shows: user's active bets (market title, side, bp staked, current odds), portfolio summary (total bp, total tp, total kp as of today), and recent resolved bets. No notification feed in Phase 2 (Phase 3).

### Claude's Discretion
- Exact pagination page size (suggest 20 markets/page)
- Sort button UI placement and styling
- Comment timestamp formatting (relative vs absolute)
- Dashboard portfolio card layout details
- Error and empty state messages

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Economy & Betting Logic
- `plan/ECONOMY.md` — Points formulas (kp, bp, tp), daily allocation, withdrawal refund, bet cap, anti-gaming rules, all edge cases

### UX Flows & Pages
- `plan/PLANNING.md` §2–5 — User flows (new user, returning user, market lifecycle), key pages list, architecture overview, directory structure

### Database Schema
- `plan/DATABASE.md` — Full table definitions with concurrency model (SELECT FOR UPDATE pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/db/models/bet.py` — Bet, BetPosition, PositionHistory, Resolution, Dispute, Comment, CommentUpvote models all defined and migrated
- `backend/app/db/models/transaction.py` — BpTransaction, TpTransaction, KpEvent all defined
- `backend/app/db/models/user.py` — User model (no balance columns — correct)
- `backend/app/db/session.py` — Async SQLAlchemy session factory (reuse for all new services)
- `backend/app/api/deps.py` — Auth dependency injection (reuse for all protected routes)

### Established Patterns
- Services in `backend/app/services/` (auth_service.py pattern: class-based, async methods)
- Routes in `backend/app/api/routes/` (auth.py pattern: APIRouter, Depends for auth)
- Schemas in `backend/app/schemas/` (Pydantic v2)
- Frontend: only auth pages + dashboard placeholder exist; markets/ directory not yet created
- JWT auth via httpOnly cookies — no tokens in JS (D-08 from Phase 1)

### Integration Points
- New routes (markets.py, bets.py, comments.py) mount in `backend/app/main.py`
- Celery tasks go in `backend/app/workers/` (directory exists from Phase 1 scaffold)
- Frontend market pages: `frontend/src/app/(protected)/markets/` (under protected route group)
- Dashboard already has a placeholder at `frontend/src/app/(protected)/dashboard/`
- Daily login bonus check: extend the `/api/auth/me` handler or add middleware (check last_login date vs today)

</code_context>

<specifics>
## Specific Ideas

- Market creation costs 1 bp — user explicitly confirmed, overrides ECONOMY.md silence on this
- Sort toggle on markets list: three buttons (Deadline / Active / Newest), not a dropdown
- Dashboard shows portfolio totals as of today (live SUM), not a historical snapshot

</specifics>

<deferred>
## Deferred Ideas

- resolution_source field in market creation form — Phase 5 (Tier 1 auto-resolution)
- "Mine" filter tab on markets list — dashboard covers this use case
- Redis caching of balances — not needed until scale requires it
- Visual polish / design system (PLANNING.md color tokens) — Phase 6

</deferred>

---

*Phase: 02-core-betting*
*Context gathered: 2026-03-25*
