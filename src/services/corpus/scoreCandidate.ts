import { normalizeForMatch } from '@/utils/textNormalize';

import { SEARCH_CONFIG } from './searchConfig';
import { COSMETIC_STOPWORDS } from './stopwords';
import { toTrigrams, trigramJaccard } from './trigramSearch';
import type { CorpusProduct, ProductQuery } from './types';

/**
 * Real scoring for retrieved candidates (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md,
 * extended by 05-stopwords.md). "Retrieve wide, re-rank narrow": ProductRepository's
 * recall stage (FTS trigram / LIKE) over-fetches up to SEARCH_CONFIG.recallLimit rows;
 * this module scores each candidate 0..1 so the repository can apply a floor and a
 * display cap.
 *
 * Kept pure — no React, no react-native, no store access, no fetch — per the
 * utils/services layering rule in .claude/rules/architecture-review.md.
 *
 * Module boundary (deliberate, do not blur — see the step doc): `scoreField`
 * holds ALL token-matching logic. `scoreCandidate` only blends field scores.
 * Step 4 (stopwords) changes `scoreField`'s token-weighting rule; the ONE
 * exception the step doc itself carves out is the all-generic-query rule
 * (05-stopwords.md §3), which it explicitly assigns to `scoreCandidate`
 * ("Handle it in scoreCandidate, not in scoreField's caller chain") since
 * it's a field-count decision ("did every field come back with zero
 * information"), not a token-matching one — see GENERIC_ONLY below.
 */

/**
 * Fixed short-query floor (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md
 * "Short-query guard"). Deliberately NOT part of SEARCH_CONFIG: the step doc
 * specifies this as a fixed rule ("require score >= 0.8 rather than
 * minMatchScore"), not a tunable — SEARCH_CONFIG.minMatchScore is what the
 * sweep tunes; this constant is a hardcoded exception to it for very short
 * queries.
 */
export const SHORT_QUERY_MIN_SCORE = 0.8;

/** Below this normalized-length (chars, combined [brand, name]), scoring switches to strict mode. */
const SHORT_QUERY_CHAR_THRESHOLD = 4;

/** Trigram-fuzzy rule (rule 3) only fires on tokens at least this long. */
const FUZZY_MIN_TOKEN_LENGTH = 5;
const FUZZY_MIN_JACCARD = 0.6;

/** Prefix rule (rule 2, normal mode) only fires when the query token is at least this long. */
const PREFIX_MIN_QUERY_TOKEN_LENGTH = 4;

