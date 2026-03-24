# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner:**
- Frontend: **Vitest** (Vue Testing Library compatible, works with React)
- Backend: **pytest** with pytest-asyncio for async support
- Config: `vitest.config.ts` (frontend), `pyproject.toml` under `[tool.pytest.ini_options]` (backend)

**Assertion Library:**
- Frontend: Vitest built-in expect + React Testing Library assertions
- Backend: pytest assertions with `assert` statements; use `pytest-raises` for exception testing

**Run Commands:**

Frontend:
```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

Backend:
```bash
uv run pytest                    # Run all tests
uv run pytest --watch           # Watch mode (via pytest-watch)
uv run pytest --cov=app         # Coverage report
uv run pytest tests/unit        # Run unit tests only
uv run pytest tests/integration # Run integration tests only
```

## Test File Organization

**Location:**
- **Co-located**: Tests live next to source files (preferred for component units)
- **Separate directory**: Integration and E2E tests in `tests/` directory

Frontend structure:
```
src/
├── components/
│   ├── BetCard.tsx
│   ├── BetCard.test.tsx          # Co-located unit test
│   └── __tests__/
│       └── BetCard.integration.test.tsx
└── hooks/
    ├── useAuth.ts
    └── useAuth.test.ts            # Co-located unit test

tests/
├── integration/                   # API/store integration tests
├── e2e/                           # End-to-end tests (Playwright)
└── fixtures/                      # Shared test data
```

Backend structure:
```
app/
├── models/
│   ├── user.py
│   └── test_user.py               # Co-located unit test
├── routes/
│   ├── bets.py
│   └── test_bets.py               # Co-located route tests
└── utils/
    ├── validation.py
    └── test_validation.py         # Co-located unit test

tests/
├── integration/                   # Multi-module integration tests
├── fixtures/                      # Shared test data/factories
└── conftest.py                    # Pytest configuration
```

**Naming:**
- Unit test files: `[module].test.ts` (frontend), `test_[module].py` (backend)
- Integration/E2E: `[feature].integration.test.ts` or `test_[feature]_integration.py`
- Fixtures/factories: `fixtures.ts` (frontend), `conftest.py` (backend)

## Test Structure

**Suite Organization:**

Frontend (Vitest):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BetCard } from './BetCard';

describe('BetCard Component', () => {
  describe('Rendering', () => {
    it('should render bet amount correctly', () => {
      render(<BetCard bet={mockBet} />);
      expect(screen.getByText('$100')).toBeInTheDocument();
    });

    it('should show YES/NO buttons', () => {
      render(<BetCard bet={mockBet} />);
      expect(screen.getByRole('button', { name: /yes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should handle bet submission', async () => {
      const onSubmit = vi.fn();
      render(<BetCard bet={mockBet} onSubmit={onSubmit} />);

      await userEvent.click(screen.getByRole('button', { name: /yes/i }));
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      expect(onSubmit).toHaveBeenCalled();
    });
  });
});
```

Backend (pytest):
```python
import pytest
from app.models import User, Bet
from app.routes import bets
from sqlalchemy.ext.asyncio import AsyncSession

class TestBetCreation:
    """Bet creation functionality."""

    @pytest.mark.asyncio
    async def test_create_bet_success(self, db_session: AsyncSession, user: User):
        """Should create a bet with valid input."""
        result = await bets.create_bet(
            user_id=user.id,
            market_id="market-1",
            amount=100,
            position="yes",
            session=db_session
        )
        assert result.id is not None
        assert result.status == "active"

    @pytest.mark.asyncio
    async def test_create_bet_invalid_amount(self, db_session: AsyncSession, user: User):
        """Should reject bets with invalid amounts."""
        with pytest.raises(ValueError, match="amount must be positive"):
            await bets.create_bet(
                user_id=user.id,
                market_id="market-1",
                amount=-100,
                position="yes",
                session=db_session
            )

    @pytest.mark.asyncio
    async def test_create_bet_insufficient_balance(
        self, db_session: AsyncSession, poor_user: User
    ):
        """Should reject bets when user lacks balance."""
        with pytest.raises(ValueError, match="insufficient balance"):
            await bets.create_bet(
                user_id=poor_user.id,
                market_id="market-1",
                amount=10000,
                position="yes",
                session=db_session
            )
```

