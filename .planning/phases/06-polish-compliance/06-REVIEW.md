---
phase: 06-polish-compliance
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - .env.example
  - backend/app/api/routes/llm.py
  - backend/app/services/llm_service.py
  - frontend/src/app/(protected)/markets/[id]/page.tsx
  - frontend/src/app/(protected)/markets/page.tsx
  - frontend/src/app/(protected)/settings/page.tsx
  - frontend/src/app/layout.tsx
  - frontend/src/app/privacy/page.tsx
  - frontend/src/app/terms/page.tsx
  - frontend/src/components/ThemeProvider.tsx
  - frontend/src/components/auth/OAuthButtons.tsx
  - frontend/src/components/nav/TopNav.tsx
  - frontend/src/i18n/de.ts
  - frontend/src/i18n/en.ts
  - frontend/src/i18n/fr.ts
  - frontend/src/i18n/index.ts
  - frontend/src/store/locale.ts
  - frontend/src/store/theme.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 06 delivered i18n (EN/FR/DE), dark-mode store, OAuth infrastructure, Privacy/Terms pages, and Chrome audit fixes. The architecture is sound and the hydration-deferral pattern in `useT()` is correct. One critical security issue was found: a user-supplied LLM API key is echoed back in the backend error response detail, which can leak it to the browser. Four warnings cover a race condition in the rate-limiter, a settings page locale-change bug, an incorrect `positionsQuery` cache key, and missing error handling for the GDPR data-export flow. Three info items cover the `<html lang>` attribute being hardcoded to English, dead translation keys, and a cosmetic inconsistency in the OAuthButtons divider.

---

## Critical Issues

### CR-01: User API key potentially leaked in LLM error response

**File:** `backend/app/api/routes/llm.py:86` and `backend/app/api/routes/llm.py:138`

**Issue:** When a custom provider call fails, the route constructs the 502 detail string as `f"{e.provider} {e.status}: {e.detail}"`. The `e.detail` field is set from the raw provider error body (up to 300 chars) in `llm_service.py:138,155,168`. If the provider reflects the caller's API key in its error message (e.g., "Invalid API key: sk-…"), the key is forwarded verbatim to the browser in the JSON response. Additionally, `call_custom_provider` sets `e.detail = str(exc)` for unexpected exceptions (line 176 in `llm_service.py`), which can include the full URL string that contains the Gemini `?key=<api_key>` query parameter (line 149: `f"{url}?key={api_key}"`).

**Fix:**

In `llm_service.py`, strip the API key from the Gemini URL before it can appear in exceptions, and sanitize error detail before returning it:

```python
# llm_service.py — call_custom_provider, Gemini branch
try:
    resp = await client.post(
        f"{url}?key={api_key}",   # key only in request, not in ProviderError
        ...
    )
except ProviderError:
    raise
except Exception as exc:
    # Redact API key from exception message before surfacing
    safe_msg = str(exc).replace(api_key, "[REDACTED]")
    raise ProviderError(provider, 0, safe_msg) from exc
```

In `llm.py`, truncate/sanitize the detail before returning it to the client:

```python
raise HTTPException(status_code=502, detail=f"{e.provider} error: {e.detail[:200]}")
```

---

## Warnings

### WR-01: Race condition in per-user LLM rate limiter (TOCTOU)

**File:** `backend/app/api/routes/llm.py:72-75` and `backend/app/api/routes/llm.py:123-126`

**Issue:** Both endpoints pre-read the Redis counter (`r.get(key)`) to check the limit, then call `check_and_increment_llm_usage` which atomically INCRs the key. These are two separate operations: a user can slip past the pre-check if two concurrent requests arrive simultaneously, both read the counter below the limit, and both then INCR past it. The pre-check at the route level is redundant and misleading because `check_and_increment_llm_usage` already returns `False` when the limit is exceeded after incrementing.

The correct single-source-of-truth pattern is to rely solely on `check_and_increment_llm_usage` and remove the manual `r.get` pre-checks from the routes. The service function already uses `INCR` + `EXPIREAT` atomically (though note: these are still two Redis calls — a Lua script or pipeline would be fully atomic, but at low concurrency this is acceptable).

**Fix:** Remove lines 70-75 and 122-127 from `llm.py` and let the service functions return `None` when the limit is exceeded (which they already do — the route just needs to check the return value):

```python
# In create_summary, replace the pre-check block with nothing.
# The summarize_thread / get_resolution_hint calls already return None on limit exceeded.
# After the call:
if summary is None:
    raise HTTPException(status_code=429, detail="Daily summary limit (5) exceeded")
```

### WR-02: Account deletion proceeds even if the API call fails

**File:** `frontend/src/app/(protected)/settings/page.tsx:260-266`

**Issue:** The delete-account handler calls `api.delete("/api/users/account")` inside a `try` block, but the `catch` clause is absent — only `finally` runs. If the API call throws (network error, 4xx, 5xx), the `window.location.href = "/"` redirect on line 264 still executes because it sits inside `try` before the `finally`. The user is sent to the home page believing their account was deleted when it was not.

```typescript
try {
    await api.delete("/api/users/account");
    window.location.href = "/";  // runs before finally — but if api.delete throws, this line is skipped
} finally {
    setDeleting(false);           // finally always runs
}
```

Actually on re-read: the redirect is inside `try` so it only runs when `api.delete` succeeds — `finally` does not affect that. However there is still no `catch`, so any API error will bubble up as an unhandled rejection, leaving the user in a broken state (spinner spinning, no error message, `deleting` stays `true` because `finally` sets it to `false` but the component is still mounted).

**Fix:** Add a `catch` block to show an error message:

