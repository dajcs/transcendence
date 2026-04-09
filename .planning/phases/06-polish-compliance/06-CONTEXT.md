# Phase 6: polish-compliance - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

i18n (EN/FR/DE), OAuth 2.0 (Google/GitHub/42 PKCE), Privacy Policy + Terms of Service pages, GDPR (data export + account deletion), dark mode, and Chrome compliance (zero console errors). Most of this is already implemented across branches — phase 6 planning focuses on consolidation, gap closure, and verification.

</domain>

<decisions>
## Implementation Decisions

### Branch Consolidation
- **D-01:** Merge `imp/i18n` and `fix/polish` into `fix/ph6` using `git merge` (preserves full history with merge commits). Do this before any gap-closure work so the working branch reflects the full implemented state. In case of conflicts, prioritize `fix/ph6` changes.
  - `imp/i18n` — adds useT() hook + EN/FR/DE dictionaries + 20+ wired pages
  - `fix/polish` — adds dark mode color variants for market and settings pages

### Claude's Discretion
The following were not discussed — Claude has flexibility during planning:
- **i18n completeness**: Check whether privacy/terms pages and backend validation error messages have translations. Add missing strings as needed.
- **Chrome audit**: Run a Chrome console audit after merges; fix any hydration warnings, dark mode flicker, or React errors found.
- **OAuth smoke-testing**: Verify Google/GitHub/42 OAuth flows work end-to-end in the Docker environment using credentials from `.env`.
- **42 evaluation polish**: Any cosmetic fixes needed for a clean evaluator walkthrough.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth & OAuth
- `plan/AUTH.md` — OAuth 2.0 + JWT flow, PKCE strategy, provider credentials

### Privacy & GDPR
- `plan/PRIVACY.md` — GDPR data handling, export spec, pseudonymization approach

### Compliance
- `plan/PLANNING.md` — UX flows, pages, Chrome compatibility requirements

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-05, COMP-01 through COMP-06 define acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/oauth_service.py` — OAuth provider abstraction (Google, GitHub, 42)
- `backend/app/services/gdpr_service.py` — Data export + account deletion with pseudonymization
- `backend/app/api/routes/auth.py` — OAuth routes at `/oauth/providers`, `/oauth/{provider}`, `/oauth/callback`
- `frontend/src/components/ThemeProvider.tsx` — next-themes provider (dark mode, attribute="class")
- `frontend/src/app/privacy/page.tsx` — Privacy Policy page (exists, translation status unknown)
- `frontend/src/app/terms/page.tsx` — Terms of Service page (exists, translation status unknown)

### Established Patterns
- Dark mode via Tailwind `dark:` class variants (22+ files already using it on fix/ph6)
- JWT auth flow already established (Phase 1); OAuth extends it
- Zustand stores for auth, socket, chat, friends, notifications — i18n store follows this pattern

### Integration Points
- `imp/i18n` branch: useT() hook + locale Zustand store + lazy-loaded EN/FR/DE dictionaries wired to 20+ pages
- `fix/polish` branch: additional `dark:` variants for market and settings pages
- Backend users.py: GDPR export endpoint + account delete (both on fix/ph6, with additional i18n update on imp/i18n)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what's in the decisions above — open to standard approaches for gap closure and audit.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-polish-compliance*
*Context gathered: 2026-04-09*
