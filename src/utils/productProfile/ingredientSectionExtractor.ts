/**
 * Explore Composition flow — trailing-section cutoff for captured/pasted raw
 * ingredient text (docs/specs/explore-composition.md Story 2 supersession
 * note; follow-up to the 2026-08-27 tech-lead review's "Ingredient count
 * still counts OCR noise" finding). A real product photo commonly captures
 * Directions/Warnings/manufacturer text right after the ingredients
 * paragraph; the naive comma-split tokenizer (`tokenizeIngredientsText`)
 * can't tell that text apart from more ingredients, which both inflates the
 * "Ingredient count" matrix parameter and can feed junk tokens into active-
 * ingredient parsing. This module cuts the text at the first such marker,
 * before it is stored or analyzed at all — not a per-consumer workaround.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */

/**
 * Phrases that mark the start of a non-ingredient label section. Case-
 * insensitive, whole-phrase (word-boundary) match against the first
 * occurrence anywhere in the text. Deliberately excludes bare single verbs
 * like "use"/"apply"/"store" on their own — those appear too often in
 * legitimate marketing copy ("Safe to use daily") to trust as a cutoff by
 * themselves; only multi-word phrases or words unambiguous outside a
 * directions/warnings/manufacturer context made this list.
 */
const SECTION_STOP_MARKERS = [
  // Usage / directions
  'directions for use',
  'direction for use',
  'directions',
  'direction',
  'how to use',
  'how to apply',
  'instructions for use',
  'instructions',
  'use as directed',
  'application',

  // Warnings / safety
  'warnings',
  'warning',
  'cautions',
  'caution',
  'precautions',
  'precaution',
  'contraindications',
  'allergy alert',
  'patch test',
  'for external use only',
  'avoid contact with eyes',
  'avoid eye contact',
  'if irritation occurs',
  'discontinue use',
  'keep out of reach of children',
  'keep away from children',
  'if swallowed',
  'in case of contact',
  'do not ingest',

  // Storage
  'store in a cool',
  'store below',
  'storage',

  // Packaging / manufacturer metadata
  'net wt',
  'net weight',
  'made in',
  'manufactured by',
  'manufactured for',
  'distributed by',
  'best before',
  'best used before',
  'exp date',
  'expiry date',
  'batch no',
  'lot no',

  // Contact / marketing
  'customer service',
  'visit us at',
  'www.',
] as const;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_MARKER_REGEX = new RegExp(
  `\\b(?:${SECTION_STOP_MARKERS.map(escapeRegExp).join('|')})`,
  'i',
);

/**
 * A marker is only trusted to end the ingredients section once at least
 * this many commas have already appeared before it — i.e. some real
 * comma-separated ingredient content was already captured. Guards against a
 * false-early match (e.g. marketing copy containing "application") discarding
 * a real ingredients paragraph entirely; under-filtering (keeping some noise)
 * is preferred over over-filtering (losing real ingredient data).
 */
const MIN_COMMAS_BEFORE_CUT = 1;

/**
 * Cuts `text` at the first trusted section-stop marker, discarding the
 * marker and everything after it. Returns `text` unchanged when no marker
 * is found, or when a found marker appears before enough comma-separated
 * content to trust it (see `MIN_COMMAS_BEFORE_CUT`).
 */
export function extractIngredientSection(text: string): string {
  const match = STOP_MARKER_REGEX.exec(text);
  if (!match) return text;

  const before = text.slice(0, match.index);
  const commaCount = (before.match(/,/g) ?? []).length;
  if (commaCount < MIN_COMMAS_BEFORE_CUT) return text;

  return before.replace(/[,.\s]+$/, '').trim();
}
