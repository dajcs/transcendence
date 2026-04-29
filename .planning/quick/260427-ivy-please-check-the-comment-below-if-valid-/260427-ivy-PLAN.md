---
type: quick
id: 260427-ivy
description: Validate and fix bet placement after market deadline
files_modified:
  - backend/app/services/bet_service.py
  - backend/tests/test_bets.py
autonomous: true
---

<objective>
Validate the bug report and fix bet placement so an open market with a past deadline no longer accepts new positions while waiting for Celery/beat resolution.

Purpose: Market status can remain "open" until the background sweep runs, but the betting deadline itself must be authoritative at write time.
Output: A focused regression test and a service-level deadline guard in bet placement.
</objective>

<context>
@.planning/STATE.md
@AGENTS.md
@backend/app/services/bet_service.py
@backend/tests/test_bets.py

Relevant existing contracts:
- `place_bet(db, user_id, data)` in `backend/app/services/bet_service.py` loads `Market`, currently rejects only when `market.status != "open"`, then deducts BP and creates `MarketPosition`.
- `backend/tests/test_bets.py::test_place_bet_rejects_open_market_after_deadline` sets `market.status = "open"` and `market.deadline = datetime.now(timezone.utc) - timedelta(minutes=1)`, then expects `POST /api/bets` to return `409`.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Confirm the missed-deadline regression</name>
  <files>backend/tests/test_bets.py</files>
  <behavior>
    - An open market with `deadline` before the current UTC time rejects `POST /api/bets`.
    - The response status is `409`.
    - The response detail remains `Market is not open for betting` to preserve the existing closed-market API contract.
  </behavior>
  <action>
Run the existing focused regression test before changing production code. If the test is missing in this checkout, add `test_place_bet_rejects_open_market_after_deadline` beside `test_place_bet_rejects_closed_market` using the existing `_setup_user_with_market` helper, `db_session`, `select(Market)`, and `datetime.now(timezone.utc) - timedelta(minutes=1)`. Do not add broader Celery, market-resolution, or frontend coverage; this quick task is only the bet placement deadline guard.
  </action>
  <verify>
    <automated>DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_bets.py::test_place_bet_rejects_open_market_after_deadline -q</automated>
  </verify>
  <done>The focused test fails before the service fix because an open-but-expired market still accepts a bet, or the test already exists and is confirmed as the regression guard.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Enforce the market deadline in bet placement</name>
  <files>backend/app/services/bet_service.py, backend/tests/test_bets.py</files>
  <behavior>
    - `place_bet` rejects when `market.status != "open"`.
    - `place_bet` also rejects when `market.deadline <= now` even if `market.status == "open"`.
    - Deadline comparison is timezone-safe for aware UTC datetimes and does not weaken duplicate bet, cap, or insufficient BP behavior.
  </behavior>
  <action>
Update `place_bet` in `backend/app/services/bet_service.py` so the initial market availability guard checks both status and deadline before duplicate-position lookup or BP deduction. Use the existing `datetime` and `timezone` imports to compare against `datetime.now(timezone.utc)`. Keep the existing `HTTPException(status_code=409, detail="Market is not open for betting")` response for both non-open and expired markets to avoid changing the API contract. If SQLAlchemy returns a naive deadline in the SQLite test path, normalize it to UTC before comparison rather than allowing a naive/aware datetime `TypeError`.
  </action>
  <verify>
    <automated>DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_bets.py -q</automated>
  </verify>
  <done>Expired open markets reject new bets with 409 before any BP transaction or position insert, while the full bet test module passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> bets API -> bet service | Authenticated client input attempts to create a market position and spend BP. |
| app clock -> deadline enforcement | Server-side UTC time determines whether a write is still allowed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260427-ivy-01 | T | `place_bet` | mitigate | Check `market.deadline` against server UTC time before BP deduction and position creation. |
| T-260427-ivy-02 | R | `place_bet` | accept | Existing BP transaction and position records remain the audit trail for accepted bets; rejected expired attempts do not create ledger entries. |
</threat_model>

<verification>
Run the focused regression first to confirm the report, then rerun `backend/tests/test_bets.py` after the fix. No frontend, Celery, scheduler, or market resolution changes are in scope.
</verification>

<success_criteria>
- A market whose deadline has passed rejects new bets even when its status is still `open`.
- Rejection happens before duplicate-position lookup side effects, BP deduction, `MarketPosition`, or `MarketPositionHistory` creation.
- Existing closed-market rejection behavior and response text remain unchanged.
- `backend/tests/test_bets.py` passes.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-ivy-please-check-the-comment-below-if-valid-/260427-ivy-SUMMARY.md`.
</output>
