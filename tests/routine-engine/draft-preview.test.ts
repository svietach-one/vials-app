/**
 * Integration tests — Story 2: Draft preview with scope selection
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 2
 *
 * The engine-level composition tests below predate FE-8 and stay as-is. The
 * Draft Preview SHEET layout + per-scope-action wiring is now covered as a
 * component test in tests/routine-engine/draft-preview-sheet.test.tsx (mocks
 * @gorhom/bottom-sheet at the boundary). This file activates the remaining
 * Story 2 UI todos that are really about src/domain/routinePlanActions.ts
 * (FE-8, shipped 2026-07-05) — the ONLY write path from a draft into
 * routinesStore — against the REAL zustand stores with AsyncStorage's
 * official jest mock, per .claude/rules/testing.md.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { generatePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { applyRoutinePlan } from '@/domain/routinePlanActions';
import { useRoutinesStore } from '@/store/routinesStore';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import {
  makeEngineInput,
  makeProduct,
  makeRoutine,
  makeRoutineStep,
  resetFixtureCounters,
  routinesFromPlan,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 2 AC: a PM-only commit leaves AM untouched and validate re-runs over the combined result', () => {
  it('keeps the pre-draft AM routine byte-identical after only the PM period is replaced', () => {
    const oldAm = makeProduct({ productType: 'cleanser' });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });

    const savedAm = makeRoutine('morning', [makeRoutineStep(oldAm), makeRoutineStep(vitC)]);
    const input = makeEngineInput([oldAm, vitC, retinoid]);
    const draft = generatePlan(input);

    // Simulate "Save for PM Only": AM routine reference is untouched, only the
    // PM routine is replaced by the draft's evening period.
    const [, savedPm] = routinesFromPlan(draft);
    const combined = [savedAm, savedPm];

    const result = validateRoutines(combined, input);

    // AM routine object passed into validate is the exact pre-draft reference.
    expect(combined[0]).toBe(savedAm);
    expect(savedAm.steps.map((s) => s.productId)).toEqual([oldAm.id, vitC.id]);
    // validate runs cleanly over the combined (mixed pre-draft AM + new PM) state.
    expect(result.proposedPlan).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('a Cancel / Discard simulation performs no engine write — generatePlan alone never persists anything', () => {
    const product = makeProduct();
    const input = makeEngineInput([product]);
    const before = JSON.stringify(input.products);

    generatePlan(input); // "opening the draft" — discarding it means simply not calling any commit

    expect(JSON.stringify(input.products)).toBe(before);
  });
});

// ─── Story 2 UI/domain: applyRoutinePlan is the only write path ──────────────

describe('Story 2 AC: applyRoutinePlan commits the right scope into routinesStore', () => {
  const product = makeProduct({ id: 'shared-product', productType: 'cleanser' });
  const amOnlyProduct = makeProduct({ id: 'am-only', productType: 'serum' });
  const pmOnlyProduct = makeProduct({ id: 'pm-only', productType: 'serum' });

  function makeTestPlan(): RoutinePlan {
    return {
      rulesetVersion: 'test',
      generatedFor: '2026-07-04',
      periods: {
        morning: [
          { productId: amOnlyProduct.id, productType: 'serum', scheduledDays: [], slotIndex: 5, score: 0, addedAt: '2026-01-01' },
        ],
        evening: [
          { productId: pmOnlyProduct.id, productType: 'serum', scheduledDays: [], slotIndex: 5, score: 0, addedAt: '2026-01-01' },
        ],
      },
      frozen: [],
      reserve: [],
      placeholders: [],
      decisions: [],
    };
  }

  function seedRoutines() {
    useRoutinesStore.setState({
      routines: [
        { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [makeRoutineStep(product)] },
        { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: [makeRoutineStep(product)] },
      ],
      hydrated: true,
    });
  }

  beforeEach(seedRoutines);

  it('"Save for Both (AM & PM)" persists both periods atomically', () => {
    applyRoutinePlan(makeTestPlan(), 'both');
    const { routines } = useRoutinesStore.getState();
    expect(routines.find((r) => r.timeOfDay === 'morning')?.steps.map((s) => s.productId)).toEqual([amOnlyProduct.id]);
    expect(routines.find((r) => r.timeOfDay === 'evening')?.steps.map((s) => s.productId)).toEqual([pmOnlyProduct.id]);
  });

  it('"Save for AM Only" persists only the AM period, discarding the PM draft', () => {
    applyRoutinePlan(makeTestPlan(), 'am');
    const { routines } = useRoutinesStore.getState();
    expect(routines.find((r) => r.timeOfDay === 'morning')?.steps.map((s) => s.productId)).toEqual([amOnlyProduct.id]);
    // PM routine untouched — still the original shared product, NOT the draft's pmOnlyProduct.
    expect(routines.find((r) => r.timeOfDay === 'evening')?.steps.map((s) => s.productId)).toEqual([product.id]);
  });

  it('"Save for PM Only" persists only the PM period, discarding the AM draft', () => {
    applyRoutinePlan(makeTestPlan(), 'pm');
    const { routines } = useRoutinesStore.getState();
    expect(routines.find((r) => r.timeOfDay === 'evening')?.steps.map((s) => s.productId)).toEqual([pmOnlyProduct.id]);
    // AM routine untouched — still the original shared product, NOT the draft's amOnlyProduct.
    expect(routines.find((r) => r.timeOfDay === 'morning')?.steps.map((s) => s.productId)).toEqual([product.id]);
  });

  it('"Cancel / Discard Draft" performs no store write — never calling applyRoutinePlan leaves routinesStore untouched', () => {
    const before = useRoutinesStore.getState().routines;
    // "Opening the draft" (generatePlan) and reading it back never writes;
    // discarding is simply not calling applyRoutinePlan at all.
    generatePlan(makeEngineInput([product]));
    expect(useRoutinesStore.getState().routines).toBe(before); // same reference, no write occurred
  });
});

describe('Story 2 AC: a partial commit that reintroduces a pinned, pair-frozen product lights the Optimize strip (not a modal)', () => {
  // research §3 assumption (progress/routine-engine.md, FE-5 entry): the
  // engine can freeze a product via a pair rule with no expiry (a
  // freeze_lower_priority ladder outcome, not a clinical `until`); planApply's
  // pin-preservation rule (already unit-tested in planApply.test.ts's "keeps a
  // pinned step frozen by a pair rule — pins beat preferences") re-inserts it
  // anyway, since only a clinically-dated freeze may override a pin. This is
  // the concrete mechanism by which a partial commit can persist a conflict
  // the engine itself tried to avoid — validated here end-to-end through the
  // real domain write path + validateRoutines, not just the pure
  // buildStepsFromPlan unit.
  const retinoid = makeProduct({ id: 'pinned-retinoid', activeTags: ['retinoid'] });
  const aha = makeProduct({ id: 'draft-aha', activeTags: ['aha'] });

  it('re-appends the pinned, pair-frozen product and validate reports the resulting avoid finding (hasBlockingFindings)', () => {
    useRoutinesStore.setState({
      routines: [
        { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
        {
          id: 'r-pm',
          name: 'Evening',
          timeOfDay: 'evening',
          steps: [makeRoutineStep(retinoid, { userPinned: true })],
        },
      ],
      hydrated: true,
    });

    // A draft that admitted `aha` but froze the pinned retinoid via the pair
    // rule (no `until` — a ladder-exhaustion freeze, not a clinical one).
    const plan: RoutinePlan = {
      rulesetVersion: 'test',
      generatedFor: '2026-07-04',
      periods: { morning: [], evening: [
        { productId: aha.id, productType: 'serum', scheduledDays: [], slotIndex: 5, score: 0, addedAt: '2026-01-01' },
      ] },
      frozen: [{ productId: retinoid.id, reasonCode: 'rule_retinol_aha', ruleId: 'rule_retinol_aha' }],
      reserve: [],
      placeholders: [],
      decisions: [],
    };

    applyRoutinePlan(plan, 'pm');

    const pmRoutine = useRoutinesStore.getState().routines.find((r) => r.timeOfDay === 'evening');
    // Both the freshly admitted aha AND the re-appended pinned retinoid now coexist.
    expect(pmRoutine?.steps.map((s) => s.productId).sort()).toEqual([aha.id, retinoid.id].sort());

    const result = validateRoutines(useRoutinesStore.getState().routines, makeEngineInput([retinoid, aha]));
    expect(result.hasBlockingFindings).toBe(true);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'avoid', ruleId: 'rule_retinol_aha', pinned: true }),
      ]),
    );
  });
});
