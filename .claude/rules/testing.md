# Testing Standards (Jest + jest-expo)

The test runner is **Jest** with the `jest-expo` preset (configured in `package.json`).
Never import from `vitest`, `@playwright/*`, or any other runner.

Run everything with:

```bash
npm run typecheck   # npx tsc --noEmit — must be clean before handing off
npm test            # jest
```

---

## Two test layers, two locations

| Layer | Location | Tools | Owner |
|---|---|---|---|
| Business-logic unit tests | Co-located: `src/utils/[module].test.ts` | Jest only — no rendering | engineer |
| Component / integration tests | `tests/[feature]/[Component].test.tsx` | Jest + `@testing-library/react-native` | qa-lead |

### Unit tests (`src/utils/`)

Pure business logic only: conflict detection, date/season helpers, PAO expiry,
ingredient parsing, routine status derivation.

- No mocks of language built-ins or libraries — pass controlled inputs instead.
  If a function reads `new Date()` internally, give it a `now: Date = new Date()`
  parameter and pass an explicit date in tests (see `timeHelpers.ts`).
- No React, no react-native imports, no store access in the module under test.
  If the function needs store data, it must receive it as an argument.
- Arrange / Act / Assert structure in every test.

### Component tests (`tests/`)

- Use `render`, `screen`, `fireEvent` from `@testing-library/react-native`.
- Share fixtures via a `fixtures.ts` in the feature folder. Fixture factories
  must be annotated with the real component prop types
  (e.g. `makeDefaultShelfCardProps(): ProductShelfCardProps`) so prop drift
  fails `tsc`, not just the test run.
- Mock heavy native modules (`expo-camera`, `@gorhom/bottom-sheet`,
  `react-native-draggable-flatlist`) at the module boundary with `jest.mock`.
- Query by accessibility (`getByRole`, `getByLabelText`) or visible text —
  never by style or component internals.

---

## Naming

Names describe behaviour and condition, not method names:

- CORRECT: `it('returns empty conflicts when routine has a single step')`
- CORRECT: `it('marks product expired when openedDate + paoMonths is in the past')`
- WRONG: `it('test detectConflicts')`, `it('works')`

---

## Anti-patterns

- ❌ Vitest imports (`import { vi } from 'vitest'`) — this project uses Jest (`jest.fn`, `jest.mock`)
- ❌ Testing third-party behaviour (React Navigation, Zustand internals, Expo APIs)
- ❌ Snapshot tests as the only assertion
- ❌ Real timers/dates in logic that depends on "now" — inject the date
- ❌ Network calls escaping a test — OBF service calls must be mocked
- ❌ Tests that depend on another test's side effects — reset stores/mocks in `beforeEach`

---

## Quality gates before handing off to tech-lead

```bash
npx tsc --noEmit    # zero type errors, including tests/
npm test            # all suites green
```
