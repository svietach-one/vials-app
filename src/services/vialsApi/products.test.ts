import { COMMUNITY_CONTRIBUTION_ENABLED } from '@/constants/featureFlags';
import { suggestProductInBackground } from '@/services/vialsApi/products';
import type { AddProductDraft } from '@/types';

/**
 * Service-boundary test — the community-contribution gate. No request may
 * escape while the feature is disabled: the endpoint does not exist (PRD §4.3),
 * so firing it would only produce a swallowed failure behind UI that had
 * already implied success. Network is asserted via a mocked global fetch, so
 * nothing can reach the wire from a test (testing.md).
 */

const originalFetch = global.fetch;

function makeDraft(): AddProductDraft {
  return {
    brand: 'Vials',
    brandSource: 'typed',
    name: 'Test Serum',
    nameSource: 'typed',
    productType: 'serum',
    productTypeSource: 'manual',
    barcode: '1234567890123',
    inciRaw: 'Aqua, Glycerin',
    activeIngredientKeys: [],
    ingredientsSource: 'checklist',
    ocrDerivedKeys: [],
    isOpened: false,
    openedDate: null,
    paoMonths: 12,
    sectionStatus: {
      brand: 'complete',
      barcode: 'complete',
      ingredients: 'complete',
      usage: 'complete',
    },
    expandedSection: null,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('suggestProductInBackground', () => {
  it('makes no network request while community contribution is disabled', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await suggestProductInBackground(makeDraft());

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves without throwing so no caller can surface a failure', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;

    await expect(suggestProductInBackground(makeDraft())).resolves.toBeUndefined();
  });

  it('documents the gate: the flag is off until a contribution endpoint exists', () => {
    // A deliberate tripwire — flipping the flag without a real endpoint
    // reintroduces the false-success UX this gate removed (BLOCKERS.md#2).
    expect(COMMUNITY_CONTRIBUTION_ENABLED).toBe(false);
  });
});
