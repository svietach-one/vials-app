/**
 * FE-1 / FE-2 / FE-7 — `isPhysicalExfoliant` as the sole source of the
 * `physical_exfoliant` active key.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md (Story 3, AC3)
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3
 *
 * `isPhysicalExfoliant` is a plain boolean product attribute, not something
 * derivable from INCI text — a scrub's abrasive particles never show up in an
 * ingredient list the way a chemical active does. These tests lock two
 * independent guarantees:
 *   1. The flag alone is sufficient, regardless of ingredient text content.
 *   2. Ingredient text alone is never sufficient — the physical_exfoliant
 *      class stays matcher-less (FE-3), so no INCI wording can spoof it.
 */
import { getProductActiveKeys, parseActiveIngredientsFromInci } from '@/utils/ingredientParser';
import { makeProduct } from './fixtures';

const EXFOLIANT_SOUNDING_INCI =
  'Aqua, Walnut Shell Powder, Jojoba Esters, Microcrystalline Cellulose, Apricot Kernel Powder';

describe('isPhysicalExfoliant flag drives the physical_exfoliant active key (FE-1/FE-2)', () => {
  it('includes physical_exfoliant when the flag is true and there is no ingredient text at all', () => {
    const product = makeProduct([], { isPhysicalExfoliant: true, fullIngredientText: null });

    expect(getProductActiveKeys(product)).toContain('physical_exfoliant');
  });

  it('includes physical_exfoliant when the flag is true, regardless of what the ingredient text says', () => {
    const product = makeProduct([], {
      isPhysicalExfoliant: true,
      fullIngredientText: 'Aqua, Glycerin, Fragrance', // nothing exfoliant-sounding here at all
    });

    expect(getProductActiveKeys(product)).toContain('physical_exfoliant');
  });

  it('never includes physical_exfoliant when the flag is explicitly false, even with exfoliant-sounding INCI text', () => {
    const product = makeProduct([], {
      isPhysicalExfoliant: false,
      fullIngredientText: EXFOLIANT_SOUNDING_INCI,
    });

    expect(getProductActiveKeys(product)).not.toContain('physical_exfoliant');
  });

  it('never includes physical_exfoliant when the flag is absent (undefined), even with exfoliant-sounding INCI text', () => {
    // No isPhysicalExfoliant key at all in overrides — mirrors every product
    // persisted before this field existed (same "absence treated as false"
    // contract as Product.isHidden / vitaminCAutoMigrated).
    const product = makeProduct([], { fullIngredientText: EXFOLIANT_SOUNDING_INCI });

    expect(getProductActiveKeys(product)).not.toContain('physical_exfoliant');
  });
});

describe('physical_exfoliant is unreachable from raw INCI parsing (FE-3 guarantee, exercised via FE-2\'s consumer)', () => {
  it('never derives physical_exfoliant from parseActiveIngredientsFromInci, independent of the flag wiring', () => {
    expect(parseActiveIngredientsFromInci(EXFOLIANT_SOUNDING_INCI)).not.toContain('physical_exfoliant');
  });

  it('does not derive physical_exfoliant from plain-language scrub/exfoliant wording either', () => {
    const text = 'Aqua, Glycolic Acid, physical exfoliating scrub beads, Niacinamide';

    expect(parseActiveIngredientsFromInci(text)).not.toContain('physical_exfoliant');
  });
});
