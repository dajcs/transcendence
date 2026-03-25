---
phase: 2
slug: core-betting
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3+ with pytest-asyncio 0.24+ |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`, asyncio_mode="auto") |
| **Quick run command** | `cd backend && uv run pytest -x -q` |
| **Full suite command** | `cd backend && uv run pytest -q` |
| **Estimated runtime** | ~15 seconds (SQLite in-memory) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest -x -q`
- **After every plan wave:** Run `cd backend && uv run pytest -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Plan 02-01 Task 1 | 02-01 (Wave 0 stubs) | 1 | BET-01–08, DISC-01–03 | unit/stub | `uv run pytest tests/test_economy.py tests/test_markets.py tests/test_bets.py tests/test_tasks.py tests/test_comments.py -x -q` | Wave 0 creates these | pending |
| Plan 02-01 Task 2 | 02-01 (Wave 0 stubs) | 1 | BET-06, BET-08 | stub | `uv run pytest tests/test_auth.py -x -q` | exists (stubs appended) | pending |
| Plan 02-02 Task 1 | 02-02 (Economy service) | 1 | BET-03, BET-04, BET-05 | unit | `uv run pytest tests/test_economy.py -x -q` | Wave 0 | pending |
| Plan 02-02 Task 2 | 02-02 (Auth bonuses) | 1 | BET-06, BET-08 | integration | `uv run pytest tests/test_auth.py -x -q` | exists | pending |
| Plan 02-03 Task 1 | 02-03 (Markets API) | 2 | BET-01 | integration | `uv run pytest tests/test_markets.py -x -q` | Wave 0 | pending |
| Plan 02-04 Task 1 | 02-04 (Bets API) | 3 | BET-02, BET-03, BET-04, BET-05 | integration | `uv run pytest tests/test_bets.py -x -q` | Wave 0 | pending |
| Plan 02-05 Task 1 | 02-05 (Comments API) | 3 | DISC-01, DISC-02, DISC-03 | integration | `uv run pytest tests/test_comments.py -x -q` | Wave 0 | pending |
| Plan 02-05 Task 2 | 02-05 (Celery daily task) | 3 | BET-07 | unit | `uv run pytest tests/test_tasks.py -x -q` | Wave 0 | pending |
| Plan 02-06 Task 1 | 02-06 (Markets frontend) | 4 | BET-01 | automated + manual | `cd frontend && npm run build` + browser steps in plan | N/A | pending |
| Plan 02-06 Task 2 | 02-06 (Dashboard frontend) | 4 | BET-02, BET-03, DISC-01–03 | automated + manual | `cd frontend && npm run build` + browser steps in plan | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

Wave 0 is complete after **Plan 02-01** executes. The following files are created by Plan 02-01 Task 1 and Task 2:

- [ ] `backend/tests/test_economy.py` — stubs for BET-03 (withdrawal refund formula), BET-04 (bet cap formula), BET-05 (atomic deduction)
- [ ] `backend/tests/test_markets.py` — stubs for BET-01 (create market, deducts 1 bp)
- [ ] `backend/tests/test_bets.py` — stubs for BET-02 (place YES/NO bet), BET-05 (insufficient bp)
- [ ] `backend/tests/test_tasks.py` — stubs for BET-07 (daily allocation with asyncio.run pattern)
- [ ] `backend/tests/test_comments.py` — stubs for DISC-01 (list comments), DISC-02 (upvote +1 kp), DISC-03 (reply depth)

Existing `backend/tests/test_auth.py` needs additional test cases (not new file), added by Plan 02-01 Task 2:
- [ ] `test_signup_bonus` — BET-06: register → user has +10 bp
- [ ] `test_daily_login_bonus` — BET-08: idempotent daily login bonus

Set `wave_0_complete: true` in this file after Plan 02-01 completes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Market list/detail pages render | BET-01 | Frontend rendering | Navigate to /markets, click a market, verify detail page loads |
| Bet placement UI updates balance | BET-02 | Frontend state update | Place bet, verify bp decrements in real time |
| Portfolio summary on dashboard | BET-01–08 | Frontend aggregation | Go to /dashboard, verify active bets and points totals show |
| Comment threads display | DISC-01 | Frontend rendering | Navigate to market detail, post and view comments |

Full browser step-by-step instructions are embedded in Plan 02-06 Task 1 `<manual>` and Task 2 `<manual>` verify blocks.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