**Patterns:**

Setup/Teardown:
```typescript
// Frontend
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup DOM
});
```

```python
# Backend
@pytest.fixture
def user(db_session: AsyncSession):
    """Create a test user."""
    user = User(username="testuser", email="test@example.com")
    db_session.add(user)
    db_session.commit()
    yield user
    # Cleanup happens via transaction rollback
```

Assertion patterns:
```typescript
// Frontend — use Testing Library queries
expect(screen.getByRole('button')).toBeInTheDocument();
expect(screen.getByLabelText('Bet Amount')).toHaveValue('100');
expect(screen.queryByText('Error')).not.toBeInTheDocument();
```

```python
# Backend — use pytest assertions
assert user.karma == 100
assert bet.status == BetStatus.ACTIVE
assert len(bets) == 5
```

## Mocking

**Framework:**
- Frontend: **Vitest** with `vi.fn()`, `vi.mock()`, `vi.spyOn()`
- Backend: **unittest.mock** (built-in) or `pytest-mock` fixture

**Patterns:**

Frontend mocking:
```typescript
import { vi } from 'vitest';

// Mock functions
const mockOnBetSubmit = vi.fn();

// Mock modules
vi.mock('@/lib/api', () => ({
  placeBet: vi.fn().mockResolvedValue({ id: '1', status: 'active' })
}));

// Mock hooks
import * as authModule from '@/hooks/useAuth';
vi.spyOn(authModule, 'useAuth').mockReturnValue({
  user: mockUser,
  isLoading: false
});
```

Backend mocking:
```python
from unittest.mock import patch, MagicMock
from pytest_mock import MockerFixture

def test_external_api_call(mocker: MockerFixture):
    """Mock external API dependency."""
    mock_response = MagicMock()
    mock_response.json.return_value = {"result": "success"}
    mocker.patch('requests.get', return_value=mock_response)

    result = call_external_api()
    assert result == {"result": "success"}

@pytest.mark.asyncio
async def test_with_mock_db(mocker: MockerFixture, db_session: AsyncSession):
    """Mock database calls for unit testing."""
    mocker.patch('app.routes.bets.get_user_balance', return_value=1000)

    balance = await bets.get_user_balance(user_id="1")
    assert balance == 1000
```

**What to Mock:**
- External API calls (OpenRouter, Google OAuth, GitHub OAuth)
- Database queries (in unit tests; use real DB in integration tests)
- Randomness/time-dependent functions
- Socket.IO connections (in unit tests)

**What NOT to Mock:**
- Business logic core functions (test them directly)
- Validation functions (test edge cases)
- Error handling (test real exceptions)
- Async/await mechanics (prefer real async in tests)

## Fixtures and Factories

**Test Data:**

Frontend:
```typescript
// tests/fixtures/data.ts
export const mockUser = {
  id: 'user-1',
  username: 'testuser',
  karma: 100,
  truth: 0.75
};

export const mockBet = {
  id: 'bet-1',
  marketId: 'market-1',
  userId: 'user-1',
  amount: 100,
  position: 'yes' as const,
  status: 'active' as const
};

// Usage in tests
import { mockBet } from '@/tests/fixtures/data';
render(<BetCard bet={mockBet} />);
```

Backend:
```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, Market, Bet

@pytest.fixture
async def user(db_session: AsyncSession):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        karma=100,
        truth=0.75
    )
    db_session.add(user)
    await db_session.commit()
    yield user

@pytest.fixture
async def market(db_session: AsyncSession, user: User):
    """Create a test market."""
    market = Market(
        question="Will it rain tomorrow?",
        proposer_id=user.id,
        deadline=datetime.now() + timedelta(days=7)
    )
    db_session.add(market)
    await db_session.commit()
    yield market

@pytest.fixture
async def bet(db_session: AsyncSession, user: User, market: Market):
    """Create a test bet."""
    bet = Bet(
        user_id=user.id,
        market_id=market.id,
        amount=100,
        position="yes"
    )
    db_session.add(bet)
    await db_session.commit()
    yield bet
```

