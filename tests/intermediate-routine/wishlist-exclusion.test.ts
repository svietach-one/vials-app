/**
 * Owned-only engine input (spec Story 2 AC6, G7, Q8; tech design FE-3):
 * wishlist products are excluded at buildEngineInputFromStores, so the live gap
 * cards (validateCurrentRoutines), the Draft Preview (generateDraftPlan) and the
 * list share ONE input, and currentOverrideHash ignores wishlist ids.
 */
jest.mock('@/services/storage', () => {
  const actual = jest.requireActual('@/services/storage');
  return {
    ...actual,
    loadJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
    saveJson: jest.fn(async () => undefined),
    loadSchemaVersion: jest.fn(async () => 99),
    persistSchemaVersionIfBehind: jest.fn(),
  };
});

import {
  activeOverrides,
  buildEngineInputFromStores,
  currentOverrideHash,
  generateDraftPlan,
  validateCurrentRoutines,
} from '@/domain/routinePlanActions';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useTrackingStore } from '@/store/trackingStore';
import type { Product } from '@/types';
import { isOwnedProduct } from '@/utils/productOwnership';
import { buildLeftOutItems } from '@/utils/routineLeftOut';
import { gapKeys, ids, makeS3, NOW, resetFixtureCounters, S3, shelfProduct } from './fixtures';

const wishlistToner = () => shelfProduct('wish-toner', 'Wishlist Toner', 'toner', { status: 'wishlist' });

beforeEach(() => {
  resetFixtureCounters();
  useProductsStore.setState({ products: [...makeS3(), wishlistToner()] });
  useRoutinesStore.setState({ routines: [] });
  useTrackingStore.setState({ overrides: [], overrideHash: '' });
});

describe('isOwnedProduct', () => {
  it.each([
    ['status owned', 'owned' as const, true],
    ['status absent (legacy records)', undefined, true],
    ['status wishlist', 'wishlist' as const, false],
  ])('treats %s as owned=%s', (_label, status, expected) => {
    const p: Product = shelfProduct('p', 'P', 'cream', status ? { status } : {});

    expect(isOwnedProduct(p)).toBe(expected);
  });

  it('does not treat a hidden owned product as a wishlist product', () => {
    expect(isOwnedProduct(shelfProduct('p', 'P', 'cream', { isHidden: true }))).toBe(true);
  });
});

describe('one owned-only input', () => {
  it('leaves the wishlist product out of the engine input', () => {
    expect(buildEngineInputFromStores(NOW).products.map((p) => p.id)).toEqual([S3.cleanser, S3.cream, S3.spf]);
  });

  it('keeps the wishlist toner out of the draft plan, in no bucket', () => {
    const plan = generateDraftPlan(NOW);

    const everywhere = [
      ...ids(plan.periods.morning), ...ids(plan.periods.evening),
      ...plan.reserve.map((r) => r.productId), ...plan.frozen.map((f) => f.productId),
      ...(plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)),
    ];
    expect(everywhere).not.toContain('wish-toner');
  });

  it('still raises the toner gap cards, and the live cards equal the draft\'s placeholders', () => {
    const live = validateCurrentRoutines(NOW).proposedPlan;
    const draft = generateDraftPlan(NOW);

    expect(gapKeys(live)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
    expect(JSON.stringify(live.placeholders)).toBe(JSON.stringify(draft.placeholders));
  });

  it('does not list the wishlist toner in "Not in your routine"', () => {
    const { proposedPlan } = validateCurrentRoutines(NOW);

    const listed = buildLeftOutItems(proposedPlan, useProductsStore.getState().products, []);

    expect(listed.map((i) => i.productId)).not.toContain('wish-toner');
  });
});

describe('"Add anyway" overrides survive a wishlist change', () => {
  it('hashes owned ids only, so adding a wishlist product does not change the hash', () => {
    useProductsStore.setState({ products: makeS3() });
    const owned = currentOverrideHash();

    useProductsStore.setState({ products: [...makeS3(), wishlistToner()] });

    expect(currentOverrideHash()).toBe(owned);
  });

  it('keeps an active override when a wishlist product is saved, and drops it when an OWNED product is added', () => {
    useProductsStore.setState({ products: makeS3() });
    useTrackingStore.getState().addOverride(S3.cream, currentOverrideHash());
    expect(activeOverrides()).toEqual([S3.cream]);

    useProductsStore.setState({ products: [...makeS3(), wishlistToner()] });
    expect(activeOverrides()).toEqual([S3.cream]);

    useProductsStore.setState({ products: [...makeS3(), shelfProduct('owned-toner', 'Toner', 'toner')] });
    expect(activeOverrides()).toEqual([]);
  });
});
