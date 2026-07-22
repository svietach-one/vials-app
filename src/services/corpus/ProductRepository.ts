import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActiveIngredientKey } from '@/types';

import { toTrigramQuery } from './trigramSearch';
import type { CorpusProduct } from './types';

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
 * Read-only access to the pull-only corpus replica. Never issues a write.
 * Every method swallows query errors (e.g. the replica hasn't synced yet, or
 * the OBF cutover DELETE just ran) and degrades to "not found" — callers must
 * always offer the manual-entry fallback, same contract as the OBF service.
 */
export class ProductRepository {
  constructor(private db: SQLiteDatabase) {}

  async findByBarcode(barcode: string): Promise<CorpusProduct | null> {
    try {
      return await this.db.getFirstAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE barcode = ? LIMIT 1`,
        [barcode],
      );
    } catch {
      return null;
    }
  }

  async getByUid(uid: string): Promise<CorpusProduct | null> {
    try {
      return await this.db.getFirstAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE uid = ? LIMIT 1`,
        [uid],
      );
    } catch {
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
    try {
      if (match) {
        return await this.db.getAllAsync<CorpusProduct>(
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
      return await this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS} FROM products WHERE ${where} ORDER BY search_norm LIMIT 20`,
        params,
      );
    } catch {
      return [];
    }
  }

  async getActiveKeys(uid: string): Promise<ActiveIngredientKey[]> {
    try {
      const rows = await this.db.getAllAsync<{ active_key: ActiveIngredientKey }>(
        `SELECT t.active_key FROM product_tags t
         JOIN products p ON p.id = t.product_id WHERE p.uid = ?`,
        [uid],
      );
      return rows.map((r) => r.active_key);
    } catch {
      return [];
    }
  }
}
