import { computePaoStatus, getProductPaoStatus } from '@/utils/paoHelpers';
import type { Product } from '@/types';

// Fixed "now" used across all tests: 2026-06-27 (Saturday)
const NOW = new Date('2026-06-27T12:00:00.000Z');

// Minimal product factory — only fields relevant to PAO logic
function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'morning',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

// ─── getProductPaoStatus — null-guard tests ───────────────────────────────────

describe('getProductPaoStatus', () => {
  it('should return null when openedDate is null', () => {
    const product = makeProduct({ openedDate: null, paoMonths: 3 });
    expect(getProductPaoStatus(product)).toBeNull();
  });

  it('should return null when paoMonths is null', () => {
    const product = makeProduct({ openedDate: '2026-01-01', paoMonths: null });
    expect(getProductPaoStatus(product)).toBeNull();
  });

  it('should return null when paoMonths is zero', () => {
    const product = makeProduct({ openedDate: '2026-01-01', paoMonths: 0 });
    expect(getProductPaoStatus(product)).toBeNull();
  });

  it('should return null when paoMonths is negative', () => {
    const product = makeProduct({ openedDate: '2026-01-01', paoMonths: -1 });
    expect(getProductPaoStatus(product)).toBeNull();
  });
});

// ─── computePaoStatus — date arithmetic ──────────────────────────────────────

describe('computePaoStatus', () => {
  it('should return isExpired=true and daysRemaining=-1 when product expired 1 day ago', () => {
    // now = 2026-06-27; opened = 2026-05-26 (32 days before now)
    // expiry = 2026-05-26 + 1 month = 2026-06-26 (1 day before now)
    const result = computePaoStatus('2026-05-26', 1, NOW);

    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBe(-1);
    expect(result.isExpiringSoon).toBe(false);
  });

  it('should return isExpiringSoon=true and daysRemaining=5 when expiry is 5 days away', () => {
    // now = 2026-06-27; opened = 2026-06-02 (25 days before now)
    // expiry = 2026-06-02 + 1 month = 2026-07-02 (5 days from now)
    const result = computePaoStatus('2026-06-02', 1, NOW);

    expect(result.isExpiringSoon).toBe(true);
    expect(result.daysRemaining).toBe(5);
    expect(result.isExpired).toBe(false);
  });

  it('should return neither flag when product has 31 days remaining', () => {
    // now = 2026-06-27; opened = 2026-04-28 (60 days before now)
    // expiry = 2026-04-28 + 3 months = 2026-07-28 (31 days from now)
    const result = computePaoStatus('2026-04-28', 3, NOW);

    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(false);
    expect(result.daysRemaining).toBe(31);
  });

  it('should return isExpiringSoon=true and daysRemaining=30 when opened today + paoMonths=1', () => {
    // now = 2026-06-27; opened = 2026-06-27
    // expiry = 2026-06-27 + 1 month = 2026-07-27 (30 days from now)
    const result = computePaoStatus('2026-06-27', 1, NOW);

    expect(result.isExpiringSoon).toBe(true);
    expect(result.daysRemaining).toBe(30);
    expect(result.isExpired).toBe(false);
  });

  it('should return isExpired=true when daysRemaining is negative', () => {
    // now = 2026-06-27; opened = 2026-03-01 (118 days before now)
    // expiry = 2026-03-01 + 3 months = 2026-06-01 (26 days before now)
    const result = computePaoStatus('2026-03-01', 3, NOW);

    expect(result.isExpired).toBe(true);
    expect(result.daysRemaining).toBeLessThan(0);
    expect(result.isExpiringSoon).toBe(false);
  });
});
