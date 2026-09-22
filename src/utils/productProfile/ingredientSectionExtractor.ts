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
 * marker and everything after it. Returns `text` (with trailing punctuation
 * trimmed) unchanged when no marker is found, or when a found marker appears
 * before enough comma-separated content to trust it (see
 * `MIN_COMMAS_BEFORE_CUT`).
 */
function cutAtStopMarker(text: string): string {
  const match = STOP_MARKER_REGEX.exec(text);
  if (!match) return text.replace(/[,.\s]+$/, '').trim();

  const before = text.slice(0, match.index);
  const commaCount = (before.match(/,/g) ?? []).length;
  if (commaCount < MIN_COMMAS_BEFORE_CUT) return text.replace(/[,.\s]+$/, '').trim();

  return before.replace(/[,.\s]+$/, '').trim();
}

/**
 * Some labels (this codebase's own device-QA sample: a Farmapol serum box)
 * print Action/How-to-use/Warnings *before* the ingredients paragraph, not
 * after — the opposite order this module originally assumed. Against such a
 * label, cutting at the first stop-marker anywhere discards the entire real
 * ingredients list. This section instead looks for the ingredients-list
 * OPENING marker ("Ingredients"/"INCI"/"Composition", tolerant of the OCR
 * misread "Ingriedents" this device-QA sample actually produced) and, when
 * found with confidence, extracts from there forward — falling back to the
 * original first-stop-marker behavior when no such header is found, so
 * labels that genuinely start with ingredients are unaffected.
 *
 * Deliberately English-only for now: `ocrTextCleaner` strips diacritics
 * before this text ever reaches here (e.g. "Skład" -> "Skad", "Święty" ->
 * "wity" in real device output), so a Polish/German header word can't be
 * matched reliably without a real sample to calibrate against — adding one
 * blind would repeat the mistake this module's own history (see git log)
 * already made once with an unvalidated heuristic.
 */
const INGREDIENT_HEADER_REGEX = /\b(?:ingr[a-z]{0,4}[ea]nts?|inci|composition)\b/gi;

/** How far past a candidate header to look for ingredient-shaped tokens. */
const HEADER_LOOKAHEAD_CHARS = 300;

/** A header is only trusted once at least this many of the tokens right
 *  after it look like real ingredient names, not more prose — this is what
 *  stops "...any of the ingredients, consult a doctor, discontinue..." (a
 *  trailing-warnings sentence that happens to contain the word
 *  "ingredients") from being mistaken for the real header. */
const MIN_INCI_LIKE_TOKENS = 3;

/** Common English words that show up in directions/warnings prose but never
 *  inside a real INCI token — used to reject prose disguised as a comma
 *  list, not to validate real ingredient names (which this module has no
 *  dictionary of). */
const PROSE_WORDS = new Set([
  'the', 'a', 'an', 'of', 'if', 'to', 'and', 'or', 'with', 'do', 'not', 'for', 'in', 'on', 'by',
  'is', 'are', 'be', 'this', 'that', 'your', 'you', 'it', 'its', 'as', 'at', 'from', 'use', 'used',
  'using', 'before', 'after', 'please', 'may', 'can', 'should', 'consult', 'avoid', 'keep', 'apply',
  'see', 'contains', 'contain', 'than', 'more', 'other', 'any', 'all', 'each', 'per', 'only', 'out',
  'reach', 'doctor', 'physician', 'skin', 'occurs',
]);

/** Counts, among the first few comma-tokens in `window`, how many are
 *  short (1–4 word) and contain no prose word — i.e. look like ingredient
 *  names rather than a sentence that happens to be comma-separated. */
function inciLikeTokenCount(window: string, maxTokens = 6): number {
  const tokens = window.split(',').map((t) => t.trim()).filter(Boolean).slice(0, maxTokens);
  let count = 0;
  for (const token of tokens) {
    const words = token.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    if (words.length === 0 || words.length > 4) continue;
    if (words.some((w) => PROSE_WORDS.has(w))) continue;
    if (token.replace(/[^A-Za-z]/g, '').length < 3) continue;
    count += 1;
  }
  return count;
}

