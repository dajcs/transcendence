---
phase: 07
slug: 07-testing-stretch
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x, jest 29.x, Playwright 1.x |
| **Config file** | `backend/pyproject.toml`, `frontend/jest.config.ts`, `frontend/playwright.config.ts` |
| **Quick run command** | `make phase7-proof-backend` |
| **Full suite command** | `make phase7-proof` |
| **Estimated runtime** | ~300 seconds locally; heavy Docker E2E path varies by image/build cache state |

---

## Sampling Rate

- **After every task commit:** Run `make phase7-proof-backend` or `make phase7-proof-frontend` for the touched stack
- **After every plan wave:** Run `make phase7-proof`
- **Before `$gsd-verify-work`:** Full suite must be green, and TEST-04 evidence must come from either `make phase7-heavy` or the manual GitHub Actions E2E workflow
- **Max feedback latency:** 300 seconds for light proof; heavy E2E may exceed this and stays manual/on-demand

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-04-01 | 04 | 3 | TEST-01, TEST-02, TEST-03 | T-07-04-01 | Proof targets use workspace-local caches/install paths rather than stale checked-in environments | command/integration | `make phase7-proof-backend && make phase7-proof-frontend && make phase7-proof-e2e-list` | ✅ | ⬜ pending |
| 07-04-02 | 04 | 3 | TEST-01, TEST-02, TEST-03, TEST-04 | T-07-04-02 / T-07-04-03 | CI calls repo-owned proof targets; test-only helpers remain gated | workflow/config | `rg -n "make phase7-proof|make phase7-heavy|workflow_dispatch|pull_request|push" .github/workflows/ci.yml .github/workflows/e2e-manual.yml` | ✅ | ⬜ pending |
| 07-04-03 | 04 | 3 | TEST-01, TEST-02, TEST-03, TEST-04 | T-07-04-04 | Summary records real backend/frontend coverage evidence and concrete E2E proof source | end-to-end | `make phase7-proof` plus `make phase7-heavy` or a successful `workflow_dispatch` run of `E2E Manual` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/conftest.py` — shared async backend fixtures already exist
- [x] `frontend/jest.config.ts` — existing Jest infrastructure covers frontend unit/component tests
- [x] `frontend/playwright.config.ts` — Playwright infrastructure exists for the four critical flows

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heavy Docker-backed Playwright execution over the full app stack | TEST-04 | Requires Docker/Compose and browser runtime boot that is intentionally not mandatory on every local check | Run `make phase7-heavy` in a Docker-capable environment, or trigger `.github/workflows/e2e-manual.yml` via `workflow_dispatch` and record the successful run in `07-04-SUMMARY.md` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing infrastructure coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 300s for light proof commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
