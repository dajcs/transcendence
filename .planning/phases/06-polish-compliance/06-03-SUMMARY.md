---
phase: 06-polish-compliance
plan: 03
status: complete
---

# 06-03 Summary: Chrome Audit Pass + OAuth Verification

## What was built

- Dark mode inputs fixed: LoginForm.tsx and RegisterForm.tsx all inputs have `dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100`
- Hydration warning fixed: `suppressHydrationWarning` confirmed on `<html>` and `<body>` in layout.tsx
- ThemeToggle hydration mismatch fixed: deferred icon render until mounted
- Replaced next-themes with custom `useThemeStore` (Zustand) — eliminates React 19 script-in-component warning
- Locale hydration mismatch fixed: `useT()` defers to "en" until mounted
- Footer added to root layout with Privacy Policy and Terms of Service links
- "Back to home" links on /privacy and /terms redirect to /dashboard when authenticated
- LLM provider errors now propagated as HTTP 502 with detail instead of silent "unavailable"
- Response length validation removed from `validate_response` (was blocking valid responses >500 chars)

## Checkpoint verification: approved

User verified:
- Dark mode toggle works
- Language switcher EN/FR/DE updates UI without full reload
- /privacy and /terms render in selected language
- Footer links to /privacy and /terms visible on all pages
- GDPR export and delete buttons present on /settings
- Zero console errors on main pages

## Key files

- `frontend/src/store/theme.ts` (new) — Zustand theme store with localStorage + DOM class sync
- `frontend/src/i18n/index.ts` — mounted-deferred locale, eager dict imports
- `frontend/src/components/ThemeProvider.tsx` — replaced next-themes with custom store
- `frontend/src/app/layout.tsx` — blocking theme script in head, footer links
- `backend/app/services/llm_service.py` — ProviderError class, no length limit
- `backend/app/api/routes/llm.py` — catches ProviderError, returns 502 with detail
