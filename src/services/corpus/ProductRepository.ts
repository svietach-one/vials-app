import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActiveIngredientKey } from '@/types';

import { toTrigramQuery } from './trigramSearch';
import type { CorpusProduct } from './types';

const COLS = `uid, barcode, brand, name, type, inci_raw as inciRaw, image_url as imageUrl, source`;

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

  /** Trigram FTS search, top 20 ranked by bm25. Tolerates OCR/typo noise. */
  async search(query: string): Promise<CorpusProduct[]> {
    const match = toTrigramQuery(query);
    if (!match) return [];
    try {
      return await this.db.getAllAsync<CorpusProduct>(
        `SELECT ${COLS.split(',')
          .map((c) => 'p.' + c.trim())
          .join(', ')}
         FROM products_fts f JOIN products p ON p.id = f.rowid
         WHERE products_fts MATCH ? ORDER BY bm25(products_fts) LIMIT 20`,
        [match],
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
