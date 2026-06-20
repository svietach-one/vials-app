---
name: testing-strategy
description: >
  Project testing strategy, test type definitions, ownership rules, coverage
  requirements, and patterns for Vitest, pytest, Postman/Newman, Playwright, and
  Selenium. Use when writing test plans or test files, asked "what should I test",
  "which layer owns this test", "what coverage is required", or "how do I name
  this test". Defines what to test at each layer, who owns each layer, naming
  conventions, and coverage thresholds.
compatibility: Vitest (TypeScript unit/integration), pytest (Python), Postman/Newman
  (API integration/smoke/regression), Playwright/Selenium (E2E).
---

# Testing Strategy

## Test Pyramid

```
          /\
         /E2\        ← 10% — critical user journeys only
        /----\
       / Smk \       ← smoke + regression: health checks post-deploy
      /--------\
     / Intg     \    ← 30% — API contracts, cross-service (Postman/Newman)
    /------------\
   /   Unit       \  ← 60% — business logic, pure functions (mocked)
  /________________\
```

Never invert this pyramid. Unit tests are cheap and fast; E2E tests are slow
and brittle. Write more unit tests, fewer E2E tests.

## Ownership

| Layer | Written by | Tools |
|---|---|---|
| Unit | engineer(scope=backend), engineer(scope=frontend) | Vitest, pytest, PHPUnit, JUnit |
| Integration | qa-lead | Postman/Newman, pytest+httpx, Vitest+supertest |
| Smoke | qa-lead | Postman/Newman |
| Regression | qa-lead | Postman/Newman |
| E2E | qa-lead | Playwright, Selenium |

## Layer Definitions

### Unit Tests (engineers write — Vitest / pytest / PHPUnit / JUnit)
**What:** A single function or class, all dependencies mocked.
**Not:** Database calls, HTTP requests, file I/O — mock all of these.
**Where:** `tests/[feature]/unit/`
**Speed:** < 5ms per test. If a unit test is slow, you're not mocking enough.

Candidates for unit tests:
- Service layer functions (business logic)
- Utility functions and transforms
- Validation logic
- React component rendering and state transitions
- LangGraph nodes (mock the LLM)
- Pydantic model validators

### Integration Tests (qa-lead writes — Postman/Newman / pytest+httpx)
**What:** Real API endpoints with real DB (test instance). Validates API contracts.
**Not:** External third-party APIs — use mocks or WireMock stubs.
**Where:** `tests/[feature]/integration/`
**Speed:** < 500ms per test.

Candidates for integration tests:
- API endpoint behaviour (HTTP method, path, status codes, response shape)
- Auth middleware enforcement (401 without token, 403 wrong role)
- Cross-service flows (frontend calls backend which calls AI service)
- Database query correctness after migrations

### Smoke Tests (qa-lead writes — Postman/Newman)
**What:** Minimal critical-path checks run immediately after deploy.
**Not:** Edge cases, error paths — only "is the feature alive?"
**Where:** `tests/[feature]/smoke/`
**Speed:** < 2s total. Fail fast on deploy problems.

### Regression Tests (qa-lead writes — Postman/Newman)
**What:** Previously working scenarios that must not break with new changes.
**Where:** `tests/[feature]/regression/`

### E2E Tests (qa-lead writes — Playwright / Selenium)
**What:** Real browser, real UI, real backend.
**Not:** Every possible scenario — only critical paths.
**Where:** `tests/[feature]/e2e/`
**Speed:** < 5s per test.

Candidates for E2E tests:
- User registration → login → complete a core task → logout
- Payment flows
- Any flow where the spec acceptance criterion is "user sees X"

## Coverage Requirements

| Layer | Minimum | Ideal |
|-------|---------|-------|
| Unit (service functions) | 80% line coverage | 95%+ |
| Integration (API routes) | Every route has at least 1 test | All status codes tested |
| E2E | Every acceptance criterion from spec | All happy paths |

## Naming Conventions

Test names must be self-documenting: `it('should [expected behavior] when [condition]')`

File names:
- TypeScript: `[module].test.ts`
- Python: `test_[module].py`
- Playwright: `[feature].spec.ts`

See `references/patterns.md` for naming examples (good and bad) and test data factory patterns.

## Test Data Patterns

- TypeScript: use factory functions (`createTestUser(overrides)`)
- Python: use pytest fixtures
- Database: always use isolated test transactions — roll back after every test, never leave data in the DB

See `references/patterns.md` for full code examples.

## What NOT to Test
- Framework internals (don't test that Express routing works)
- Third-party library behaviour (don't test that Prisma parses SQL)
- Trivial getters/setters with no logic
- `console.log` calls
- Private implementation details — test behaviour, not structure

## Test Quality Checklist
Before submitting test files, verify:
- [ ] Every test has an Arrange / Act / Assert structure
- [ ] No test depends on another test (order-independent)
- [ ] No global mutable state between tests
- [ ] All async operations are properly awaited
- [ ] Mocks are reset between tests (`vi.clearAllMocks()` / `mock.reset_mock()`)
- [ ] Test names describe the BEHAVIOUR, not the implementation
- [ ] Failure messages are clear enough to diagnose without reading the code

## Troubleshooting

**"Not sure whether a test belongs in unit or integration layer"**
If it touches a real database, real HTTP endpoint, or real filesystem, it is integration. If every external dependency is mocked or faked, it is unit. When in doubt, check: does the test require a running service or DB to pass? If yes — integration.

**"Unit tests are slow (>100ms each)"**
You are not mocking enough. Find the real I/O — a DB call, a network request, a file read — and replace it with a mock or in-memory fixture. A properly isolated unit test should complete in under 5ms.

**"Tests fail depending on the order they run"**
Global mutable state is leaking between tests. Add `beforeEach`/`afterEach` cleanup: reset mocks with `vi.clearAllMocks()` (Vitest) or `mock.reset_mock()` (pytest), and roll back DB transactions. No test should assume anything about the state left by a previous test.

**"E2E tests are flaky or slow"**
You have too many E2E tests. E2E is 10% of the pyramid and covers critical user journeys only. Move scenario and edge-case coverage down to the integration layer where it is faster and more reliable.

---

## Examples

**Example 1: Deciding which test layer owns a new service function**

User says: "What should I test for the new `calculateInviteExpiry` utility?"

Actions:
1. Identify the function: a pure calculation function with no DB or HTTP calls — all inputs are plain values
2. Classify as unit test (engineer owns) — no real dependencies, runs in < 5ms
3. Place in `tests/invites/unit/test_calculate_invite_expiry.py`
4. Write tests for: normal expiry window, boundary at exact expiry time, past expiry (already expired), and null/missing input

Result: Unit test file created by engineer; QA does not need to duplicate this at integration layer

---

**Example 2: Writing the test plan for a new API endpoint**

User says: "What coverage is required for the new POST /invites endpoint?"

Actions:
1. Unit layer (engineer): test `inviteService.create()` with mocked DB — happy path, duplicate email error, invalid role error
2. Integration layer (qa-lead): Postman collection hitting the real endpoint — 201 created, 401 without token, 403 wrong role, 422 invalid body, 409 duplicate
3. Smoke layer (qa-lead): single POST that creates an invite and verifies 201 — confirms the endpoint is alive post-deploy
4. E2E layer: only if the spec AC says "user sees the invite in their inbox" — covers the full browser flow

Result: Coverage map across all four layers with file locations and ownership assigned per layer
