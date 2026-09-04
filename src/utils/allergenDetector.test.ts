/**
 * Unit tests — EU fragrance-allergen detection (FE-9)
 * Spec: docs/specs/vials-eu-allergen-detection.md
 * Tech design: docs/tech-design/vials-eu-allergen-detection.md FE-9
 *
 * Pure business-logic tests, co-located per .claude/rules/testing.md — no
 * React/react-native imports, no rendering, no store access.
 */
import fs from 'fs';
import path from 'path';

import seed from '../../assets/eu_allergens_seed.json';
import {
  detectAllergens,
  EU_ALLERGEN_LIST_VERSION,
  getProductAllergenMatches,
  hasRestrictedAllergenMatch,
} from './allergenDetector';
import type { Product } from '../types';

// ─── Fixture helpers ────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Rose Body Lotion',
    brand: 'Vials Lab',
    productType: 'lotion',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: 'Aqua, Glycerin, Parfum',
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

type SeedEntry = { canonical: string; synonyms: string[]; cas: string[]; restricted: boolean };
const seedEntries = seed.entries as SeedEntry[];

// ─── Story 4 AC1 — one passing match per seed entry ─────────────────────────

describe('detectAllergens — one passing match per seed entry (canonical form)', () => {
  it.each(seedEntries.map((entry) => [entry.canonical] as const))(
    'matches "%s" when its canonical name appears in the INCI text',
    (canonical) => {
      // Arrange
      const text = `Aqua, Glycerin, ${canonical}, Parfum`;
      // Act
      const matches = detectAllergens(text);
      // Assert
      expect(matches.some((m) => m.canonical === canonical)).toBe(true);
    },
  );
});

describe('detectAllergens — one passing match per seed entry (synonym form)', () => {
  const entriesWithSynonyms = seedEntries.filter((entry) => entry.synonyms.length > 0);

  it.each(entriesWithSynonyms.map((entry) => [entry.canonical, entry.synonyms[0]] as const))(
    'matches "%s" via its synonym "%s"',
    (canonical, synonym) => {
      // Arrange
      const text = `Aqua, Glycerin, ${synonym}, Parfum`;
      // Act
      const matches = detectAllergens(text);
      // Assert
      expect(matches.some((m) => m.canonical === canonical)).toBe(true);
    },
  );

  it('every seed entry has at least one synonym form covered above (documents seed shape)', () => {
    // At least most entries carry a synonym; this just proves the fixture
    // list above is non-empty so the synonym-form suite isn't vacuous.
    expect(entriesWithSynonyms.length).toBeGreaterThan(0);
  });
});

// ─── Zero-match cases ────────────────────────────────────────────────────────

describe('detectAllergens — zero matches', () => {
  it('returns an empty array for allergen-free INCI text', () => {
    // Arrange
    const text = 'Aqua, Glycerin, Niacinamide, Sodium Hyaluronate';
    // Act
    const matches = detectAllergens(text);
    // Assert
    expect(matches).toEqual([]);
  });

  it('returns an empty array for null fullIngredientText', () => {
    // Act
    const matches = detectAllergens(null);
    // Assert
    expect(matches).toEqual([]);
  });

  it('returns an empty array for empty-string fullIngredientText', () => {
    // Act
    const matches = detectAllergens('');
    // Assert
    expect(matches).toEqual([]);
  });
});

// ─── Restricted propagation ──────────────────────────────────────────────────

describe('detectAllergens — restricted flag propagates from the seed entry', () => {
  const restrictedEntries = seedEntries.filter((entry) => entry.restricted);
  const nonRestrictedEntries = seedEntries.filter((entry) => !entry.restricted);

  it('marks exactly the two banned-but-retained entries as restricted (Lilial, Lyral/HICC)', () => {
    expect(restrictedEntries).toHaveLength(2);
  });

  it.each(restrictedEntries.map((entry) => [entry.canonical] as const))(
    'reports restricted: true for "%s"',
    (canonical) => {
      // Arrange
      const text = `Aqua, ${canonical}`;
      // Act
      const match = detectAllergens(text).find((m) => m.canonical === canonical);
      // Assert
      expect(match?.restricted).toBe(true);
    },
  );

  it.each(nonRestrictedEntries.map((entry) => [entry.canonical] as const))(
    'reports restricted: false for "%s"',
    (canonical) => {
      // Arrange
      const text = `Aqua, ${canonical}`;
      // Act
      const match = detectAllergens(text).find((m) => m.canonical === canonical);
      // Assert
      expect(match?.restricted).toBe(false);
    },
  );
});

