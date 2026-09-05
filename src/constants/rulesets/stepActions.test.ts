import type { ProductType, StepAction } from '@/types';
import { STEP_ACTION_FOR_TYPE, STEP_ACTION_LABELS } from '@/constants/rulesets/stepActions';

// Mirrors the full ProductType union in src/types/index.ts — kept as a local
// literal list (not `Object.keys`) so a new ProductType added there without a
// matching entry here fails this test, not just `tsc`.
const ALL_PRODUCT_TYPES: ProductType[] = [
  'cleanser',
  'toner',
  'essence',
  'serum',
  'gel',
  'moisturizer',
  'oil',
  'spf',
  'makeup_remover',
  'peeling',
  'ampoule',
  'lotion',
  'cream',
  'eye_cream',
  'mask',
  'balm',
  'spot_treatment',
  'other',
];

const ALL_STEP_ACTIONS: StepAction[] = [
  'cleanse',
  'exfoliate',
  'tone',
  'treat',
  'moisturize',
  'mask',
  'seal',
  'protect',
];

describe('STEP_ACTION_FOR_TYPE exhaustiveness', () => {
  it('maps every ProductType to a StepAction', () => {
    for (const type of ALL_PRODUCT_TYPES) {
      expect(STEP_ACTION_FOR_TYPE[type]).toBeDefined();
      expect(ALL_STEP_ACTIONS).toContain(STEP_ACTION_FOR_TYPE[type]);
    }
  });

  it('has exactly the documented 18 entries — no stray keys', () => {
    expect(Object.keys(STEP_ACTION_FOR_TYPE).sort()).toEqual([...ALL_PRODUCT_TYPES].sort());
  });

  it('maps the PRD_Spec.md §3.2 table verbatim', () => {
    expect(STEP_ACTION_FOR_TYPE).toEqual({
      makeup_remover: 'cleanse',
      cleanser: 'cleanse',
      peeling: 'exfoliate',
      toner: 'tone',
      essence: 'tone',
      ampoule: 'treat',
      serum: 'treat',
      gel: 'treat',
      spot_treatment: 'treat',
      other: 'treat',
      eye_cream: 'moisturize',
      mask: 'mask',
      lotion: 'moisturize',
      cream: 'moisturize',
      moisturizer: 'moisturize',
      oil: 'seal',
      balm: 'seal',
      spf: 'protect',
    });
  });
});

describe('STEP_ACTION_LABELS', () => {
  it('gives every one of the eight actions a Title-Case, one-word label', () => {
    for (const action of ALL_STEP_ACTIONS) {
      const label = STEP_ACTION_LABELS[action];
      expect(label).toBeDefined();
      expect(label).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('has no separate pre_cleanse action — a makeup remover and a cleanser share "cleanse"', () => {
    expect(STEP_ACTION_FOR_TYPE.makeup_remover).toBe('cleanse');
    expect(STEP_ACTION_FOR_TYPE.cleanser).toBe('cleanse');
  });

  it('groups eye_cream under moisturize rather than a separate action', () => {
    expect(STEP_ACTION_FOR_TYPE.eye_cream).toBe('moisturize');
  });
});
