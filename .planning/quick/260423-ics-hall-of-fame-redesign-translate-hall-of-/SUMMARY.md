---
status: complete
completed: 2026-04-23
commit: pending
---

# Summary

Implemented `/hall-of-fame` redesign with localized Hall of Fame labels and BP/TP leaderboard tabs.

Changed:
- Extended `/api/users/hall-of-fame` response with `tp_entries` while preserving existing `entries` for banked BP.
- Added TP aggregation by `tp_transactions.amount`, sorted by total TP descending.
- Redesigned the Hall of Fame frontend page with tabbed BP and TP views.
- Added EN/FR/DE i18n keys and translated the nav/page title.
- Updated the focused backend user test to assert TP leaderboard ordering and totals.
- Updated economy/requirements/handoff design docs to describe the BP/TP tab design.

Verification:
- `npm run type-check` passed.
- `uv run --python 3.12 pytest tests/test_users.py::test_hall_of_fame_lists_users_by_banked_bp_and_tp -q` passed.

Notes:
- User manually tested and approved before commit.
