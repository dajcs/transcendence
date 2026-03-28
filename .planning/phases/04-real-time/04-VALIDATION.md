---
phase: 4
slug: real-time
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.3+ with pytest-asyncio 0.24+ |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `docker compose exec backend uv run pytest tests/test_socket.py -x` |
| **Full suite command** | `docker compose exec backend uv run pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend uv run pytest tests/test_socket.py -x`
- **After every plan wave:** Run `docker compose exec backend uv run pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-xx-01 | 01 | 0 | RT-01..03 | unit | `docker compose exec backend uv run pytest tests/test_socket.py -x` | ❌ W0 | ⬜ pending |
| 4-xx-02 | 01 | 1 | RT-01 | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_bet_emits_odds -x` | ❌ W0 | ⬜ pending |
| 4-xx-03 | 01 | 1 | RT-01 | unit (fake Redis) | `docker compose exec backend uv run pytest tests/test_socket.py::test_odds_throttle -x` | ❌ W0 | ⬜ pending |
| 4-xx-04 | 01 | 1 | RT-02 | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_comment_emits -x` | ❌ W0 | ⬜ pending |
| 4-xx-05 | 01 | 1 | RT-03 | unit (mock sio.emit) | `docker compose exec backend uv run pytest tests/test_socket.py::test_notification_emits -x` | ❌ W0 | ⬜ pending |
| 4-xx-06 | 01 | 1 | RT-01..03 | unit (mock environ) | `docker compose exec backend uv run pytest tests/test_socket.py::test_connect_auth -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_socket.py` — stubs for RT-01, RT-02, RT-03, connect auth
- [ ] `uv add "python-socketio[asyncio_client]"` — package not yet installed

*Note: python-socketio services tested by mocking `sio.emit` via `unittest.mock.AsyncMock`. The existing `fakeredis` fixture in conftest.py covers the Redis throttle key.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend polling replaced with socket events | RT-01..03 | Requires running browser session | Open bet detail, NotificationBell, chat — verify no XHR polling in Network tab; only WebSocket frames |
| Reconnection recovery | RT-01 | Requires connection drop simulation | Disconnect Wi-Fi for 5s, reconnect — verify odds update arrives within 2s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
