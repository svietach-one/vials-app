/**
 * Every behavioural change and every tunable constant for the product-search
 * precision fix (docs/tasks/ocr_improvement/00-README.md) goes here, so a bad
 * tuning value is a config revert rather than a code revert, and so the eval
 * harness (scripts/search-eval/run.ts) can override values without editing
 * source. Never hardcode any of these values at a call site — always read
 * them from `SEARCH_CONFIG`.
 *
 * Created in step 1 (docs/tasks/ocr_improvement/02-segment-ocr-query.md),
 * which only reads `segmentOcrQuery`. Later steps read/extend the rest of
 * this module:
 *   - scoringV2, minMatchScore, recallLimit, maxResults      -> step 2
 *   - brandFilterThreshold                                   -> step 3
 *   - stopwordsEnabled                                        -> step 4
 *   - wordIndexEnabled                                        -> step 5
 */
export interface SearchConfig {
  /** Step 1: split OCR label text into brand/name before querying the corpus. */
  segmentOcrQuery: boolean;
  /** Step 2: score retrieval candidates instead of returning raw bm25 order. */
  scoringV2: boolean;
  /** Step 2: minimum score for a candidate to be shown — tuned by sweep, do not guess. */
  minMatchScore: number;
  /** Step 2: FTS recall-stage row limit (pre-cutoff). */
  recallLimit: number;
  /** Step 2: what the UI shows after scoring/cutoff. */
  maxResults: number;
  /** Step 3: brand-first filtering threshold. */
  brandFilterThreshold: number;
  /** Step 4: enable the generic-cosmetic-term stopword list. */
  stopwordsEnabled: boolean;
  /** Step 5: word-level FTS index (schema change, requires human go-ahead). */
  wordIndexEnabled: boolean;
}

export const SEARCH_CONFIG: SearchConfig = {
  segmentOcrQuery: true,
  scoringV2: true,
  // Re-tuned by the step-4 sweep (docs/tasks/ocr_improvement/05-stopwords.md
  // "re-run the sweep... to confirm minMatchScore is still correctly
  // placed") against the real corpus + eval-harness fixtures
  // (progress/ocr-improvement.md's step-4 log entry has the full 9-point
  // sweep table). Was 0.55 (step 2); moved to 0.65 because stopwords +
  // the brand-only fix eliminated false_top_1 at EVERY swept threshold
  // (0.30-0.70), so the step-2 tie-break criterion ("lowest threshold
  // where false_top_1 reaches 0%") no longer discriminates. 0.65 is the
  // highest threshold before no_match(real) starts rising above 0% —
  // verified via --compare that 0.65 vs 0.55 and 0.65 vs 0.60 are both
  // strict improvements (0 broken, 1 fixed each: a generic/oov label
  // fixture that a real, closely-related product was coincidentally
  // matching now correctly returns no_match, with zero cost to any
  // real-match case).
  minMatchScore: 0.65,
  recallLimit: 100,
  maxResults: 6,
  brandFilterThreshold: 0.75,
  stopwordsEnabled: true,
  wordIndexEnabled: false,
};
