---
name: typescript-testing
description: >
  TypeScript backend unit testing with Vitest — service-layer mocking patterns
  for Prisma, Result<T> error paths, external service clients, and async
  handlers. Auto-activates when writing or reviewing TypeScript backend tests.
  Used by engineer (scope=backend) on the TypeScript stack and by qa-lead.
  For frontend testing scope, see frontend-testing.
---

# TypeScript Backend Testing

## Scope

Unit tests for **service layer** code in `src/api/services/`. Tests live in
`tests/[feature]/unit/`. Mock all external dependencies — DB, HTTP clients,
queues, third-party SDKs.

**Out of scope:** route handler integration tests, end-to-end API tests, frontend
component tests. Those belong to qa-lead's integration / E2E suites
(see `testing-strategy`). Frontend business-logic utility tests use
`frontend-testing` instead.

---

## File conventions

| Item | Convention |
|---|---|
| Location | `tests/[feature]/unit/[module].test.ts` |
| Naming | mirror source: `featureService` → `feature.service.test.ts` |
| Test runner | Vitest |
| Imports | `import { describe, it, expect, vi, beforeEach } from 'vitest'` |

---

## Pattern 1 — Service that returns `Result<T, E>`

The TypeScript backend uses `Result<T, E>` (no thrown errors in service layer).
Test both success and error paths explicitly.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { featureService } from '../../../src/api/services/feature'
import { db } from '../../../src/lib/db'

vi.mock('../../../src/lib/db')

describe('featureService.create', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns Conflict when name already exists', async () => {
    vi.mocked(db.feature.findFirst).mockResolvedValue({ id: '1', name: 'existing' } as any)

    const result = await featureService.create('user-1', { name: 'existing' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Conflict')
    expect(db.feature.create).not.toHaveBeenCalled()
  })

  it('creates the feature when the name is unique', async () => {
    vi.mocked(db.feature.findFirst).mockResolvedValue(null)
    vi.mocked(db.feature.create).mockResolvedValue({ id: '2', name: 'new' } as any)

    const result = await featureService.create('user-1', { name: 'new' })

    expect(result.ok).toBe(true)
    expect(result.value.name).toBe('new')
  })
})
```

---

## Pattern 2 — Mocking Prisma

Mock the entire `db` module, then use `vi.mocked()` to type the mock per call.
Cover the three common shapes:

```typescript
// Read
vi.mocked(db.user.findUnique).mockResolvedValue({ id: 'u1', email: 'a@b.c' } as any)

// Read returning null (not found)
vi.mocked(db.user.findUnique).mockResolvedValue(null)

// Write (create / update / delete)
vi.mocked(db.user.create).mockResolvedValue({ id: 'u2' } as any)

// Transaction — mock the inner callback's argument
vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(db))
```

Avoid `mockImplementation` chains beyond two levels — if a test needs deep
behaviour, the service is doing too much and should be refactored.

---

## Pattern 3 — Mocking an external HTTP client

```typescript
import { aiServiceClient } from '../../../src/lib/ai-service-client'

vi.mock('../../../src/lib/ai-service-client')

it('returns ServiceUnavailable when the AI service times out', async () => {
  vi.mocked(aiServiceClient.classify).mockRejectedValue(new Error('ETIMEDOUT'))

  const result = await featureService.classify('input text')

  expect(result.ok).toBe(false)
  expect(result.error).toBe('ServiceUnavailable')
})
```

Never let a real HTTP call escape a unit test. If the service has no client
abstraction yet, add one before testing.

---

## Pattern 4 — Mocking time and randomness

```typescript
import { vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-27T10:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

it('expires invites after 7 days', () => {
  const created = new Date('2026-04-20T10:00:00Z')
  expect(isExpired(created)).toBe(true)
})
```

For `Math.random` and UUIDs: use `vi.spyOn` or inject a generator at the
service-layer boundary; do not patch globals in the test.

---

## Pattern 5 — Parametrised tests

```typescript
describe('isValidEmail', () => {
  it.each([
    ['user@example.com', true],
    ['no-at-sign.com', false],
    ['', false],
    ['user@', false],
  ])('returns %s → %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected)
  })
})
```

Use `it.each` whenever a function's behaviour is "rule-table-shaped". One test
per row; clearer than long branchy `it` blocks.

---

## Quality gates

Before handing off to tech-lead, every TypeScript backend service must pass:

```bash
npx tsc --noEmit                          # zero type errors across src/
npx eslint src/api/                       # zero lint errors
npx vitest run --coverage tests/[feature] # green; service-layer coverage ≥ 80%
```

Fill `quality_gates` in `progress/{ISSUE-KEY}-handoff.json` accordingly.

---

## Anti-patterns

- ❌ Importing the real `db` instead of mocking it — that becomes an integration test
- ❌ Using `as any` on the return value of `vi.mocked()` to fake fields the service does not read
- ❌ Asserting on log output as the only verification — assert on the returned `Result`
- ❌ Sharing mutable state between tests (use `beforeEach(() => vi.clearAllMocks())`)
- ❌ Catching thrown errors in tests when the service contract is `Result<T, E>` — service should not throw
- ❌ Testing a route handler — that is an integration test owned by qa-lead

---

## See also

- `testing-strategy` — layer definitions, ownership, coverage thresholds (authoritative)
- `ts-coding-standards` — TypeScript style and `Result<T, E>` contract
- `backend-standards` — service / repository layer architecture
- `frontend-testing` — for `src/web/` business-logic utility tests (separate scope)
