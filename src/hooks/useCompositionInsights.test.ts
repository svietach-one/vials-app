/**
 * Unit test — `useCompositionInsights` (Story 9, tech design FE-18).
 *
 * Mocks `productsStore`/`profileStore` at the module boundary and asserts
 * this hook is a pure recomposition of the already-tested builders
 * (`resolveFromRawText`, `joinActiveKeys`, `buildCapabilities`,
 * `buildSkinTypeCaution`, `buildShelfComparison`, `buildRoutinePosition`) —
 * no new detection/matching logic of its own — same convention as
 * FE-9/FE-10/FE-11's own co-located unit tests.
 */
import { renderHook } from '@testing-library/react-native';

let mockProducts: unknown[] = [];
jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

let mockProfile: { skinType: string | null } | null = { skinType: null };
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

let mockRoutines: import('@/types').Routine[] = [];
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) => selector({ routines: mockRoutines })),
}));

import { useCompositionInsights } from '@/hooks/useCompositionInsights';
import type { Routine, RoutineStep } from '@/types';
import { makeProduct } from '../../tests/explore-composition/fixtures';

const RAW_TEXT = 'Aqua, Niacinamide, Hyaluronic Acid';

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: 'step-1',
    productType: 'serum',
    productId: 'p1',
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r1',
    name: 'Morning',
    timeOfDay: 'morning',
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockProducts = [];
  mockProfile = { skinType: null };
  mockRoutines = [];
});

describe('resolvedActiveKeys / capabilityTags — real resolve/join/capabilities pipeline, no reimplementation', () => {
  it('exposes the real resolvedActiveKeys for the given raw text', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.resolvedActiveKeys).toEqual(
      expect.arrayContaining(['niacinamide', 'hyaluronic_acid']),
    );
  });

  it('exposes capability tags derived from the real buildCapabilities output', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    // Niacinamide/hyaluronic acid resolve to real, positive-score capability
    // tags via the actual (unmocked) capabilities.ts pipeline.
    expect(result.current.capabilityTags.length).toBeGreaterThan(0);
  });

  it('returns no resolved keys or capability tags for text with nothing recognizable', () => {
    const { result } = renderHook(() => useCompositionInsights('Aqua, Xanthan Weirdum', null));

    expect(result.current.resolvedActiveKeys).toEqual([]);
    expect(result.current.capabilityTags).toEqual([]);
  });
});

describe('skinType / skinTypeCaution — reads profileStore, delegates to buildSkinTypeCaution', () => {
  it('exposes profile.skinType as-is', () => {
    mockProfile = { skinType: 'oily' };
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinType).toBe('oily');
  });

  it('exposes null skinType when the profile has none set', () => {
    mockProfile = { skinType: null };
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinType).toBeNull();
  });

  it('fires the caution for a known trigger class (aha) regardless of null skinType (suppression is the caller\'s job, not this hook\'s)', () => {
    const { result } = renderHook(() => useCompositionInsights('Aqua, Glycolic Acid', null));

    expect(result.current.skinTypeCaution).not.toBeNull();
  });

  it('does not fire the caution for a composition with no triggering class', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.skinTypeCaution).toBeNull();
  });
});

describe('shelfComparison / routinePosition — gated on category, reads productsStore', () => {
  it('is null for both when category is null, never calling the category-only builders', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.shelfComparison).toBeNull();
    expect(result.current.routinePosition).toBeNull();
  });

  it('computes a real shelfComparison and routinePosition when category is set', () => {
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.shelfComparison).not.toBeNull();
    expect(result.current.shelfComparison?.category).toBe('serum');
    expect(result.current.routinePosition).not.toBeNull();
  });

  it('reflects productsStore.products read fresh — a zero-item shelf renders the zero-items population', () => {
    mockProducts = [];
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.shelfComparison?.sameCategoryCount).toBe(0);
  });
});

describe('ingredientTokens / ingredientCount / positionByKey — explore-insights-v2 task 01', () => {
  it('exposes the ordered comma-split tokens and a matching count', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.ingredientTokens).toEqual(['Aqua', 'Niacinamide', 'Hyaluronic Acid']);
    expect(result.current.ingredientCount).toBe(result.current.ingredientTokens.length);
  });

  it('exposes the real resolve.ts positionByKey for the given raw text', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.positionByKey.niacinamide).toBe(2);
  });

  it('does not expose unresolvedIngredientTokens — it is a matcher-gap signal, not a user-facing metric', () => {
    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect('unresolvedIngredientTokens' in result.current).toBe(false);
  });
});

describe('routineFit — explore-insights-v2 task 06', () => {
  it('is null when category is null, same gate as routinePosition', () => {
    mockRoutines = [makeRoutine({ steps: [makeStep({ productId: 'p1' })] })];
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];

    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, null));

    expect(result.current.routineFit).toBeNull();
  });

  it('resolves an occupant by matching the whole layering phase, not just an exact ProductType (serum/gel share a slot)', () => {
    mockRoutines = [
      makeRoutine({ steps: [makeStep({ productId: 'p1', productType: 'gel' })] }),
    ];
    mockProducts = [makeProduct({ id: 'p1', brand: 'CeraVe', name: 'PM Lotion', productType: 'gel' })];

    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.routineFit?.occupants).toEqual([{ id: 'p1', label: 'CeraVe PM Lotion' }]);
  });

  it('contributes nothing for a step with a null productId, and does not crash', () => {
    mockRoutines = [makeRoutine({ steps: [makeStep({ productId: null })] })];

    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.routineFit?.occupants).toEqual([]);
  });

  it('excludes a hidden step from occupants', () => {
    mockRoutines = [makeRoutine({ steps: [makeStep({ productId: 'p1', hidden: true })] })];
    mockProducts = [makeProduct({ id: 'p1', productType: 'serum' })];

    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.routineFit?.occupants).toEqual([]);
  });

  it('exposes the real getMorningSpfState result via morningSpf', () => {
    mockRoutines = [];

    const { result } = renderHook(() => useCompositionInsights(RAW_TEXT, 'serum'));

    expect(result.current.routineFit?.morningSpf).toBe('no-morning-routine');
  });
});