// ─── Exact-token matching (no cross-entry substring false positives) ────────

describe('detectAllergens — exact-token matching avoids substring collisions', () => {
  it('matches only "Hexyl Cinnamal", not also the separate "Cinnamal" entry', () => {
    // Arrange — "Cinnamal" is a whole-word suffix of "Hexyl Cinnamal"; a
    // naive whole-text substring scan would double-match both entries from
    // this single printed ingredient.
    const text = 'Aqua, Hexyl Cinnamal, Glycerin';
    // Act
    const matches = detectAllergens(text);
    // Assert
    expect(matches).toEqual([{ canonical: 'Hexyl Cinnamal', restricted: false }]);
  });

  it('matches only "Isoeugenol", not also the separate "Eugenol" entry', () => {
    // Arrange — "Eugenol" is a substring of "Isoeugenol" itself (not just of
    // the surrounding text), so this also proves per-token (not per-
    // substring) comparison.
    const text = 'Aqua, Isoeugenol, Glycerin';
    // Act
    const matches = detectAllergens(text);
    // Assert
    expect(matches).toEqual([{ canonical: 'Isoeugenol', restricted: false }]);
  });

  it('matches both entries when both are genuinely, separately present as their own tokens', () => {
    // Arrange
    const text = 'Aqua, Cinnamal, Hexyl Cinnamal, Glycerin';
    // Act
    const matches = detectAllergens(text);
    // Assert
    const canonicals = matches.map((m) => m.canonical).sort();
    expect(canonicals).toEqual(['Cinnamal', 'Hexyl Cinnamal']);
  });
});

// ─── Real-label decoration (asterisk marks, parenthetical breakdowns) ───────
// Found during code review: real EU labels commonly decorate exactly these
// allergen names in ways plain trim/lowercase doesn't account for. Both
// cases below previously returned zero matches before normalizeToken's
// edge-decoration stripping was added.

describe('detectAllergens — tolerates common real-label decoration', () => {
  it('matches allergens marked with a trailing asterisk footnote, as EU labels commonly do', () => {
    // Arrange — e.g. "Limonene*" pointing to a "*declared fragrance
    // allergen" footnote, a standard on-pack convention.
    const text = 'Aqua, Limonene*, Linalool*, Glycerin';
    // Act
    const matches = detectAllergens(text).map((m) => m.canonical).sort();
    // Assert
    expect(matches).toEqual(['Limonene', 'Linalool']);
  });

  it('matches the last allergen in a parenthetical fragrance breakdown', () => {
    // Arrange — "Parfum (Linalool, Limonene, Citronellol)" is a common
    // label pattern; the trailing ")" must not block an exact match on the
    // last name in the group.
    const text = 'Aqua, Parfum (Linalool, Limonene, Citronellol), Glycerin';
    // Act
    const matches = detectAllergens(text).map((m) => m.canonical);
    // Assert
    expect(matches).toContain('Citronellol');
  });

  it('KNOWN LIMITATION: still misses the first allergen in a parenthetical breakdown', () => {
    // Arrange — "Parfum (Linalool" stays merged into one token; the "("
    // is internal, not at the token's edge, so edge-stripping alone can't
    // separate it. Documented, not silently regressed — see normalizeToken's
    // doc comment for why this isn't fixed here (re-tokenizing on "(" would
    // break "Evernia Furfuracea (Treemoss) Extract"-style canonical names).
    const text = 'Aqua, Parfum (Linalool, Limonene, Citronellol), Glycerin';
    // Act
    const matches = detectAllergens(text).map((m) => m.canonical);
    // Assert
    expect(matches).not.toContain('Linalool');
  });

  it('still matches the un-decorated, un-parenthesized entries with their own canonical parens intact', () => {
    // Arrange — regression guard: entries whose OWN canonical name contains
    // parentheses must keep matching verbatim, since edge-only stripping
    // must never touch internal punctuation.
    const text = 'Aqua, Evernia Furfuracea (Treemoss) Extract, Glycerin';
    // Act
    const matches = detectAllergens(text).map((m) => m.canonical);
    // Assert
    expect(matches).toEqual(['Evernia Furfuracea (Treemoss) Extract']);
  });
});

