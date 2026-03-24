# Testing Strategy

## Frameworks

| Layer | Framework | Runner |
|---|---|---|
| Backend unit | pytest | `uv run pytest` |
| Backend async | pytest-asyncio | (included with pytest) |
| Backend HTTP | httpx + pytest | (ASGI test client) |
| Frontend unit | Vitest | `npm run test` |
| Frontend components | React Testing Library | (included with Vitest) |
| E2E | Playwright | `npm run test:e2e` |

---

## Backend Test Structure

```
backend/
  tests/
    unit/
      test_economy.py        # bp/tp/kp formulas, edge cases
      test_resolution.py     # resolution logic, payout calc
      test_auth.py           # JWT, bcrypt, PKCE helpers
    integration/
      test_api_bets.py       # REST endpoints: create, place bet, resolve
      test_api_auth.py       # login, register, OAuth callback
      test_api_disputes.py   # dispute flow end-to-end
    conftest.py              # shared fixtures
```

### Fixtures (conftest.py)

```python
@pytest.fixture
async def db():
    # Use a test database (separate from dev)
    # Run migrations before tests, rollback after each test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_session_factory()
    # teardown

@pytest.fixture
def user_factory(db):
    async def _create(**kwargs):
        return await create_user(db, **kwargs)
    return _create

@pytest.fixture
def bet_factory(db, user_factory):
    # Creates bets with sensible defaults
    ...
```

### Mocking Strategy

| What | How |
|---|---|
| External APIs (resolution sources) | `pytest-httpx` mock responses |
| OpenRouter LLM | `unittest.mock.patch` on `call_llm()` |
| Celery tasks | Call task function directly (bypass broker) |
| Redis | Use `fakeredis` in-process |
| Email sending | Capture in-memory, assert on content |
| OAuth providers | Mock callback endpoint in tests |

**Rule:** Never mock the database. Use a real test PostgreSQL instance (Docker container).

---

## Frontend Test Structure

```
frontend/
  src/
    __tests__/
      components/
        BetCard.test.tsx
        BetForm.test.tsx
        DisputePanel.test.tsx
      hooks/
        useSocket.test.ts
        useBetOdds.test.ts
      utils/
        economy.test.ts      # bp/tp formulas (duplicated from backend for safety)
    e2e/
      auth.spec.ts
      bet-lifecycle.spec.ts
      dispute.spec.ts
```

### Component Testing Rules
- Test behavior, not implementation (no snapshot tests)
- Mock API calls with MSW (Mock Service Worker)
- Test loading, error, and empty states explicitly
- No mocking of child components — render the full tree

### Socket.IO Testing
- Use `socket.io-mock` in unit tests
- Integration tests use a real test server

---

## E2E Tests (Playwright)

Critical user paths tested end-to-end against a real Docker environment:

| Test | Covers |
|---|---|
| `auth.spec.ts` | Sign up, log in, log out, OAuth login (mocked provider) |
| `bet-lifecycle.spec.ts` | Create bet, place positions, auto-resolve, payout |
| `dispute.spec.ts` | Place bet, proposer resolve, dispute, community vote, outcome |
| `notifications.spec.ts` | Real-time notification delivery via Socket.IO |

E2E runs against `docker compose up` in CI. Seed data inserted via test API endpoint (disabled in production).

---

## Coverage Targets

| Layer | Minimum Coverage |
|---|---|
| Economy formulas (bp, tp, kp) | 100% |
| Resolution logic + payout | 100% |
| Auth (JWT, bcrypt, OAuth flow) | 90% |
| API endpoints (happy path) | 80% |
| Frontend components | 70% |
| E2E critical paths | All 4 suites pass |

Coverage checked in CI; PR blocked if coverage drops below threshold.

---

## Test Database

- Separate PostgreSQL container for tests: `TEST_DATABASE_URL` env var
- Migrations run before test suite: `uv run alembic upgrade head`
- Each test wrapped in transaction, rolled back after (fast isolation)
- Seeded with minimal fixture data via conftest

---

## CI Pipeline (GitHub Actions)

```yaml
on: [push, pull_request]

jobs:
  backend-tests:
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: test, POSTGRES_PASSWORD: test }
      redis:
        image: redis:7
    steps:
      - uv run pytest --cov=app --cov-fail-under=80

  frontend-tests:
    steps:
      - npm ci
      - npm run test -- --coverage

  e2e-tests:
    steps:
      - docker compose up -d
      - npm run test:e2e
      - docker compose down
```

---

## Writing New Tests: Rules

1. Test file mirrors source file: `app/services/economy.py` → `tests/unit/test_economy.py`
2. Test name: `test_{function}_{scenario}` e.g. `test_daily_bp_zero_kp`
3. One assertion per test (or one logical scenario)
4. No `time.sleep()` in tests — use async event loops or mock time
5. All test data uses factories — no hardcoded UUIDs

---

*Last updated: 2026-03-24*