function tokenize(text: string): string[] {
  const normalized = normalizeForMatch(text);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

/**
 * Whether `queryToken` matches any token in `docTokens`, per the step doc's
 * token-matching rule (3 sub-rules) — or the short-query guard's stricter
 * single rule when `strict` is set.
 */
function tokenMatches(queryToken: string, docTokens: string[], strict: boolean): boolean {
  for (const docToken of docTokens) {
    if (strict) {
      // Short-query guard: prefix-only, no length floor on the query token —
      // that relaxation (vs. rule 2 below) is the entire point of this mode.
      if (docToken.startsWith(queryToken)) return true;
      continue;
    }
    // Rule 1: exact equality (both sides already normalizeForMatch'd by tokenize()).
    if (queryToken === docToken) return true;
    // Rule 2: prefix match, restricted to query tokens >=4 chars ("moisturis" -> "moisturiser").
    if (queryToken.length >= PREFIX_MIN_QUERY_TOKEN_LENGTH && docToken.startsWith(queryToken)) return true;
    // Rule 3: OCR-typo tolerance via trigram similarity — restricted to longer
    // tokens on both sides; on short tokens trigram similarity degenerates
    // into noise (a wax vs. a cream sharing one 3-letter fragment).
    if (
      queryToken.length >= FUZZY_MIN_TOKEN_LENGTH &&
      docToken.length >= FUZZY_MIN_TOKEN_LENGTH &&
      trigramJaccard(toTrigrams(queryToken), toTrigrams(docToken)) >= FUZZY_MIN_JACCARD
    ) {
      return true;
    }
  }
  return false;
}

export interface ScoreFieldOptions {
  /** Short-query guard (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md). */
  strict?: boolean;
}

/**
 * Sentinel returned by {@link scoreField} when EVERY token of `queryText` is
 * a generic cosmetic stopword (docs/tasks/ocr_improvement/05-stopwords.md
 * §3, "the all-generic query rule") — e.g. a name field of just "crème."
 * Deliberately out of the normal 0..1 range so callers can tell "no
 * identifying signal at all" apart from a real, confidently-zero score.
 * Only ever returned when {@link SEARCH_CONFIG.stopwordsEnabled} is true;
 * must never leak past `scoreCandidate` — see its all-generic-query
 * handling below.
 */
export const GENERIC_ONLY = -1;

/** Weight split between content and generic tokens inside one field (05-stopwords.md §2). */
const CONTENT_TOKEN_WEIGHT = 0.85;
const GENERIC_TOKEN_WEIGHT = 0.15;

/** Fraction of `queryTokens` matched by `docTokens`, 0..1 (0 for an empty query-token set). */
function coverage(queryTokens: string[], docTokens: string[], strict: boolean): number {
  if (queryTokens.length === 0) return 0;
  let matched = 0;
  for (const queryToken of queryTokens) {
    if (tokenMatches(queryToken, docTokens, strict)) matched++;
  }
  return matched / queryTokens.length;
}

/**
 * Coverage of `queryText`'s tokens by `docText`'s tokens, 0..1 — asymmetric
 * containment, not symmetric Jaccard (a short query against a long, correct
 * document must not be penalised for the document's extra tokens; see "The
 * Ordinary" example in the step doc).
 *
 * Stopword-aware (docs/tasks/ocr_improvement/05-stopwords.md §2, behind
 * SEARCH_CONFIG.stopwordsEnabled): the query's tokens are split into
 * "content" (specific, identifying) and "generic" (cosmetic-vocabulary
 * noise — crème, soin, dermatologique, ...) before scoring, so two products
 * that only share generic words no longer look as similar as two that share
 * real, identifying ones. Generic tokens keep a small (0.15) weight rather
 * than being dropped entirely — "a weight, not a delete" — so e.g. "crème
 * mains" can still edge out "crème visage" against a hand-cream candidate
 * when nothing else distinguishes them.
 */
export function scoreField(queryText: string, docText: string, opts: ScoreFieldOptions = {}): number {
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return 0;
  const docTokens = tokenize(docText);
  if (docTokens.length === 0) return 0;

  const strict = opts.strict ?? false;

  if (!SEARCH_CONFIG.stopwordsEnabled) {
    return coverage(queryTokens, docTokens, strict);
  }

  const content = queryTokens.filter((t) => !COSMETIC_STOPWORDS.has(t));
  const generic = queryTokens.filter((t) => COSMETIC_STOPWORDS.has(t));

  if (content.length === 0) {
    // Exact-full-name exception (05-stopwords.md §3, last paragraph): a
    // product genuinely named e.g. "Eight Hour Cream" must not become
    // unfindable just because its whole name happens to be stopwords.
    if (normalizeForMatch(queryText) === normalizeForMatch(docText)) return 1;
    return GENERIC_ONLY;
  }

  const contentCoverage = coverage(content, docTokens, strict);
  if (generic.length === 0) {
    // Renormalize (05-stopwords.md §2): a fully-specific query (no generic
    // tokens at all) must still be able to reach 1.0, not cap at 0.85 —
    // otherwise SEARCH_CONFIG.minMatchScore silently becomes a stricter
    // effective floor for every specific query than the sweep that tuned it
    // accounted for, which is the opposite of this step's intent.
    return contentCoverage;
  }

  const genericCoverage = coverage(generic, docTokens, strict);
  return CONTENT_TOKEN_WEIGHT * contentCoverage + GENERIC_TOKEN_WEIGHT * genericCoverage;
}

/**
 * Short-query guard trigger: true when the normalized, combined
 * [query.brand, query.name] text is under 4 characters total. Exported so
 * ProductRepository can pick the matching cutoff floor (SHORT_QUERY_MIN_SCORE
 * vs. SEARCH_CONFIG.minMatchScore) without re-deriving this condition.
 */
export function isShortQuery(query: ProductQuery): boolean {
  const combined = [query.brand, query.name].filter(Boolean).join(' ');
  return normalizeForMatch(combined).length < SHORT_QUERY_CHAR_THRESHOLD;
}

/** Brand weight in the blend — meaningful but not dominant (see step doc). */
const BRAND_WEIGHT = 0.35;
const NAME_WEIGHT = 0.65;

/**
 * Combines field scores into the final candidate score, 0..1. Contains NO
 * token logic of its own — see module header. A query with a brand is scored
 * on a blend; a query without one (typed search never segments a brand) is
 * scored against the candidate's brand+name combined. Both are compared
 * against the same floor.
 *
 * DEVIATION from 03-scoring-and-cutoff.md's literal contract (human-approved
 * follow-up, not part of step 2 as originally speced — see
 * progress/ocr-improvement.md's dated follow-up log entry for the full
 * writeup): the doc's literal text said `if (!query.brand) return nameScore`
 * (name-only). Step 2's own report flagged that this makes a brand-only
 * typed query (e.g. "avene", nothing else) score 0 against any candidate
 * whose `name` field doesn't happen to repeat the brand word, get filtered
 * by SEARCH_CONFIG.minMatchScore, and return zero results — contradicting
 * the search bar's own "Search by name or brand…" placeholder. No typed
 * call site (AddProductHubScreen.tsx, FirstProductScreen.tsx) ever sets
 * `query.brand` — they have no brand/name boundary signal the way OCR's
 * splitLabelText() does — so this branch is not just a rare edge case, it's
 * every typed query. Fix: score `query.name` against `candidate.brand + '
 * ' + candidate.name` combined, instead of `candidate.name` alone. This
 * changes *what text* is passed into `scoreField`, not `scoreField` itself —
 * the module boundary in the header comment (`scoreField` holds all token
 * logic; `scoreCandidate` only blends/selects fields) is preserved.
 */
export function scoreCandidate(query: ProductQuery, candidate: CorpusProduct): number {
  const strict = isShortQuery(query);
  if (!query.brand) {
    const combinedText = `${candidate.brand ?? ''} ${candidate.name}`.trim();
    const score = scoreField(query.name, combinedText, { strict });
    // Step 4 design decision (05-stopwords.md §3 was written against step
    // 2's original always-two-field design; the brand-only-fix above
    // collapsed the !query.brand case to ONE field — see
    // progress/ocr-improvement.md's step-4 log entry for the full
    // reasoning). §3's fallback rule ("if only one field is all-generic,
    // fall back to scoring on the remaining field") has no meaning here:
    // there IS no second field to fall back to. So this branch follows the
    // doc's own top-level rule instead ("if every field of the query
    // returns GENERIC_ONLY, scoreCandidate returns 0") — an all-generic
    // query.name in this branch has nowhere left to widen to. GENERIC_ONLY
    // is an internal sentinel and must never leak out of scoreCandidate as
    // a real score.
    return score === GENERIC_ONLY ? 0 : score;
  }

  const nameScore = scoreField(query.name, candidate.name, { strict });
  const brandScore = scoreField(query.brand, candidate.brand ?? '', { strict });
  const nameIsGenericOnly = nameScore === GENERIC_ONLY;
  const brandIsGenericOnly = brandScore === GENERIC_ONLY;

  // The all-generic query rule (05-stopwords.md §3): if every field is
  // GENERIC_ONLY, there is no information left to identify one product out
  // of ~17,000 — return 0 so nothing clears SEARCH_CONFIG.minMatchScore.
  if (nameIsGenericOnly && brandIsGenericOnly) return 0;
  // Exactly one field is all-generic (e.g. brand "Avène" + name "crème") —
  // a legitimate, if weak, query. Fall back to the remaining field alone
  // rather than zeroing the candidate, or diluting it through the 0.35/0.65
  // blend against a sentinel that was never a real score to begin with.
  if (nameIsGenericOnly) return brandScore;
  if (brandIsGenericOnly) return nameScore;

  return BRAND_WEIGHT * brandScore + NAME_WEIGHT * nameScore;
}