**Location:**
- Frontend: `tests/fixtures/` directory, organized by entity
- Backend: `tests/conftest.py` (main fixtures), `tests/fixtures/` for shared data factories

## Coverage

**Requirements:**
- Frontend: Aim for 80%+ coverage on critical components (auth, bet placement, resolution)
- Backend: Aim for 85%+ coverage on API routes and business logic
- Enforcement: Coverage gates in CI/CD (optional; set in GSD phase)

**View Coverage:**

Frontend:
```bash
npm run test:coverage
# Output: terminal report + HTML report in coverage/
```

Backend:
```bash
uv run pytest --cov=app --cov-report=term-missing --cov-report=html
# Output: terminal report + HTML report in htmlcov/
```

## Test Types

**Unit Tests:**
- Scope: Single function or component in isolation
- Approach: Mock all external dependencies; test logic paths and edge cases
- Location: `[module].test.ts` (frontend), `test_[module].py` (backend)
- Example: Testing `calculateOdds()` function independently, testing BetCard rendering with fixed props

**Integration Tests:**
- Scope: Multiple components/modules working together (e.g., component + store + API calls)
- Approach: Mock only external services (APIs); test real internal interactions
- Location: `tests/integration/` directory
- Example: Testing bet placement flow (UI → form validation → API call → store update)

**E2E Tests:**
- Scope: Full user workflows across UI and backend
- Framework: Playwright (to be configured during scaffolding)
- Approach: Run against real running services; no mocks
- Location: `tests/e2e/` directory
- Example: User logs in → creates market → places bet → sees result

## Common Patterns

**Async Testing:**

Frontend:
```typescript
it('should load user data', async () => {
  render(<UserProfile userId="1" />);

  // Wait for async operation
  const userName = await screen.findByText('testuser');
  expect(userName).toBeInTheDocument();
});

it('should handle async error', async () => {
  vi.mock('@/lib/api', () => ({
    getUser: vi.fn().mockRejectedValue(new Error('Network error'))
  }));

  render(<UserProfile userId="1" />);

  const error = await screen.findByText('Failed to load user');
  expect(error).toBeInTheDocument();
});
```

Backend:
```python
@pytest.mark.asyncio
async def test_async_bet_creation(db_session: AsyncSession, user: User):
    """Test async database operation."""
    bet = await bets.create_bet(
        user_id=user.id,
        market_id="market-1",
        amount=100,
        position="yes",
        session=db_session
    )
    assert bet.id is not None

@pytest.mark.asyncio
async def test_async_error_handling(db_session: AsyncSession):
    """Test error in async operation."""
    with pytest.raises(ValueError, match="user not found"):
        await bets.create_bet(
            user_id="nonexistent",
            market_id="market-1",
            amount=100,
            position="yes",
            session=db_session
        )
```

**Error Testing:**

Frontend:
```typescript
it('should display validation errors', async () => {
  render(<BetForm />);

  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText('Amount must be positive')).toBeInTheDocument();
  expect(screen.getByText('Position is required')).toBeInTheDocument();
});

it('should show API error messages', async () => {
  vi.mock('@/lib/api', () => ({
    placeBet: vi.fn().mockRejectedValue({
      message: 'Insufficient balance'
    })
  }));

  render(<BetForm />);
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
});
```

Backend:
```python
@pytest.mark.asyncio
async def test_validation_error(db_session: AsyncSession):
    """Test validation error response."""
    with pytest.raises(ValueError, match="amount must be positive"):
        await bets.create_bet(
            user_id="user-1",
            market_id="market-1",
            amount=-100,
            position="yes",
            session=db_session
        )

def test_http_error_response(client):
    """Test HTTP error response format."""
    response = client.post('/bets', json={"amount": -100})
    assert response.status_code == 400
    assert response.json()["detail"] == "amount must be positive"
```

---

*Testing analysis: 2026-03-24*
