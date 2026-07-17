Status: OPEN (known issues — pre-existing test failures)
Filed: 2026-07-17, during routine-engine-v2-cosmetologist Phase 1

## Purpose

Three suites fail on a clean checkout, independent of any feature work. They
are filed here so every later phase/task can diff its own run against this
list instead of re-diagnosing them — and so a NEW failure in one of these
files is not mistaken for background noise. If your run fails anything not
listed here, it's yours.

## Repro (the clean-HEAD proof)

Verified 2026-07-17 on `engine-improvements` at 66d4b35 (pre-Phase-1) by
stashing all working-tree changes and re-running — failures identical with
and without the Phase 1 diff:

```bash
npx jest tests --testPathIgnorePatterns="worktrees" 2>&1 | grep -E "^FAIL"
```

## The three failures

1. **tests/catalog/catalog-screen.test.tsx — suite fails to run.**
   `[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.` The suite's
   import chain reaches the native module before any jest.mock applies.
   Fix direction: mock `@react-native-async-storage/async-storage` with its
   official jest mock at the module boundary before first import (same
   workaround already used by the routine-engine domain suites).

2. **tests/catalog/product-detail.test.tsx — suite fails to run.**
   `TypeError: Cannot read properties of undefined (reading 'cobaltTint')`
   at a `TYPE_COLORS` map (`palette.cobaltTint`). The test's tokens
   mock/import order predates a palette refactor; `palette` resolves
   undefined at module load. Fix direction: align the mock with the current
   `src/constants/tokens.ts` shape.

3. **tests/shelf-filtering/PaoChip.integration.test.tsx — 3 of 6 tests fail**
   (SF-PAO-1 "Expires in 5d", SF-PAO-2 "Expires today", SF-PAO-3 "Expired").
   The chip renders, but the expected text is not matched — consistent with
   the known @testing-library/react-native under-matching issue this repo
   already documented during routine-engine QA activation (worked around
   elsewhere with `screen.UNSAFE_getAllByProps`), and/or stale expected copy.
   Fix direction: re-check the chip's actual copy first, then apply the
   established workaround if the text is correct.

## History

- Baseline of 14 failing suites recorded 2026-07-03 (memory note); most were
  fixed or retired since — these three are the survivors as of 2026-07-17.
- 2026-07-17: verified pre-existing against clean HEAD during Phase 1
  self-review (routine-engine-v2-cosmetologist).

## Exit criteria

Each item closes when its suite is green on a clean checkout; remove it from
this list in the same commit that fixes it.
