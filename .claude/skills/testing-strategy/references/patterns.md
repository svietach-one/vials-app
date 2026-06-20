# Testing Patterns — Code Reference

Full code examples for patterns described in SKILL.md.

---

## Naming Conventions

### Good — self-documenting
```
it('should return 401 when token is expired')
it('should create user and send welcome email when registration is valid')
it('should not allow duplicate email addresses')
```

### Bad — meaningless
```
it('test login')   ← says nothing about expected behaviour
it('works')        ← not a test name
it('auth test 1')  ← no behaviour described
```

---

## TypeScript — Test Data Factory

```typescript
// tests/factories/user.factory.ts
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2026-01-01'),
  ...overrides,
})

// Usage
const admin = createTestUser({ role: 'admin' })
const otherUser = createTestUser({ id: 'other-id', email: 'other@example.com' })
```

---

## Python — pytest Fixture

```python
import pytest

@pytest.fixture
def sample_user() -> dict:
    return {
        "id": "test-user-id",
        "email": "test@example.com",
        "name": "Test User",
    }

# Usage
def test_user_display_name(sample_user: dict) -> None:
    assert sample_user["name"] == "Test User"
```

---

## Database — Isolated Test Transactions

Always roll back after every test. Never leave test data in the DB.

```typescript
// TypeScript — Prisma + Vitest
beforeEach(async () => {
  await db.$executeRaw`BEGIN`
})

afterEach(async () => {
  await db.$executeRaw`ROLLBACK`
})
```

```python
# Python — pytest + SQLAlchemy
@pytest.fixture
async def db_session(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        async with AsyncSession(conn) as session:
            yield session
            await session.rollback()
```

---

## Vitest Mock Reset

```typescript
import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()  // clears call history and instances
  // vi.resetAllMocks() — also resets return values
  // vi.restoreAllMocks() — restores original implementations
})
```

---

## pytest Mock Reset

```python
from unittest.mock import patch, MagicMock

def test_something(mocker):  # pytest-mock
    mock_service = mocker.patch('module.service_function')
    mock_service.return_value = {"result": "ok"}

    result = call_under_test()

    mock_service.assert_called_once_with(expected_arg)
    # mock is automatically reset after the test when using mocker fixture
```
