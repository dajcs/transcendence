---
phase: 2
slug: core-betting
status: draft
nyquist_compliant: false
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
| 02-01 | economy-service | 1 | BET-03, BET-04, BET-05 | unit | `uv run pytest tests/test_economy.py -x -q` | Wave 0 | pending |
| 02-02 | markets-api | 1 | BET-01 | integration | `uv run pytest tests/test_markets.py -x -q` | Wave 0 | pending |
| 02-03 | bets-api | 1 | BET-02, BET-05 | integration | `uv run pytest tests/test_bets.py -x -q` | Wave 0 | pending |
| 02-04 | auth-bonus-fix | 1 | BET-06, BET-08 | integration | `uv run pytest tests/test_auth.py -x -q` | exists (tests missing) | pending |
| 02-05 | celery-beat | 2 | BET-07 | unit | `uv run pytest tests/test_tasks.py -x -q` | Wave 0 | pending |
| 02-06 | comments-api | 2 | DISC-01, DISC-02, DISC-03 | integration | `uv run pytest tests/test_comments.py -x -q` | Wave 0 | pending |
| 02-07 | frontend-markets | 3 | BET-01 | manual | Browser: create/list/detail markets | N/A | pending |
| 02-08 | frontend-bets | 3 | BET-02, BET-03 | manual | Browser: place and withdraw bets | N/A | pending |
| 02-09 | frontend-dashboard | 3 | BET-01–08 | manual | Browser: dashboard shows active bets, portfolio | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_economy.py` — stubs for BET-03 (withdrawal refund formula), BET-04 (bet cap formula), BET-05 (atomic deduction)
- [ ] `backend/tests/test_markets.py` — stubs for BET-01 (create market, deducts 1 bp)
- [ ] `backend/tests/test_bets.py` — stubs for BET-02 (place YES/NO bet), BET-05 (insufficient bp)
- [ ] `backend/tests/test_tasks.py` — stubs for BET-07 (daily allocation with asyncio.run pattern)
- [ ] `backend/tests/test_comments.py` — stubs for DISC-01 (list comments), DISC-02 (upvote +1 kp), DISC-03 (reply depth)

Existing `backend/tests/test_auth.py` needs additional test cases (not new file):
- [ ] `test_signup_bonus` — BET-06: register → user has +10 bp
- [ ] `test_daily_login_bonus` — BET-08: idempotent daily login bonus

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Market list/detail pages render | BET-01 | Frontend rendering | Navigate to /markets, click a market, verify detail page loads |
| Bet placement UI updates balance | BET-02 | Frontend state update | Place bet, verify bp decrements in real time |
| Portfolio summary on dashboard | BET-01–08 | Frontend aggregation | Go to /dashboard, verify active bets and points totals show |
| Comment threads display | DISC-01 | Frontend rendering | Navigate to market detail, post and view comments |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
