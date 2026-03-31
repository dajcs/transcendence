---
phase: 5
slug: intelligence-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (backend) + vitest/jest (frontend) |
| **Config file** | `backend/pyproject.toml` (pytest section) |
| **Quick run command** | `cd backend && uv run pytest tests/ -x -q` |
| **Full suite command** | `cd backend && uv run pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && uv run pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | RES-01 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | RES-02 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | RES-03 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | RES-04 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | RES-05 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | RES-06 | unit | `uv run pytest tests/test_resolution.py -x -q` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | LLM-01 | unit | `uv run pytest tests/test_llm.py -x -q` | ❌ W0 | ⬜ pending |
| 05-04-02 | 04 | 2 | LLM-02 | unit | `uv run pytest tests/test_llm.py -x -q` | ❌ W0 | ⬜ pending |
| 05-04-03 | 04 | 2 | LLM-03 | unit | `uv run pytest tests/test_llm.py -x -q` | ❌ W0 | ⬜ pending |
| 05-04-04 | 04 | 2 | LLM-04 | unit | `uv run pytest tests/test_llm.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_resolution.py` — stubs for RES-01 through RES-06
- [ ] `backend/tests/test_llm.py` — stubs for LLM-01 through LLM-04
- [ ] `backend/tests/conftest.py` — update with resolution/LLM fixtures if needed

*Existing pytest infrastructure covers basic setup; Wave 0 adds resolution + LLM test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Community vote UI renders correctly | RES-05 | Browser rendering | Open market detail, submit dispute, verify vote UI appears |
| LLM summary displays in UI | LLM-01 | OpenRouter live call | Open bet with 5+ comments, trigger summary, verify text renders |
| LLM opt-out toggle persists | LLM-04 | Settings page interaction | Toggle opt-out in /settings, reload page, verify state persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
