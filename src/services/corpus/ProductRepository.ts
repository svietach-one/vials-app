import { normalizeForMatch } from '@/utils/textNormalize';
import type { ActiveIngredientKey } from '@/types';

import { isShortQuery, scoreCandidate, SHORT_QUERY_MIN_SCORE } from './scoreCandidate';
import { SEARCH_CONFIG } from './searchConfig';
import { toTrigramQuery } from './trigramSearch';
import { compareTypedCandidates, type TypedRankable } from './typedRanking';
import type { CorpusProduct, CorpusQueryExecutor, ProductQuery, ScoredCorpusProduct } from './types';

const COLS = `uid, barcode, brand, name, type, inci_raw as inciRaw, image_url as imageUrl, source, url, name_lacin as nameLacin`;
/** Adds rating_count for the typed-path deterministic tiebreak (typedRanking.ts) — never exposed on CorpusProduct. */
const COLS_WITH_RATING = `${COLS}, rating_count as ratingCount`;

/** A recall-stage row that may carry the typed-path tiebreak field. Internal only — search() strips nothing, but never promises ratingCount to callers. */
type CandidateRow = CorpusProduct & { ratingCount?: number };

/**
 * Minimum raw (trimmed, un-normalized) typed-query length below which
 * search() returns no list at all — "Minimum query length" in the step doc:
 * "A 1-character query cannot be meaningfully ranked against 17k rows and
 * should not try." Measured on the raw input (what's literally in the search
 * box), not the normalized length, so e.g. "2%" (2 raw chars) still queries
 * even though normalizeForMatch strips the "%" down to a 1-char token.
 */
const TYPED_MIN_QUERY_LENGTH = 2;

const LIKE_ESCAPE = '\\';

/** Escapes SQLite LIKE metacharacters so user-typed `%`/`_` are matched literally. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `${LIKE_ESCAPE}${c}`);
}

/**
 * SQLite's `lower()`/`LIKE` only case-fold ASCII, so a non-ASCII query (e.g.
 * Cyrillic) won't match `search_norm` rows whose non-ASCII characters kept
 * the source data's original casing (products.search_norm is generated via
 * SQL `lower()`, which leaves Cyrillic untouched — verified against the
 * corpus: `lower('КРЕМ')` returns 'КРЕМ' unchanged). Rather than depend on
 * SQL-side folding, generate a handful of realistic case variants in JS
 * (which folds Unicode correctly) and match any of them literally.
 */
function caseVariants(text: string): string[] {
  const titleCased = text.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return [...new Set([text, text.toLowerCase(), text.toUpperCase(), titleCased])];
}

/**
 * Read-only access to the remote product corpus over {@link CorpusQueryExecutor}
 * (the Turso HTTP transport). Never issues a write.
 *
 * `search` intentionally lets transport errors propagate so the caller can
 * surface a real error instead of a fake empty result — see AddProductHubScreen.
 * The secondary lookups (`findByBarcode`, `getByUid`, `getActiveKeys`) keep a
 * graceful "not found" fallback because their callers already treat that as a
 * cue to fall back to OBF/manual entry, but they log the failure (never
 * silently swallow it) so a broken corpus is visible in the logs.
 */
export class ProductRepository {
  constructor(private db: CorpusQueryExecutor) {}

