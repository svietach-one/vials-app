/**
 * Unit tests for active ingredient density insights (PRD v1.2 §5.2, US-28).
 * Pure logic: routines + products in, findings out.
 */

import {
  DENSITY_MESSAGES,
  TIER_MAP,
  applyConditionDensityModifiers,
  getActiveDensityFindings,
  type DensityGroup,
  type PeriodSteps,
  type RoutinePeriod,
} from '@/utils/activeIngredientDensity';
import type { ActiveIngredientKey, Product, RoutineStep } from '@/types';

// ─── Factories ────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `den-${++idCounter}`;

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

function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId(),
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutine(period: RoutinePeriod, steps: RoutineStep[]): PeriodSteps {
  return { period, steps };
}

/** One period holding the given products, as the engine sees it. */
function routineOf(period: RoutinePeriod, products: Product[]): PeriodSteps {
  return makeRoutine(period, products.map((p) => makeStep(p.id)));
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

describe('TIER_MAP', () => {
  it('assigns every tiered group to insight or warning', () => {
    // Arrange
    const expected: Record<DensityGroup, 'insight' | 'warning'> = {
      VIT_C: 'insight',
      AZA: 'insight',
      PEPT: 'insight',
      RETI: 'warning',
      ACID: 'warning',
      BPO: 'warning',
    };
    // Act / Assert
    expect(TIER_MAP).toEqual(expected);
  });

  it('has copy for both tiers of every group', () => {
    for (const group of Object.keys(TIER_MAP) as DensityGroup[]) {
      expect(DENSITY_MESSAGES[group].insight.length).toBeGreaterThan(0);
      expect(DENSITY_MESSAGES[group].warning.length).toBeGreaterThan(0);
    }
  });
});

// ─── Threshold ────────────────────────────────────────────────────────────────

describe('getActiveDensityFindings — 2-product threshold', () => {
  it('renders nothing for a single product carrying the tag', () => {
    // Arrange
    const products = [makeProduct(['retinoid'])];
    // Act
    const findings = getActiveDensityFindings([routineOf('evening', products)], products);
    // Assert
    expect(findings).toEqual([]);
  });

  it('fires at exactly two products sharing the tag', () => {
    // Arrange
    const products = [makeProduct(['retinoid']), makeProduct(['retinoid'])];
    // Act
    const findings = getActiveDensityFindings([routineOf('evening', products)], products);
    // Assert
    expect(findings).toHaveLength(1);
    expect(findings[0].group).toBe('RETI');
    expect(findings[0].tier).toBe('warning');
  });

  it('counts one product matching two keys of a group as one product', () => {
    // Arrange — an AHA + BHA exfoliant on its own is not density
    const products = [makeProduct(['aha', 'bha'])];
    // Act
    const findings = getActiveDensityFindings([routineOf('evening', products)], products);
    // Assert
    expect(findings).toEqual([]);
  });

  it('treats different acids in different products as one shared group', () => {
    // Arrange
    const products = [makeProduct(['aha']), makeProduct(['bha'])];
    // Act
    const findings = getActiveDensityFindings([routineOf('evening', products)], products);
    // Assert
    expect(findings).toHaveLength(1);
    expect(findings[0].group).toBe('ACID');
  });
});

// ─── Ignore tier ──────────────────────────────────────────────────────────────

describe('getActiveDensityFindings — ignore tier', () => {
  it.each<[string, ActiveIngredientKey]>([
    ['niacinamide', 'niacinamide'],
    ['ceramides', 'ceramides'],
    ['panthenol', 'panthenol'],
    ['glycerin', 'glycerin_class'],
    ['hyaluronic acid', 'hyaluronic_acid'],
    ['signal peptides', 'peptide_signal'],
    ['SPF filters', 'spf_filters'],
  ])('renders nothing when two products share %s', (_label, key) => {
    // Arrange
    const products = [makeProduct([key]), makeProduct([key])];
    // Act
    const findings = getActiveDensityFindings([routineOf('morning', products)], products);
    // Assert
    expect(findings).toEqual([]);
  });
});

// ─── Insight tier ─────────────────────────────────────────────────────────────

describe('getActiveDensityFindings — insight tier', () => {
  it.each<[DensityGroup, ActiveIngredientKey]>([
    ['VIT_C', 'vitamin_c_pure'],
    ['AZA', 'azelaic_acid'],
    ['PEPT', 'copper_peptides'],
  ])('renders %s as an insight, not a warning', (group, key) => {
    // Arrange
    const products = [makeProduct([key]), makeProduct([key])];
    // Act
    const findings = getActiveDensityFindings([routineOf('morning', products)], products);
    // Assert
    expect(findings).toHaveLength(1);
    expect(findings[0].group).toBe(group);
    expect(findings[0].tier).toBe('insight');
    expect(findings[0].severity).toBe('low');
  });

  it('groups pure and derivative vitamin C as one finding', () => {
    // Arrange
    const products = [makeProduct(['vitamin_c_pure']), makeProduct(['vitamin_c_derivative'])];
    // Act
    const findings = getActiveDensityFindings([routineOf('morning', products)], products);
    // Assert
    expect(findings).toHaveLength(1);
    expect(findings[0].group).toBe('VIT_C');
  });
});

// ─── Period scoping ───────────────────────────────────────────────────────────

describe('getActiveDensityFindings — period scoping', () => {
  it('does not fire across periods', () => {
    // Arrange — one retinoid in the morning, one in the evening
    const am = makeProduct(['retinoid']);
    const pm = makeProduct(['retinoid']);
    const routines = [routineOf('morning', [am]), routineOf('evening', [pm])];
    // Act
    const findings = getActiveDensityFindings(routines, [am, pm]);
    // Assert
    expect(findings).toEqual([]);
  });

  it('reports each period independently when both are dense', () => {
    // Arrange
    const products = [
      makeProduct(['aha']),
      makeProduct(['bha']),
      makeProduct(['aha']),
      makeProduct(['bha']),
    ];
    const routines = [
      routineOf('morning', products.slice(0, 2)),
      routineOf('evening', products.slice(2)),
    ];
    // Act
    const findings = getActiveDensityFindings(routines, products);
    // Assert
    expect(findings.map((f) => f.period).sort()).toEqual(['evening', 'morning']);
  });
});

// ─── Step visibility and day scoping ──────────────────────────────────────────

describe('getActiveDensityFindings — visibility', () => {
  it('ignores hidden steps', () => {
    // Arrange
    const a = makeProduct(['retinoid']);
    const b = makeProduct(['retinoid']);
    const routine = makeRoutine('evening', [makeStep(a.id), makeStep(b.id, { hidden: true })]);
    // Act
    const findings = getActiveDensityFindings([routine], [a, b]);
    // Assert
    expect(findings).toEqual([]);
  });

  it('ignores products hidden from the shelf', () => {
    // Arrange
    const a = makeProduct(['retinoid']);
    const b = makeProduct(['retinoid'], { isHidden: true });
    // Act
    const findings = getActiveDensityFindings([routineOf('evening', [a, b])], [a, b]);
    // Assert
    expect(findings).toEqual([]);
  });

  it('scopes to a weekday when one is given', () => {
    // Arrange — both retinoids exist, but only one runs on Monday (1)
    const a = makeProduct(['retinoid']);
    const b = makeProduct(['retinoid']);
    const routine = makeRoutine('evening', [
      makeStep(a.id, { scheduledDays: [1] }),
      makeStep(b.id, { scheduledDays: [3] }),
    ]);
    // Act
    const monday = getActiveDensityFindings([routine], [a, b], { dayOfWeek: 1 });
    const unscoped = getActiveDensityFindings([routine], [a, b]);
    // Assert
    expect(monday).toEqual([]);
    expect(unscoped).toHaveLength(1);
  });
});

// ─── Condition escalation (US-28) ─────────────────────────────────────────────

describe('applyConditionDensityModifiers', () => {
  function vitaminCInsight() {
    const products = [makeProduct(['vitamin_c_pure']), makeProduct(['vitamin_c_pure'])];
    return getActiveDensityFindings([routineOf('morning', products)], products);
  }

  it('returns findings unchanged when no condition is selected', () => {
    // Arrange
    const findings = vitaminCInsight();
    // Act
    const modified = applyConditionDensityModifiers(findings, []);
    // Assert
    expect(modified).toBe(findings);
  });

  it('escalates an insight to a warning when a condition targets the group', () => {
    // Arrange — eczema targets vitamin C
    const findings = vitaminCInsight();
    // Act
    const modified = applyConditionDensityModifiers(findings, ['eczema']);
    // Assert
    expect(modified[0].tier).toBe('warning');
    expect(modified[0].severity).toBe('medium');
    expect(modified[0].message).toBe(DENSITY_MESSAGES.VIT_C.warning);
  });

  it('leaves an insight alone when no selected condition targets its group', () => {
    // Arrange — rosacea does not target vitamin C
    const findings = vitaminCInsight();
    // Act
    const modified = applyConditionDensityModifiers(findings, ['rosacea']);
    // Assert
    expect(modified[0].tier).toBe('insight');
  });

  it('escalates once when several conditions target the same group', () => {
    // Arrange
    const findings = vitaminCInsight();
    // Act
    const modified = applyConditionDensityModifiers(findings, ['eczema', 'rosacea']);
    // Assert — no tier above warning exists to stack into
    expect(modified[0].tier).toBe('warning');
    expect(modified[0].escalatedBy).toEqual(['eczema']);
  });

  it('leaves a warning-tier finding at the cap', () => {
    // Arrange
    const products = [makeProduct(['retinoid']), makeProduct(['retinoid'])];
    const findings = getActiveDensityFindings([routineOf('evening', products)], products);
    // Act
    const modified = applyConditionDensityModifiers(findings, ['eczema', 'rosacea']);
    // Assert
    expect(modified[0].tier).toBe('warning');
    expect(modified[0].escalatedBy).toEqual([]);
  });
});
