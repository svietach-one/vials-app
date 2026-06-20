---
name: frontend-testing
description: >
  Frontend unit testing strategy for business logic utility functions.
  Scope is strictly limited to pure functions and business logic utilities —
  data transformers, validators, calculators, adapters, permission helpers, and
  state derivation functions. Never React components, hooks, Next.js internals,
  or third-party library behaviour. Uses Vitest. Auto-activates when writing or
  reviewing frontend unit tests. Used by qa-lead.
compatibility: Vitest, TypeScript. For src/web/ utils/ folders only.
---

# Frontend Testing — Business Logic Utilities

## Core Principle — FIRM BOUNDARY

Engineers test pure business-logic utilities ONLY. Never React components, never hooks, never Next.js internals, never third-party library behaviour. Component / hook / route behaviour is integration-level — owned by qa-lead, not the engineer.

A test exists because there is a meaningful algorithmic decision or transformation to verify — not because you rendered HTML and clicked a button. If a function has no logic of its own (pure wrapper, pass-through, getter), it has no test.

Prohibited patterns in work (DO NOT write tests like this):
- Component rendering or DOM queries using @testing-library/react
- User interaction simulation or testing hooks
- Mocking third-party libraries or Next.js navigation primitives

If you find yourself importing test helpers from Next.js or React Testing Library — stop. That belongs in qa-lead's E2E / integration suite.

---

## Scope: What This Skill Covers

### IN SCOPE — Write tests for these:
- Data transformers — functions that reshape or reformat data (e.g. convert API response to UI model)
- Data adapters — functions that convert data between incompatible types or schemas
- Validation functions — input rules, constraint checks, domain invariants
- Calculation and aggregation logic — totals, discounts, scores, date arithmetic
- Filtering and sorting utilities — driven by business rules, not just array methods
- Permission and access-control helpers — role checks, feature flag evaluation
- State derivation helpers — functions that compute derived state from raw data
- Error classification and message mapping functions

All of these live in utils/ folders across the project — at any nesting level.

### OUT OF SCOPE — Never write tests for these:
- React component rendering (render(), screen, userEvent)
- React hooks (renderHook, act)
- Next.js routing, middleware, server actions, App Router internals
- Third-party library behaviour (date-fns, lodash, zod, etc.) — trust the library
- Functions that are pure wrappers with zero logic of their own
- API fetching functions or anything that makes network calls
- Browser API wrappers (localStorage, window, navigator)
- CSS-in-JS or Tailwind class generation
- Trivial getters, constants, and pass-through re-exports

Rule of thumb: if removing the function body and replacing it with "return input" would make no difference to the business outcome, there is nothing to test.

---

## File Conventions

| Item | Convention |
|---|---|
| Test file location | Co-located next to the source: utils/[module].test.ts |
| Naming | [module].test.ts — mirrors the source file name exactly |
| Test runner | Vitest |
| Config file | vitest.config.ts at project root |

---

## Test Structure

Every test uses Arrange / Act / Assert — no exceptions:

- Arrange: set up input data, configuration, or arguments.
- Act: execute the pure business utility function under test.
- Assert: verify the returned value matches the expected output.

---

## Naming Rules

Names must describe behaviour and condition — not method names or test numbers:

- CORRECT: it('should return zero discount when cart total is below threshold')
- CORRECT: it('should clamp quantity to maximum allowed when input exceeds limit')
- CORRECT: it('should return false when user role is not in allowed list')
- CORRECT: it('should map API snake_case keys to camelCase UI model')
- CORRECT: it('should throw when adapter receives null where object is expected')
- WRONG: it('test discount')
- WRONG: it('works correctly')
- WRONG: it('formatPrice test 1')

---

## What NOT to Mock

Pure utility functions have no external dependencies. Do not mock anything unless the function under test calls a collaborator that is itself a business-logic function you own.

Never mock:
- Language built-ins (Math, Date, Array, String, JSON)
- Third-party library functions — pass controlled inputs instead of mocking the library
- Module-level constants or config objects — pass them as function arguments in tests

If you find yourself writing vi.mock(...) for a utility test, stop. You are either testing the wrong layer or the function needs to be refactored to accept its dependencies as arguments.

---

## Test Quality Checklist

Before submitting test files:
- [ ] Every tested function contains business logic that the codebase itself owns
- [ ] No test renders a React component or mounts a hook
- [ ] No test imports from @testing-library/*, @playwright/*, or any E2E library
- [ ] No vi.mock() calls in utility tests (pass controlled inputs instead)
- [ ] Test name describes behaviour and condition, not method name
- [ ] Arrange / Act / Assert structure is visible in each test
- [ ] All meaningful decision branches and edge cases are covered
- [ ] Async tests use async/await and rejects.toThrow for error paths
- [ ] No test depends on another test's side effects
- [ ] Test file is co-located with the source module (utils/[module].test.ts)

---

## Troubleshooting

- Not sure whether a function belongs in scope: If the function has no import from React, no DOM access, and its output depends only on its inputs — it is in scope. If it imports from react, next, or calls window/document — it is out of scope.
- Function calls a library internally — do I mock the library?: No. Pass controlled inputs instead of mocking the library. You are testing whether your business thresholds and return values are correct, not whether the library works.
- Test passes locally but fails in CI: Usually a timezone or locale difference affecting Date or Intl output. Fix by passing explicit Date instances as arguments rather than calling new Date() inside the function under test.
- vi.mock() feels necessary here: Stop. If you need vi.mock() in a utility test, you are either testing the wrong layer or the function needs to accept its dependency as an argument. Refactor the function to take the dependency as a parameter instead.