/**
 * Finds the best-scoring ingredients-header occurrence in `text` (there can
 * be more than one candidate — e.g. the real header plus an unrelated
 * mention of the word "ingredients" in a warnings sentence) and returns the
 * character offset right after it. Returns null when no occurrence clears
 * `MIN_INCI_LIKE_TOKENS`, so callers fall back to the original behavior.
 *
 * Picks the HIGHEST-scoring candidate, not the first one that clears the
 * bar. An earlier "first match wins" version was tried and reverted: it
 * broke both real device-QA photos this module was built against, because
 * a spurious earlier mention's 300-char lookahead window can reach far
 * enough to overlap the real header's own content and "borrow" its score.
 * Bounding each candidate's window at the next candidate's start (tried as
 * a fix) closed that specific hole but did not fix the general problem —
 * a constructed case with a real header immediately followed by unusually
 * long single-word INCI names, then a later mention with several short
 * qualifying tokens, still picks the wrong candidate either way. Real INCI
 * names are almost always 1-4 words, so that shape is expected to be rare;
 * this is a known, deliberately unaddressed limitation until a real label
 * exhibiting it turns up — not something to keep guessing at.
 */
function findIngredientHeaderEnd(text: string): number | null {
  const regex = new RegExp(INGREDIENT_HEADER_REGEX.source, INGREDIENT_HEADER_REGEX.flags);
  let best: { end: number; score: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const window = text.slice(end, end + HEADER_LOOKAHEAD_CHARS);
    const score = inciLikeTokenCount(window);
    if (score >= MIN_INCI_LIKE_TOKENS && (best === null || score > best.score)) {
      best = { end, score };
    }
  }
  return best ? best.end : null;
}

/** Drops trailing comma-tokens that contain no letters at all (e.g. a stray
 *  "4" bleeding in from "...Hydroxyacetophenone., 4 Made in Poland" once
 *  "Made in" is cut) — real ingredient names always have letters. Loops
 *  since more than one such junk token can be trailing (e.g. a page number
 *  AND a batch number: "..., 4, 12A").
 */
function stripTrailingNonLetterToken(text: string): string {
  let result = text;
  for (;;) {
    const lastComma = result.lastIndexOf(',');
    if (lastComma === -1) return result;
    const lastToken = result.slice(lastComma + 1).trim();
    if (lastToken.length === 0 || /[A-Za-z]/.test(lastToken)) return result;
    result = result.slice(0, lastComma).replace(/[,.\s]+$/, '').trim();
  }
}

/**
 * Cuts `text` at the first trusted section-stop marker, discarding the
 * marker and everything after it. Returns `text` unchanged when no marker
 * is found, or when a found marker appears before enough comma-separated
 * content to trust it (see `MIN_COMMAS_BEFORE_CUT`).
 *
 * First tries to locate the real ingredients-list header (see
 * `findIngredientHeaderEnd`) and, when found, extracts forward from there —
 * this handles labels that print Action/Warnings/Directions *before* the
 * ingredients paragraph. Falls back to the original "cut at the first
 * stop-marker anywhere" behavior when no header is found, so labels that
 * already start with ingredients (the common case, and every existing test
 * for this module) are unaffected.
 *
 * Known, accepted inconsistency: a short ingredient list (too few tokens to
 * clear `MIN_INCI_LIKE_TOKENS`) falls back to the original behavior, which
 * has never stripped a leading "Ingredients:"/"INCI:" prefix — only labels
 * long enough to trigger header-detection get that prefix removed. Left
 * alone rather than extended to the legacy path: it isn't a regression (the
 * pre-existing behavior always retained the prefix), and the actual bug
 * this module was fixed for doesn't need it solved.
 */
export function extractIngredientSection(text: string): string {
  const headerEnd = findIngredientHeaderEnd(text);
  if (headerEnd !== null) {
    const afterHeader = text.slice(headerEnd).replace(/^[\s,.:;-]+/, '');
    return stripTrailingNonLetterToken(cutAtStopMarker(afterHeader));
  }

  return cutAtStopMarker(text);
}
