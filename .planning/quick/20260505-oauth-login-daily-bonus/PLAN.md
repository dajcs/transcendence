---
status: in-progress
task: oauth-login-daily-bonus
date: 2026-05-05
---

Fix OAuth login daily bonus duplication.

Plan:
1. Add a backend regression test showing two stale authenticated user loads can only award one daily login bonus.
2. Make daily login bonus awarding atomic at the database row level.
3. Run the focused auth tests.

Commit policy: do not commit until user confirms their tests.
