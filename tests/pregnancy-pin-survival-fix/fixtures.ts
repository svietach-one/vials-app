/**
 * Shared fixtures for the pregnancy-pin-survival-fix integration suite.
 * Spec: docs/specs/pregnancy-pin-survival-fix.md
 * Tech design: docs/tech-design/pregnancy-pin-survival-fix.md
 *
 * Wraps the routine-engine and pregnancy-safety-handling suites' shared
 * factories instead of re-implementing them — same cross-folder-import
 * precedent already used by tests/pregnancy-safety-handling/fixtures.ts
 * (which itself wraps tests/routine-engine/fixtures.ts).
 */
export {
  makeEngineInput,
  makeProcedureLog,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  NOW,
  resetFixtureCounters,
} from '../routine-engine/fixtures';

export { makePregnancyEngineInput, makeRetinoidProduct } from '../pregnancy-safety-handling/fixtures';
