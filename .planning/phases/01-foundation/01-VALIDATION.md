---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (backend); frontend testing in Phase 7 |
| **Config file** | `backend/pyproject.toml` — Wave 0 creates it |
| **Quick run command** | `docker compose exec backend uv run pytest tests/test_auth.py tests/test_config.py -x -q` |
| **Full suite command** | `docker compose exec backend uv run pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend uv run pytest tests/test_auth.py tests/test_config.py -x -q`
- **After every plan wave:** Run `docker compose exec backend uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green + smoke tests pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-infra-01 | infra | 1 | INFRA-01 | smoke | `docker compose ps` (all "healthy") | ❌ W0 | ⬜ pending |
| 1-infra-02 | infra | 1 | INFRA-02 | smoke | `curl -k https://localhost:8443/api/health` | ❌ W0 | ⬜ pending |
| 1-infra-03 | infra | 1 | INFRA-03 | smoke | `docker compose exec db pg_isready && docker compose exec redis redis-cli ping` | ❌ W0 | ⬜ pending |
| 1-infra-04 | infra | 1 | INFRA-04 | manual | `git status .env` returns "ignored"; `.env.example` tracked | ❌ W0 | ⬜ pending |
| 1-infra-05 | backend | 1 | INFRA-05 | unit | `uv run pytest tests/test_config.py::test_missing_env_var` | ❌ W0 | ⬜ pending |
| 1-auth-01 | backend | 2 | AUTH-01 | integration | `uv run pytest tests/test_auth.py::test_register` | ❌ W0 | ⬜ pending |
| 1-auth-02 | backend | 2 | AUTH-02 | integration | `uv run pytest tests/test_auth.py::test_login_sets_cookies` | ❌ W0 | ⬜ pending |
| 1-auth-03 | backend | 2 | AUTH-03 | integration | `uv run pytest tests/test_auth.py::test_password_reset_no_enumeration` | ❌ W0 | ⬜ pending |
| 1-auth-04 | backend | 2 | AUTH-04 | integration | `uv run pytest tests/test_auth.py::test_refresh_rotation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/__init__.py` — test package marker
- [ ] `backend/tests/conftest.py` — shared fixtures (async DB session, async test client)
- [ ] `backend/tests/test_config.py` — stubs for INFRA-05 (missing env var → exit 1)
- [ ] `backend/tests/test_auth.py` — stubs for AUTH-01 through AUTH-04
- [ ] `backend/pyproject.toml` `[tool.pytest.ini_options]` — `asyncio_mode = "auto"`
- [ ] Framework install: `uv add pytest pytest-asyncio httpx`

*Wave 0 must be committed before any functional code — creates the red/green feedback loop.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.env` is git-ignored; `.env.example` is tracked | INFRA-04 | Git status check, not automatable in unit test | Run `git status .env` (should show as ignored); `git status .env.example` (should be tracked) |
| Self-signed HTTPS cert accepted by curl with -k | INFRA-02 | Cert generation varies; cert validity requires manual confirm | `curl -k https://localhost:8443/api/health` returns 200 |
| Password reset token logged to stdout when SMTP unset | AUTH-03 | SMTP not available in eval; log fallback is runtime behavior | Start with `SMTP_HOST=` unset; call POST /auth/reset-request; check docker logs for reset URL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
