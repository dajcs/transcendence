---
status: in_progress
created: 2026-04-23
---

Remove the obsolete `/dashboard` page and all remaining links or redirects to it.

Tasks:
- Delete the protected dashboard route page.
- Remove `/dashboard` from route guarding and all frontend/backend redirects or fallback links.
- Remove unused dashboard i18n keys.
- Update tests that asserted dashboard navigation.
- Run focused verification, then wait for manual test confirmation before commit.
