---
phase: 06-polish-compliance
fixed_at: 2026-04-10T00:00:00Z
review_path: .planning/phases/06-polish-compliance/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-04-10T00:00:00Z
**Source review:** .planning/phases/06-polish-compliance/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: User API key potentially leaked in LLM error response

**Files modified:** `backend/app/services/llm_service.py`, `backend/app/api/routes/llm.py`
**Commit:** 577696b
**Applied fix:**
- In `llm_service.py` line 176: replaced `str(exc)` with `str(exc).replace(api_key, "[REDACTED]")` before passing to `ProviderError`, ensuring the Gemini `?key=<api_key>` URL cannot leak via unexpected exception messages.
- In `llm.py` lines 86 and 138: changed both `HTTPException` detail strings from `f"{e.provider} {e.status}: {e.detail}"` to `f"{e.provider} error: {e.detail[:200]}"`, truncating error detail to 200 chars and removing the numeric status code (which could aid attackers in diagnosing provider internals).

### WR-01: Race condition in per-user LLM rate limiter (TOCTOU)

**Files modified:** `backend/app/api/routes/llm.py`
**Commit:** 95751e1
**Applied fix:** Removed both redundant pre-check blocks (the `r.get` + manual comparison before `check_and_increment_llm_usage`) from `create_summary` (lines 70-75) and `create_resolution_hint` (lines 122-127). Also removed the now-unused `from datetime import date` import. Rate limiting is now handled solely by the atomic `INCR` in `check_and_increment_llm_usage` inside the service functions.

### WR-02: Account deletion proceeds even if the API call fails

**Files modified:** `frontend/src/app/(protected)/settings/page.tsx`
**Commit:** 6156a09
**Applied fix:** Added `deleteError` state (`useState<string | null>(null)`). Added a `catch` block to the delete-account handler that sets `deleteError` with `t("settings.save_error")`. Added `setDeleteError(null)` at the start of the handler to clear stale errors. Added error display paragraph `{deleteError && <p ...>{deleteError}</p>}` below the button row. The spinner no longer stays stuck — `finally` still resets `setDeleting(false)`.

### WR-03: `positionsQuery` uses a global cache key, causing stale cross-market data

**Files modified:** `frontend/src/app/(protected)/markets/[id]/page.tsx`
**Commit:** e784037
**Applied fix:** Added `staleTime: 0` to the `positionsQuery` `useQuery` call. This ensures positions are always refetched on mount, preventing a user from briefly seeing a stale "You have a position" notice from a previously visited market.

### WR-04: Locale change in Settings does not match the `delete_confirm_word` check

**Files modified:** `frontend/src/app/(protected)/settings/page.tsx`, `frontend/src/i18n/fr.ts`, `frontend/src/i18n/de.ts`
**Commit:** 6d4fb5d
**Applied fix:** Changed the `disabled` condition on the delete button from `deleteConfirmText !== t("settings.delete_confirm_word")` to `deleteConfirmText !== "DELETE"` (hardcoded English word). Updated `fr.ts` placeholder from `"Tapez SUPPRIMER pour confirmer"` to `"Tapez DELETE pour confirmer"` and `de.ts` from `"Geben Sie LÖSCHEN zur Bestätigung ein"` to `"Geben Sie DELETE zur Bestätigung ein"`. This matches the common UX pattern of requiring the English word regardless of locale, eliminating the hydration-timing mismatch.

---

_Fixed: 2026-04-10T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
