/**
 * Unit tests for the phototype-aware SPF adequacy check (PRD v1.2 §4.2.1,
 * US-29). "Now" is always injected — never read from the real clock.
 */

import { getSpfAdequacyFinding, SPF_ADEQUACY_THRESHOLD } from '@/utils/spfAdequacy';
import type { Product, Routine } from '@/types';

// A July date: summer in the northern hemisphere.
const SUMMER = new Date('2026-07-15T09:00:00Z');
const WINTER = new Date('2026-01-15T09:00:00Z');

let idCounter = 0;
const nextId = () => `spf-${++idCounter}`;

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: nextId(),
    name: 'Daily Fluid',
    brand: null,
    productType: 'spf',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    spfValue: null,
    ...overrides,
  };
}

function morningRoutine(products: Product[]): Routine {
  return {
    id: 'r-am',
    name: 'Morning',
    timeOfDay: 'morning',
    steps: products.map((p) => ({
      id: nextId(),
      productType: p.productType,
      productId: p.id,
      hidden: false,
      scheduledDays: [],
    })),
  };
}

function check(products: Product[], overrides: Partial<Parameters<typeof getSpfAdequacyFinding>[0]> = {}) {
  return getSpfAdequacyFinding({
    routines: [morningRoutine(products)],
    products,
    fitzpatrick: 2,
    now: SUMMER,
    ...overrides,
  });
}

describe('getSpfAdequacyFinding — phototype gate', () => {
  it('recommends a higher SPF for a light phototype', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 20, name: 'City Fluid SPF 20' })];
    // Act
    const finding = check(products);
    // Assert
    expect(finding).not.toBeNull();
    expect(finding?.lowestSpf).toBe(20);
    expect(finding?.productName).toBe('City Fluid SPF 20');
  });

  it('stays silent for medium and dark phototypes (deferred in v1)', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 20 })];
    // Act / Assert
    expect(check(products, { fitzpatrick: 4 })).toBeNull();
    expect(check(products, { fitzpatrick: 6 })).toBeNull();
  });

  it('falls back to the grouped phototype when the numeric one is unset', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 15 })];
    // Act
    const finding = check(products, { fitzpatrick: null, phototype: 'type_1_2' });
    // Assert
    expect(finding).not.toBeNull();
  });

  it('stays silent when no phototype is known at all', () => {
    const products = [makeProduct({ spfValue: 15 })];
    expect(check(products, { fitzpatrick: null, phototype: null })).toBeNull();
  });
});

describe('getSpfAdequacyFinding — season gate', () => {
  it('stays silent outside summer', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 20 })];
    // Act / Assert
    expect(check(products, { now: WINTER })).toBeNull();
  });
});

describe('getSpfAdequacyFinding — threshold boundary', () => {
  it('does not fire at exactly the recommended minimum', () => {
    // Arrange
    const products = [makeProduct({ spfValue: SPF_ADEQUACY_THRESHOLD })];
    // Act / Assert
    expect(check(products)).toBeNull();
  });

  it('fires one point below the recommended minimum', () => {
    // Arrange
    const products = [makeProduct({ spfValue: SPF_ADEQUACY_THRESHOLD - 1 })];
    // Act
    const finding = check(products);
    // Assert
    expect(finding?.lowestSpf).toBe(29);
  });

  it('reports the lowest scheduled SPF when several are known', () => {
    // Arrange
    const products = [
      makeProduct({ spfValue: 50, name: 'High' }),
      makeProduct({ spfValue: 15, name: 'Low' }),
    ];
    // Act
    const finding = check(products);
    // Assert
    expect(finding?.lowestSpf).toBe(15);
    expect(finding?.productName).toBe('Low');
  });
});

describe('getSpfAdequacyFinding — missing data', () => {
  it('stays silent when the scheduled SPF product has no spfValue', () => {
    // Arrange — missing data means "can't check", not "assume the worst"
    const products = [makeProduct({ spfValue: null })];
    // Act / Assert
    expect(check(products)).toBeNull();
  });

  it('stays silent on a product saved before the field existed', () => {
    // Arrange
    const product = makeProduct();
    delete (product as { spfValue?: number | null }).spfValue;
    // Act / Assert
    expect(check([product])).toBeNull();
  });

  it('ignores an unknown SPF beside a known low one', () => {
    // Arrange
    const products = [makeProduct({ spfValue: null }), makeProduct({ spfValue: 20, name: 'Low' })];
    // Act
    const finding = check(products);
    // Assert
    expect(finding?.lowestSpf).toBe(20);
  });

  it('stays silent when no SPF product is scheduled at all', () => {
    // Arrange — a separate, deliberately deferred story
    const products = [makeProduct({ productType: 'serum', spfValue: 10 })];
    // Act / Assert
    expect(check(products)).toBeNull();
  });
});

describe('getSpfAdequacyFinding — scheduling', () => {
  it('ignores an SPF product scheduled only in the evening routine', () => {
    // Arrange
    const product = makeProduct({ spfValue: 15 });
    const evening: Routine = {
      id: 'r-pm',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: [
        { id: 's-pm', productType: 'spf', productId: product.id, hidden: false, scheduledDays: [] },
      ],
    };
    // Act
    const finding = getSpfAdequacyFinding({
      routines: [evening],
      products: [product],
      fitzpatrick: 1,
      now: SUMMER,
    });
    // Assert
    expect(finding).toBeNull();
  });

  it('ignores a hidden step', () => {
    // Arrange
    const product = makeProduct({ spfValue: 15 });
    const routine = morningRoutine([product]);
    routine.steps[0].hidden = true;
    // Act
    const finding = getSpfAdequacyFinding({
      routines: [routine],
      products: [product],
      fitzpatrick: 1,
      now: SUMMER,
    });
    // Assert
    expect(finding).toBeNull();
  });
});

describe('getSpfAdequacyFinding — dismiss key', () => {
  it('scopes the dismiss key to the season and year', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 20 })];
    // Act
    const finding = check(products);
    // Assert
    expect(finding?.dismissKey).toBe('spf-upgrade-summer-2026');
  });

  it('produces a different key in a later summer', () => {
    // Arrange
    const products = [makeProduct({ spfValue: 20 })];
    // Act
    const finding = check(products, { now: new Date('2027-07-15T09:00:00Z') });
    // Assert
    expect(finding?.dismissKey).toBe('spf-upgrade-summer-2027');
  });
});
