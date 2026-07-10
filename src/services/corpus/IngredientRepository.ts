import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActiveIngredientKey } from '@/types';

import type { IngredientHit } from './types';

/**
 * Read-only access to the pull-only corpus replica. Never issues a write.
 * Every method swallows query errors and degrades to "no hit" — same
 * fallback contract as {@link ProductRepository}.
 */
export class IngredientRepository {
  constructor(private db: SQLiteDatabase) {}

  /** Prefix autocomplete over inci_name + synonyms. Debounce ~300ms at the call site. */
  async autocomplete(prefix: string): Promise<IngredientHit[]> {
    const p = prefix.trim().toLowerCase();
    if (p.length < 2) return [];
    try {
      return await this.db.getAllAsync<IngredientHit>(
        `SELECT i.inci_name AS inciName, i.active_key AS activeKey
         FROM ingredients_fts f JOIN ingredients i ON i.id = f.rowid
         WHERE ingredients_fts MATCH ? LIMIT 10`,
        [`${p}*`],
      );
    } catch {
      return [];
    }
  }

  async getActiveKey(inciName: string): Promise<ActiveIngredientKey | null> {
    try {
      const row = await this.db.getFirstAsync<{ active_key: ActiveIngredientKey | null }>(
        `SELECT active_key FROM ingredients WHERE inci_name_norm = lower(trim(?)) LIMIT 1`,
        [inciName],
      );
      return row?.active_key ?? null;
    } catch {
      return null;
    }
  }
}
