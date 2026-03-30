---
phase: 4
slug: real-time
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
updated: 2026-03-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 + pytest-asyncio 1.3.0 |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `cd backend && uv run pytest tests/test_socket.py -v` |
| **Full suite command** | `cd backend && uv run pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/test_socket.py -x`
- **After every plan wave:** Run `cd backend && uv run pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-T1 | 01 | 1 | RT-01..03 | unit (sio import) | `uv run pytest tests/test_socket.py -x` | ✅ | ✅ green |
| 4-01-T2 | 01 | 1 | RT-01..03 | unit (connect auth) | `uv run pytest tests/test_socket.py::TestConnectAuth -v` | ✅ | ✅ green |
| 4-02-T1 | 02 | 1 | RT-01 | unit (mock sio.emit) | `uv run pytest tests/test_socket.py::TestBetEmits::test_bet_emits_odds -x` | ✅ | ✅ green |
| 4-02-T2 | 02 | 1 | RT-01 | unit (mock + fake Redis NX) | `uv run pytest tests/test_socket.py::TestBetEmits::test_odds_throttle -x` | ✅ | ✅ green |
| 4-02-T3 | 02 | 1 | RT-02 | unit (mock sio.emit) | `uv run pytest tests/test_socket.py::TestCommentEmits::test_comment_emits -x` | ✅ | ✅ green |
| 4-02-T4 | 02 | 1 | RT-03 | unit (mock sio.emit) | `uv run pytest tests/test_socket.py::TestNotificationEmits::test_notification_emits -x` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Total: 7 tests collected, 7 passed**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend polling replaced with socket events | RT-01..03 | Requires running browser session | Open bet detail, NotificationBell, chat — verify no XHR polling in Network tab; only WebSocket frames |
| Reconnection recovery | RT-01 | Requires connection drop simulation | Disconnect Wi-Fi for 5s, reconnect — verify odds update arrives within 2s |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ PASSED 2026-03-30

---

## Validation Audit 2026-03-30

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

### Gap: test_odds_throttle PARTIAL → green

**Root cause:** `_get_redis()` is a module-level singleton. After `test_bet_emits_odds` ran, `_redis_client` was already set to that test's `FakeRedis` instance. Patching `aioredis.from_url` in `test_odds_throttle` had no effect — the singleton bypassed the patch. The throttle key was pre-set on a *different* `FakeRedis` than the one `_emit_odds_update` used.

**Fix:** Changed the patch target from `app.services.bet_service.aioredis.from_url` to `app.services.bet_service._get_redis` (the function that returns the singleton), ensuring the test's fake instance is used regardless of singleton state.
