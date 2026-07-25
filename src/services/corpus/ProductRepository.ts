import type { ActiveIngredientKey } from '@/types';

import { toTrigramQuery } from './trigramSearch';
import type { CorpusProduct, CorpusQueryExecutor } from './types';

const COLS = `uid, barcode, brand, name, type, inci_raw as inciRaw, image_url as imageUrl, source, url, name_lacin as nameLacin`;

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
   * Trigram FTS search, top 20 ranked by bm25, for queries with a 3+ char
   * token (tolerates OCR/typo noise). Queries shorter than that (typing the
   * first 1-2 letters) yield no trigrams at all, so those fall back to a
   * literal, case-variant substring scan against the precomputed
   * `search_norm` column so the dropdown stays useful while the user is
   * still typing.
   */
  async search(query: string): Promise<CorpusProduct[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const match = toTrigramQuery(trimmed);
    if (match) {
      return this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS.split(',')
          .map((c) => 'p.' + c.trim())
          .join(', ')}
         FROM products_fts f JOIN products p ON p.id = f.rowid
         WHERE products_fts MATCH ? ORDER BY bm25(products_fts, 2.0, 1.0) LIMIT 20`,
        [match],
      );
    }
    const params = caseVariants(trimmed).map((v) => `%${escapeLikePattern(v)}%`);
    const where = params.map(() => `search_norm LIKE ? ESCAPE '${LIKE_ESCAPE}'`).join(' OR ');
    return this.db.getAllAsync<CorpusProduct>(
      `SELECT ${COLS} FROM products WHERE ${where} ORDER BY search_norm LIMIT 20`,
      params,
    );
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
