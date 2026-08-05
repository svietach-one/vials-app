import seedData from '../../assets/eu_allergens_seed.json';
import type { DetectedAllergenMatch, Product } from '@/types';

/**
 * EU fragrance-allergen detection (tech-design vials-eu-allergen-detection.md
 * FE-3). List-agnostic and pure: every allergen name compared here is read
 * from the bundled `assets/eu_allergens_seed.json` at runtime — none is a
 * string literal in this module (Story 4 AC1, structural guard in
 * allergenDetector.test.ts). No React/store/fetch imports, per the
 * utils-layer rule in .claude/rules/architecture-review.md.
 */

interface AllergenSeedEntry {
  canonical: string;
  synonyms: string[];
  cas: string[];
  restricted: boolean;
}

interface AllergenSeed {
  list_version: string;
  entries: AllergenSeedEntry[];
}

const seed = seedData as AllergenSeed;

/** The bundled seed's own `list_version` — never hand-typed separately, so
 *  swapping the JSON for a future 82-substance list needs no code change. */
export const EU_ALLERGEN_LIST_VERSION: string = seed.list_version;

// Note: the shared neutral/restricted display copy (tech design Assumption
// 5) is deliberately NOT exported from this module, despite FE-3's file
// list naming it here. ProductDetailScreen.tsx (FE-7) is its only consumer,
// and qa-lead's binding mock for this module in
// tests/vials-eu-allergen-detection/ProductDetailScreen.allergens-card.test.tsx
// stubs only `getProductAllergenMatches`/`hasRestrictedAllergenMatch` — any
// other export from '@/utils/allergenDetector' resolves to `undefined`
// under that mock and breaks the screen. The copy constants live directly
// in ProductDetailScreen.tsx instead; see the deviation note in
// progress/vials-eu-allergen-detection.md.

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Trims, lowercases, collapses internal whitespace, and strips leading/
 * trailing decorative punctuation (asterisks, footnote marks, a stray
 * paren) for token comparison. Real EU labels commonly mark exactly these
 * allergens with a trailing asterisk footnote (e.g. "SomeName*") or list a
 * fragrance breakdown parenthetically (e.g. "Parfum (First, Second,
 * Third)") — without this stripping, the trailing decoration would make an
 * otherwise-exact allergen name fail to match its clean canonical form
 * (found via direct verification during code review, see
 * allergenDetector.test.ts's "real-label decoration" suite). Trailing
 * digits are deliberately NOT stripped — too likely to be a genuine part of
 * a different name, and no seed entry needs it.
 *
 * Known remaining limitation, not fixed by this: the FIRST token in a
 * parenthetical group (e.g. "Parfum (First" from the example above) stays
 * merged with the preceding label word, since the "(" is internal to that
 * token, not at its edge — stripping only trims token edges, it does not
 * re-tokenize on an internal delimiter. Fixing that fully would require
 * treating "(" as an additional split point, which would also incorrectly
 * split any seed entry whose own canonical name legitimately contains
 * parentheses, so it's left as a follow-up rather than risking that
 * regression here.
 */
function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

/**
 * Scans free-text INCI ingredient text against the bundled seed list.
 * Comma-tokenized (INCI lists are comma-separated, mirrors
 * `parseActiveIngredientsFromInci`'s own tokenization), lowercase-normalized
 * EXACT token matching (after `normalizeToken`'s edge-decoration stripping)
 * against each entry's canonical name and synonyms — allergen label names
 * are standardized, so no fuzzy/trigram matching is needed (source brief
 * §2). Exact-token (rather than whole-text substring) matching matters here
 * specifically: some seed entries are, word-for-word, a substring of a
 * different, more specific seed entry's own name (see
 * allergenDetector.test.ts's dedicated collision-avoidance suite for a
 * concrete pair) — a substring scan over the whole haystack would
 * double-count those as two separate matches from one printed ingredient.
 * Deliberately no allergen name is spelled out in this file itself (Story 4
 * AC1's list-agnostic guard) — every name compared above is read from the
 * bundled JSON at runtime.
 */
export function detectAllergens(fullIngredientText: string | null): DetectedAllergenMatch[] {
  if (!fullIngredientText) return [];

  const tokens = new Set(
    fullIngredientText
      .split(',')
      .map(normalizeToken)
      .filter((token) => token.length > 0),
  );

  const matches: DetectedAllergenMatch[] = [];
  for (const entry of seed.entries) {
    const names = [entry.canonical, ...entry.synonyms];
    const isMatch = names.some((name) => tokens.has(normalizeToken(name)));
    if (isMatch) {
      matches.push({ canonical: entry.canonical, restricted: entry.restricted });
    }
  }
  return matches;
}

/** True when any matched entry is `restricted: true` — forces the whole
 *  badge to Amber regardless of how many other, ordinary entries matched
 *  (Story 2 AC1, same precedent as conflict severities picking the
 *  stronger tier for display). */
export function hasRestrictedAllergenMatch(matches: DetectedAllergenMatch[]): boolean {
  return matches.some((match) => match.restricted);
}

/**
 * Cache-aware accessor. Trusts `product.detectedAllergens` only when
 * `product.allergenListVersion` equals the seed's current `list_version`;
 * otherwise recomputes live from `fullIngredientText`. This gives the
 * seed's own `list_version` field a real effect: a future JSON swap (26→82)
 * or a pre-existing product that predates these fields both self-heal with
 * no migration step.
 */
export function getProductAllergenMatches(product: Product): DetectedAllergenMatch[] {
  if (product.allergenListVersion === EU_ALLERGEN_LIST_VERSION && product.detectedAllergens) {
    return product.detectedAllergens;
  }
  return detectAllergens(product.fullIngredientText);
}
