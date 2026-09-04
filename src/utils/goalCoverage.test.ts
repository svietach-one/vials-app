/**
 * Unit tests for the standing goal-coverage check (engine4.1 handoff §3).
 * Pure logic: goal pair + treatmentClassRanking + shelf/routine products +
 * pregnancyRules in, findings out. treatmentClassRanking is supplied
 * pre-resolved by every test (resolveGoalContext's own correctness is
 * covered by context.test.ts) so these tests isolate the coverage/shelf/
 * safety-redirect decision logic from the modifier math.
 */
import {
  buildSafetyRedirectMessage,
  coverageClasses,
  getGoalCoverageFindings,
  type GoalCoverageInput,
} from '@/utils/goalCoverage';
import type { PregnancyFreezeRule } from '@/utils/routineEngine/context';
import type { ActiveIngredientKey, Product } from '@/types';

// ─── Factories ────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `gc-${++idCounter}`;

function makeProduct(keys: ActiveIngredientKey[], overrides: Partial<Product> = {}): Product {
  return {
    id: nextId(),
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function pregnancyFreeze(classes: ActiveIngredientKey[]): PregnancyFreezeRule {
  return { targets: { classes }, reasonCode: 'pregnancy_blocked' };
}

const baseInput = (overrides: Partial<GoalCoverageInput> = {}): GoalCoverageInput => ({
  primaryGoal: 'acne',
  secondaryGoal: null,
  goalNeedsConfirmation: false,
  treatmentClassRanking: [],
  scheduledProducts: [],
  products: [],
  pregnancyRules: [],
  ...overrides,
});

// ─── coverageClasses ────────────────────────────────────────────────────────

describe('coverageClasses', () => {
  it('intersects the ranking with the real actives.json goals list, preserving ranking order', () => {
    const result = coverageClasses('acne', ['niacinamide', 'retinoid', 'hyaluronic_acid']);
    expect(result).toEqual(['niacinamide', 'retinoid']); // hyaluronic_acid does not solve acne
  });

  it('is always empty for maintenance, regardless of ranking content', () => {
    expect(coverageClasses('maintenance', ['retinoid', 'niacinamide'])).toEqual([]);
  });

  it('is empty when the ranking itself is empty (e.g. a modifier dropped everything)', () => {
    expect(coverageClasses('aging', [])).toEqual([]);
  });
});

// ─── getGoalCoverageFindings — skip conditions ─────────────────────────────

describe('getGoalCoverageFindings — cases that must never nag', () => {
  it('returns no findings when the goal was migration-derived and unconfirmed', () => {
    const input = baseInput({
      goalNeedsConfirmation: true,
      treatmentClassRanking: ['retinoid'],
      products: [],
    });
    expect(getGoalCoverageFindings(input)).toEqual([]);
  });

  it('never reports maintenance as uncovered', () => {
    const input = baseInput({ primaryGoal: 'maintenance', treatmentClassRanking: ['retinoid'] });
    expect(getGoalCoverageFindings(input)).toEqual([]);
  });

  it('skips a null secondaryGoal', () => {
    const input = baseInput({
      primaryGoal: 'maintenance',
      secondaryGoal: null,
      treatmentClassRanking: [],
    });
    expect(getGoalCoverageFindings(input)).toEqual([]);
  });

  it('does not nag when the intersection is empty — unaddressable by design, not "uncovered"', () => {
    // A barrier_repair modifier (or any other reason) could zero out the
    // ranking entirely; regardless of why, an empty ranking must never
    // produce a finding.
    const input = baseInput({ primaryGoal: 'acne', treatmentClassRanking: [] });
    expect(getGoalCoverageFindings(input)).toEqual([]);
  });

  it('does not nag when a scheduled, non-frozen product already covers the goal', () => {
    const covering = makeProduct(['retinoid']);
    const input = baseInput({
      primaryGoal: 'acne',
      treatmentClassRanking: ['retinoid'],
      scheduledProducts: [covering],
      products: [covering],
    });
    expect(getGoalCoverageFindings(input)).toEqual([]);
  });

  it('dedupes when primaryGoal and secondaryGoal are the same value', () => {
    const input = baseInput({
      primaryGoal: 'dehydration',
      secondaryGoal: 'dehydration',
      treatmentClassRanking: ['hyaluronic_acid'],
    });
    expect(getGoalCoverageFindings(input)).toHaveLength(1);
  });
});

// ─── getGoalCoverageFindings — not_owned / on_shelf ────────────────────────

describe('getGoalCoverageFindings — shelf states', () => {
  it('reports not_owned when nothing on the shelf carries a coverage class', () => {
    const input = baseInput({
      primaryGoal: 'dehydration',
      treatmentClassRanking: ['hyaluronic_acid', 'ceramides'],
      products: [makeProduct(['niacinamide'])],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('not_owned');
    expect(finding.goal).toBe('dehydration');
  });

  it('reports on_shelf when an owned, non-frozen match exists but is not scheduled', () => {
    const owned = makeProduct(['hyaluronic_acid']);
    const input = baseInput({
      primaryGoal: 'dehydration',
      treatmentClassRanking: ['hyaluronic_acid'],
      scheduledProducts: [],
      products: [owned],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('on_shelf');
  });

  it('reports both goals in primary-then-secondary order when both are uncovered', () => {
    const input = baseInput({
      primaryGoal: 'dehydration',
      secondaryGoal: 'oil_control',
      treatmentClassRanking: ['hyaluronic_acid', 'niacinamide'],
      products: [],
    });
    const findings = getGoalCoverageFindings(input);
    expect(findings.map((f) => f.goal)).toEqual(['dehydration', 'oil_control']);
    expect(findings.every((f) => f.tone === 'not_owned')).toBe(true);
  });
});

// ─── getGoalCoverageFindings — the pregnancy false-negative case ──────────

describe('getGoalCoverageFindings — safety_redirect (the false-negative this feature exists to prevent)', () => {
  it('reports safety_redirect, not not_owned, when the only owned match is pregnancy-frozen', () => {
    const retinolProduct = makeProduct(['retinoid']);
    const input = baseInput({
      primaryGoal: 'aging',
      treatmentClassRanking: ['retinoid'],
      scheduledProducts: [],
      products: [retinolProduct],
      pregnancyRules: [pregnancyFreeze(['retinoid'])],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('safety_redirect');
    expect(finding.message).toContain('doctor or dermatologist');
  });

  it('names the pregnancy-safe alternative classes when the ranking has one', () => {
    const retinolProduct = makeProduct(['retinoid']);
    const input = baseInput({
      primaryGoal: 'aging',
      treatmentClassRanking: ['retinoid', 'peptide_signal'],
      products: [retinolProduct],
      pregnancyRules: [pregnancyFreeze(['retinoid'])],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('safety_redirect');
    expect(finding.message).toContain('Signal Peptides');
  });

  it('falls back to on_shelf instead of safety_redirect when a non-frozen owned match also exists', () => {
    // A safe option is already on the shelf — this is not the dangerous case,
    // it is an ordinary "on shelf, not scheduled" nudge.
    const retinolProduct = makeProduct(['retinoid']);
    const peptideProduct = makeProduct(['peptide_signal']);
    const input = baseInput({
      primaryGoal: 'aging',
      treatmentClassRanking: ['retinoid', 'peptide_signal'],
      products: [retinolProduct, peptideProduct],
      pregnancyRules: [pregnancyFreeze(['retinoid'])],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('on_shelf');
  });

  it('never emits safety_redirect when pregnancyRules is empty (not pregnant, or flag off)', () => {
    const retinolProduct = makeProduct(['retinoid']);
    const input = baseInput({
      primaryGoal: 'aging',
      treatmentClassRanking: ['retinoid'],
      products: [retinolProduct],
      pregnancyRules: [],
    });
    const [finding] = getGoalCoverageFindings(input);
    expect(finding.tone).toBe('on_shelf');
  });

  it('omits the alternative clause when the ranking offers no safe class to name', () => {
    const message = buildSafetyRedirectMessage('aging', ['retinoid'], []);
    expect(message).not.toContain('gentler option');
    expect(message).toContain('doctor or dermatologist');
  });
});