  async findByBarcode(barcode: string): Promise<CorpusProduct | null> {
    try {
      return await this.db.getFirstAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE barcode = ? LIMIT 1`,
        [barcode],
      );
    } catch (e) {
      if (__DEV__) console.warn('[ProductRepository] findByBarcode failed', e);
      return null;
    }
  }

  async getByUid(uid: string): Promise<CorpusProduct | null> {
    try {
      return await this.db.getFirstAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE uid = ? LIMIT 1`,
        [uid],
      );
    } catch (e) {
      if (__DEV__) console.warn('[ProductRepository] getByUid failed', e);
      return null;
    }
  }

  /**
   * Retrieve-wide, re-rank-narrow (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md):
   * this method is the RECALL stage only — a wide, unscored candidate pool
   * (up to {@link SEARCH_CONFIG.recallLimit} rows), exposed as its own method
   * so the eval harness can measure `recall@retrieval` independently of the
   * scoring/cutoff stage {@link search} applies on top.
   *
   * Branches on {@link ProductQuery.origin}: a human typing and a camera
   * reading a label produce different error distributions (typing preserves
   * prefixes and errs at the end; OCR errs mid-token). Applying OCR-grade
   * fuzzy matching to typed input is a category error — see the step doc.
   */
  async retrieveCandidates(query: ProductQuery): Promise<CorpusProduct[]> {
    const trimmed = [query.brand, query.name].filter(Boolean).join(' ').trim();
    if (!trimmed) return [];
    return query.origin === 'typed'
      ? this.retrieveTypedCandidates(trimmed)
      : this.retrieveOcrCandidates(trimmed);
  }

  /**
   * OCR recall: trigram FTS (tolerates mid-token OCR noise), falling back to
   * a case-variant `search_norm` substring scan when the joined brand+name
   * text is too short to yield any trigram (sub-3-char token).
   */
  private async retrieveOcrCandidates(trimmed: string): Promise<CorpusProduct[]> {
    const limit = SEARCH_CONFIG.recallLimit;
    const match = toTrigramQuery(trimmed);
    if (match) {
      return this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS.split(',')
          .map((c) => 'p.' + c.trim())
          .join(', ')}
         FROM products_fts f JOIN products p ON p.id = f.rowid
         WHERE products_fts MATCH ? ORDER BY bm25(products_fts, 2.0, 1.0) LIMIT ?`,
        [match, limit],
      );
    }
    const params = caseVariants(trimmed).map((v) => `%${escapeLikePattern(v)}%`);
    const where = params.map(() => `search_norm LIKE ? ESCAPE '${LIKE_ESCAPE}'`).join(' OR ');
    return this.db.getAllAsync<CorpusProduct>(
      `SELECT ${COLS} FROM products WHERE ${where} ORDER BY search_norm LIMIT ?`,
      [...params, limit],
    );
  }

  /**
   * Typed recall: word-boundary prefix scan against `search_norm` (typing
   * preserves prefixes — see step doc). Two LIKE patterns per case variant:
   * `text%` (query prefixes the whole "brand name" string — catches
   * brand-first and exact-combined queries) and `% text%` (query prefixes
   * some later word — catches a name-only query against a differently
   * branded product, e.g. "niacinamide" against "The Ordinary Niacinamide...").
   *
   * Supplemented with a fuzzy trigram pass (same recall as the OCR path) ONLY
   * when the prefix scan is thin (fewer than maxResults rows) AND the query
   * is long enough (>=4 normalized chars) to fuzzy-match meaningfully — this
   * is "tier 5" in typedRanking.ts's ranking tiers, a supplement, not the
   * default (today it's the default, which is the whole problem — step doc).
   */
  private async retrieveTypedCandidates(trimmed: string): Promise<CorpusProduct[]> {
    const limit = SEARCH_CONFIG.recallLimit;
    const prefixRows = await this.likeWordBoundaryPrefixScan(trimmed, limit);

    const normalizedLen = normalizeForMatch(trimmed).length;
    if (prefixRows.length >= SEARCH_CONFIG.maxResults || normalizedLen < 4) {
      return prefixRows;
    }

    const match = toTrigramQuery(trimmed);
    if (!match) return prefixRows;
    const fuzzyRows = await this.db.getAllAsync<CandidateRow>(
      `SELECT ${COLS_WITH_RATING.split(',')
        .map((c) => 'p.' + c.trim())
        .join(', ')}
       FROM products_fts f JOIN products p ON p.id = f.rowid
       WHERE products_fts MATCH ? ORDER BY bm25(products_fts, 2.0, 1.0) LIMIT ?`,
      [match, limit],
    );
    if (fuzzyRows.length === 0) return prefixRows;

    const seen = new Set(prefixRows.map((r) => r.uid));
    const merged: CorpusProduct[] = [...prefixRows];
    for (const row of fuzzyRows) {
      if (!seen.has(row.uid)) {
        merged.push(row);
        seen.add(row.uid);
      }
    }
    return merged.slice(0, limit);
  }

  private async likeWordBoundaryPrefixScan(trimmed: string, limit: number): Promise<CandidateRow[]> {
    const clauses: string[] = [];
    const params: string[] = [];
    for (const variant of caseVariants(trimmed)) {
      const escaped = escapeLikePattern(variant);
      clauses.push(`search_norm LIKE ? ESCAPE '${LIKE_ESCAPE}'`);
      params.push(`${escaped}%`);
      clauses.push(`search_norm LIKE ? ESCAPE '${LIKE_ESCAPE}'`);
      params.push(`% ${escaped}%`);
    }
    const where = clauses.join(' OR ');
    return this.db.getAllAsync<CandidateRow>(
      `SELECT ${COLS_WITH_RATING} FROM products WHERE ${where} ORDER BY search_norm LIMIT ?`,
      [...params, limit],
    );
  }

  /**
   * Precision stage (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md):
   * scores every recall-stage candidate 0..1, drops anything under the floor
   * (the empty-result case — "Product not found -> Add manually" — now fires
   * for real), and caps the rest at {@link SEARCH_CONFIG.maxResults}.
   *
   * Typed queries are additionally tier-sorted (see typedRanking.ts) with a
   * deterministic tiebreak so results don't reshuffle between keystrokes.
   * Below {@link TYPED_MIN_QUERY_LENGTH} raw (trimmed) chars, a typed query
   * can't be meaningfully ranked against ~17k rows and returns no list at all.
   */
  async search(query: ProductQuery): Promise<ScoredCorpusProduct[]> {
    // Definition of done (00-README.md): every step's behavioural change is
    // behind its own SEARCH_CONFIG flag. With scoringV2 off, reproduce the
    // exact pre-step-2 behaviour (origin-agnostic trigram/LIKE, LIMIT 20,
    // unscored) so the harness can A/B this step the same way step 1's
    // segmentOcrQuery toggle worked.
    if (!SEARCH_CONFIG.scoringV2) return this.legacySearch(query);

    const trimmed = [query.brand, query.name].filter(Boolean).join(' ').trim();
    if (!trimmed) return [];
    if (query.origin === 'typed' && trimmed.length < TYPED_MIN_QUERY_LENGTH) return [];

    const candidates = await this.retrieveCandidates(query);
    if (candidates.length === 0) return [];

    const floor = isShortQuery(query) ? SHORT_QUERY_MIN_SCORE : SEARCH_CONFIG.minMatchScore;
    const scored: (ScoredCorpusProduct & { ratingCount?: number })[] = candidates
      .map((c) => ({ ...c, score: scoreCandidate(query, c) }))
      .filter((c) => c.score >= floor);

    if (query.origin === 'typed') {
      const rankable = scored as unknown as TypedRankable[];
      rankable.sort(compareTypedCandidates(query));
    } else {
      scored.sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
    }

    return scored.slice(0, SEARCH_CONFIG.maxResults);
  }

  /**
   * Pre-step-2 behaviour, byte-for-byte (docs/tasks/ocr_improvement/02-segment-ocr-query.md
   * era): a single, origin-agnostic trigram FTS / LIKE recall path, LIMIT 20,
   * no scoring, no cutoff. Exists only so `SEARCH_CONFIG.scoringV2 = false`
   * gives the eval harness a real A/B baseline for this step, the same way
   * `segmentOcrQuery` did for step 1. `score` is NaN — this path never scores
   * anything, so there is no real value to report; ScoredCorpusProduct.score
   * is still populated (never omitted) to keep the return shape uniform.
   */
  private async legacySearch(query: ProductQuery): Promise<ScoredCorpusProduct[]> {
    const trimmed = [query.brand, query.name].filter(Boolean).join(' ').trim();
    if (!trimmed) return [];
    const match = toTrigramQuery(trimmed);
    let rows: CorpusProduct[];
    if (match) {
      rows = await this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS.split(',')
          .map((c) => 'p.' + c.trim())
          .join(', ')}
         FROM products_fts f JOIN products p ON p.id = f.rowid
         WHERE products_fts MATCH ? ORDER BY bm25(products_fts, 2.0, 1.0) LIMIT 20`,
        [match],
      );
    } else {
      const params = caseVariants(trimmed).map((v) => `%${escapeLikePattern(v)}%`);
      const where = params.map(() => `search_norm LIKE ? ESCAPE '${LIKE_ESCAPE}'`).join(' OR ');
      rows = await this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE ${where} ORDER BY search_norm LIMIT 20`,
        params,
      );
    }
    return rows.map((r) => ({ ...r, score: NaN }));
  }

  async getActiveKeys(uid: string): Promise<ActiveIngredientKey[]> {
    try {
      const rows = await this.db.getAllAsync<{ active_key: ActiveIngredientKey }>(
        `SELECT t.active_key FROM product_tags t
         JOIN products p ON p.id = t.product_id WHERE p.uid = ?`,
        [uid],
      );
      return rows.map((r) => r.active_key);
    } catch (e) {
      if (__DEV__) console.warn('[ProductRepository] getActiveKeys failed', e);
      return [];
    }
  }
}