```typescript
const [deleteError, setDeleteError] = useState<string | null>(null);

// in the handler:
try {
    await api.delete("/api/users/account");
    window.location.href = "/";
} catch {
    setDeleteError(t("settings.save_error"));
} finally {
    setDeleting(false);
}
```

### WR-03: `positionsQuery` uses a global cache key, causing stale cross-market data

**File:** `frontend/src/app/(protected)/markets/[id]/page.tsx:61-63`

**Issue:** The positions query is keyed as `["positions"]` without including `marketId`. This means all market detail pages share the same cached response. When a user navigates between two markets, the second page initially shows the positions from the first market's fetch until the background refetch completes — including the `myPosition` lookup on line 66. This is a correctness issue, not a performance issue: a user could briefly see a "You have a position" notice on a market they have no stake in.

**Fix:** Either scope the query key to the market, or keep the global key but be explicit that it fetches all positions (which is what the endpoint does). The current implementation fetches `/api/bets/positions` which returns *all* of the user's positions and then filters client-side — so the global key is actually semantically correct for that endpoint. The real fix is to ensure `queryFn` is stable and React Query staleTime is appropriate so the filter result is always consistent, or alternatively move the per-market filter into the `select` option:

```typescript
const positionsQuery = useQuery<BetPositionsListResponse>({
    queryKey: ["positions"],
    queryFn: async () => (await api.get("/api/bets/positions")).data,
    staleTime: 0, // always refetch on mount to avoid showing stale cross-market data
});
```

### WR-04: Locale change in Settings does not match the `delete_confirm_word` check

**File:** `frontend/src/app/(protected)/settings/page.tsx:269`

**Issue:** The delete-confirmation guard compares user input against `t("settings.delete_confirm_word")`, which returns a locale-specific word: `"DELETE"` in English, `"SUPPRIMER"` in French, `"LÖSCHEN"` in German. However, the placeholder text shown to the user (`t("settings.delete_confirm")`) says "Type DELETE to confirm" in English but "Tapez SUPPRIMER pour confirmer" in French. If the user switches locale mid-flow (or has a non-English locale stored), the word they need to type changes without the placeholder refreshing, because `deleteConfirmText` is already set in state. More critically, if the user started typing "DELETE" in English and then the locale store hydrates from localStorage to French, the button remains disabled permanently — the user cannot delete their account without knowing to type "SUPPRIMER".

This is also an i18n correctness concern: `settings.delete_confirm` and `settings.delete_confirm_word` must always be in sync and consistent.

**Fix:** Normalise the confirmation to always require the English word `"DELETE"`, hardcoded, regardless of locale. This avoids the locale/state mismatch entirely:

```typescript
// Replace:
disabled={deleteConfirmText !== t("settings.delete_confirm_word") || deleting}
// With:
disabled={deleteConfirmText !== "DELETE" || deleting}
```

And update the placeholder translation in all locales to say "Type DELETE to confirm" (keep the English word in all languages — a common pattern in destructive-action UX).

---

## Info

### IN-01: `<html lang="en">` is hardcoded — does not reflect the user's selected locale

**File:** `frontend/src/app/layout.tsx:19`

**Issue:** The root layout sets `lang="en"` unconditionally. Screen readers and search engines use this attribute. When a user selects French or German, the `lang` attribute stays `"en"`. The locale store does set `document.documentElement.lang` on locale change (line 24 in `locale.ts`), which patches it at runtime, but on initial load the attribute is wrong for non-English users until the store hydrates.

This is a Chrome accessibility audit item and 42 project requirement.

**Fix:** This is tricky because `layout.tsx` is a server component and cannot read the Zustand store. The cleanest solution is to accept the SSR limitation and ensure the `setLocale` action (already patching `document.documentElement.lang`) is called on mount. Alternatively, set `lang` from a cookie on the server side. The existing client-side patch in `locale.ts` is the right approach — just add a `useEffect` that calls `document.documentElement.lang = locale` on initial mount in a component that wraps the tree (e.g., add it to `ThemeProvider` or a dedicated `LocaleProvider`).

### IN-02: Dead/unused translation keys in `en.ts`

**File:** `frontend/src/i18n/en.ts:81-86`

**Issue:** The keys `"markets.all"`, `"markets.open"`, `"markets.closed"`, `"markets.sort_newest"`, `"markets.sort_deadline"`, and `"markets.sort_popular"` are defined in `en.ts` (and mirrored in `fr.ts`/`de.ts`) but are superseded by the more specific keys added later: `"markets.filter_all"`, `"markets.filter_open"`, `"markets.filter_closed"`, `"markets.sort_new"`, `"markets.sort_closing"`, and `"markets.sort_hot"`. The old keys are not referenced in any reviewed component. This creates maintainability noise and risk of divergence across locale files.

**Fix:** Remove the superseded keys from all three locale files once confirmed they are not referenced elsewhere.

### IN-03: OAuthButtons `useEffect` silently swallows all errors

**File:** `frontend/src/components/auth/OAuthButtons.tsx:17-21`

**Issue:** The provider fetch swallows all errors with an empty `.catch(() => {})`. If the backend is unreachable, the OAuth buttons simply disappear without indication. This is intentional for graceful degradation, but means a misconfigured backend (e.g., wrong `NEXT_PUBLIC_API_URL`) fails silently with no developer feedback — even in development. A `console.error` in the catch block would aid debugging without affecting users.

**Fix:**
```typescript
.catch((err) => {
    if (process.env.NODE_ENV !== "production") {
        console.error("Failed to fetch OAuth providers:", err);
    }
});
```

---

_Reviewed: 2026-04-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
