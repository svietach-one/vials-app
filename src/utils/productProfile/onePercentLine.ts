/**
 * Product Profile builder — 1% line inference.
 * docs/tasks/explore_insights/02-one-percent-line.md
 *
 * INCI lists are ordered by descending concentration only down to 1%; below
 * that the order is arbitrary. This module infers where that boundary likely
 * sits, from the ORDERED token array alone (task 01's `ingredientTokens`),
 * using a small marker table of ingredients that are legally or practically
 * capped well under 1%.
 *
 * This is a different taxonomy from `actives.json` (an active-*class*
 * ruleset) — preservatives, chelators and declared allergens are not
 * "actives", so this module never touches `actives.json` and never will.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */

export interface OnePercentLineResult {
  /** 0-based index into the token array of the first ingredient at or below the line. */
  lineIndex: number;
  /** The token that established the boundary, verbatim as it appeared. */
  markerToken: string;
  /** 'high' — a concentration-capped preservative/chelator.
   *  'medium' — only a declared fragrance allergen was found. */
  confidence: 'high' | 'medium';
}

/**
 * High confidence — capped by EU regulation or by formulation practice at
 * well under 1%.
 */
const HIGH_CONFIDENCE_MARKERS: RegExp[] = [
  /\bphenoxyethanol\b/i, // EU Annex V max 1.0%
  /\bsodium benzoate\b/i, // EU Annex V max 0.5%
  /\bpotassium sorbate\b/i, // EU Annex V max 0.6%
  /\bchlorphenesin\b/i, // EU Annex V max 0.3%
  /\bbenzoic acid\b/i, // Annex V, low cap
  /\bdehydroacetic acid\b/i, // Annex V max 0.6%
  /\b(?:di|tetra)sodium\s+edta\b/i, // chelator, typically <= 0.2%
  /\bethylhexylglycerin\b/i, // typically <= 1%
  /\bhydroxyacetophenone\b/i, // typically <= 1%
  /\bsodium hydroxide\b/i, // pH adjuster, trace
  /\btriethanolamine\b/i, // pH adjuster, trace
  /\bcitric acid\b/i, // pH adjuster, trace
  /\bcarbomer\b/i, // rheology, 0.1-0.5%
  /\btocopherol\b/i, // antioxidant, trace (must not match "tocopheryl acetate")
  /\bdisodium phosphate\b/i, // buffer, trace
  /\bsodium phosphate\b/i, // buffer, trace
  /\bt-butyl alcohol\b/i, // denaturant, trace
  /\bdenatonium benzoate\b/i, // denaturant, trace
];

/**
 * Medium confidence — EU-declarable fragrance allergens. They are only ever
 * listed because they exceed a 0.001% / 0.01% declaration threshold, and in
 * practice sit far below 1%.
 */
const MEDIUM_CONFIDENCE_MARKERS: RegExp[] = [
  /\blimonene\b/i,
  /\blinalool\b/i,
  /\bcitronellol\b/i,
  /\bgeraniol\b/i,
  /\bcoumarin\b/i,
  /\beugenol\b/i,
  /\bcitral\b/i,
  /\bbenzyl salicylate\b/i,
  /\bbenzyl benzoate\b/i,
  /\bhexyl cinnamal\b/i,
  /\balpha-isomethyl ionone\b/i,
  /\bbutylphenyl methylpropional\b/i,
  /\bhydroxycitronellal\b/i,
  /\bamyl cinnamal\b/i,
  /\bfarnesol\b/i,
  /\bisoeugenol\b/i,
];

/**
 * Deliberately EXCLUDED — commonly assumed to be sub-1% but frequently used
 * above it, which would push the line too high and produce false "below 1%"
 * claims. Do not "helpfully" add these back:
 *   - xanthan gum, glycerin, 1,2-hexanediol, caprylyl glycol — humectants/
 *     texturizers routinely formulated well above 1%.
 *   - parfum / fragrance (and any synonym) — can exceed 1% in fragranced
 *     products; the allergens it may contain are handled individually above.
 *   - benzyl alcohol — a solvent above 1% as often as a preservative below it.
 *   - sodium chloride — a viscosity modifier that can sit at several percent.
 */

const MIN_TOKENS = 6;
const MIN_MARKER_INDEX = 3;

/** Earliest index in `tokens` matching any regex in `markers`, or null. */
function earliestMatchIndex(tokens: string[], markers: RegExp[]): number | null {
  for (let i = 0; i < tokens.length; i += 1) {
    if (markers.some((marker) => marker.test(tokens[i]))) return i;
  }
  return null;
}

/**
 * A marker in the first three positions means either a very unusual formula
 * or a mis-parsed list — either way we do not know where the line is. A
 * boundary with nothing below it (the last token) tells the user nothing
 * either.
 */
function isValidBoundary(index: number, tokenCount: number): boolean {
  return index >= MIN_MARKER_INDEX && index !== tokenCount - 1;
}

/**
 * Infers the 1% boundary from an ordered INCI token array. Returns `null`
 * when no boundary can be inferred with confidence — silence is the correct
 * output when unsure, never a guess.
 *
 * Tier is checked before position: a high-confidence marker anywhere in the
 * list wins over an earlier medium-confidence marker, since a
 * concentration-capped preservative is stronger evidence than an allergen
 * declaration (see task doc's worked example). But a high-confidence marker
 * that exists yet fails the position guards (too early, or the last token)
 * must not suppress a separately valid medium-confidence marker elsewhere in
 * the list — each tier's validity is checked independently, in priority
 * order, rather than picking one index up front and gating it once.
 */
export function findOnePercentLine(tokens: string[]): OnePercentLineResult | null {
  if (tokens.length < MIN_TOKENS) return null;

  const highIndex = earliestMatchIndex(tokens, HIGH_CONFIDENCE_MARKERS);
  if (highIndex !== null && isValidBoundary(highIndex, tokens.length)) {
    return { lineIndex: highIndex, markerToken: tokens[highIndex], confidence: 'high' };
  }

  const mediumIndex = earliestMatchIndex(tokens, MEDIUM_CONFIDENCE_MARKERS);
  if (mediumIndex !== null && isValidBoundary(mediumIndex, tokens.length)) {
    return { lineIndex: mediumIndex, markerToken: tokens[mediumIndex], confidence: 'medium' };
  }

  return null;
}