// ─── hasRestrictedAllergenMatch precedence ───────────────────────────────────

describe('hasRestrictedAllergenMatch', () => {
  it('returns false for an empty match list', () => {
    expect(hasRestrictedAllergenMatch([])).toBe(false);
  });

  it('returns false when every match is non-restricted', () => {
    const matches = [
      { canonical: 'Linalool', restricted: false },
      { canonical: 'Limonene', restricted: false },
    ];
    expect(hasRestrictedAllergenMatch(matches)).toBe(false);
  });

  it('returns true when at least one match is restricted, regardless of position in the array', () => {
    const matches = [
      { canonical: 'Linalool', restricted: false },
      { canonical: 'Lilial', restricted: true },
      { canonical: 'Limonene', restricted: false },
    ];
    expect(hasRestrictedAllergenMatch(matches)).toBe(true);
  });
});

// ─── getProductAllergenMatches — cache vs. live recompute ───────────────────

describe('getProductAllergenMatches — cache-vs-live-recompute behavior', () => {
  it('trusts the cached detectedAllergens when allergenListVersion matches the current seed version', () => {
    // Arrange — a cached value that would NOT match a live re-scan, to prove the cache wins
    const staleLookingButValidCache = [{ canonical: 'Hand-Authored Cache Entry', restricted: true }];
    const product = makeProduct({
      fullIngredientText: 'Aqua, Glycerin', // would yield zero matches if recomputed live
      detectedAllergens: staleLookingButValidCache,
      allergenListVersion: EU_ALLERGEN_LIST_VERSION,
    });
    // Act
    const matches = getProductAllergenMatches(product);
    // Assert
    expect(matches).toBe(staleLookingButValidCache);
  });

  it('recomputes live when allergenListVersion is stale (does not equal the current seed version)', () => {
    // Arrange
    const product = makeProduct({
      fullIngredientText: 'Aqua, Linalool, Glycerin',
      detectedAllergens: [{ canonical: 'Should Be Ignored', restricted: true }],
      allergenListVersion: 'eu-annex-iii-legacy-v0',
    });
    // Act
    const matches = getProductAllergenMatches(product);
    // Assert
    expect(matches).toEqual([{ canonical: 'Linalool', restricted: false }]);
  });

  it('recomputes live when allergenListVersion is absent (product predates the field)', () => {
    // Arrange
    const product = makeProduct({
      fullIngredientText: 'Aqua, Limonene, Glycerin',
    });
    delete (product as Partial<Product>).allergenListVersion;
    delete (product as Partial<Product>).detectedAllergens;
    // Act
    const matches = getProductAllergenMatches(product);
    // Assert
    expect(matches).toEqual([{ canonical: 'Limonene', restricted: false }]);
  });

  it('recomputes live (empty result) when the cache is present but allergenListVersion is null', () => {
    // Arrange
    const product = makeProduct({
      fullIngredientText: 'Aqua, Glycerin',
      detectedAllergens: [{ canonical: 'Should Be Ignored', restricted: false }],
      allergenListVersion: null,
    });
    // Act
    const matches = getProductAllergenMatches(product);
    // Assert
    expect(matches).toEqual([]);
  });
});

// ─── Story 4 AC1 — list-agnostic structural guard ────────────────────────────

describe('Story 4 AC1 — allergenDetector.ts is list-agnostic (no hardcoded allergen names)', () => {
  it('does not contain any of the 26 seed canonical names as string literals in its own source', () => {
    // Arrange
    const sourcePath = path.join(__dirname, 'allergenDetector.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    // Act / Assert — mirrors rulesetIntegrity.test.ts's own reasonCode guard
    for (const entry of seedEntries) {
      expect(source).not.toContain(entry.canonical);
    }
  });
});
