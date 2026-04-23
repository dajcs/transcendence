---
status: complete
completed: 2026-04-23
commit: pending
---

# Summary

Implemented the market discussion depth change.

Changed:
- Backend comment nesting now allows an 8-post chain and rejects replies beyond that.
- Market detail UI keeps the normal Reply action through the extended depth.
- Removed the New Thread continuation approach after user review.
- Updated backend and frontend tests for the new depth behavior.
- Updated active requirements/context docs for the new discussion rule.

Verification:
- `npm test -- market-detail.test.tsx --runInBand` passed.
- `npm run type-check` passed.
- `uv run --python 3.12 pytest tests/test_comments.py::test_nested_reply_rejected -q` passed.

Notes:
- User manually reviewed the revised behavior and approved commit.
