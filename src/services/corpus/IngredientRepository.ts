import type { ActiveIngredientKey } from '@/types';

import type { CorpusQueryExecutor, IngredientHit } from './types';

/**
 * Read-only access to the remote ingredient corpus over
 * {@link CorpusQueryExecutor}. Never issues a write. Both methods degrade to
 * "no hit" on a transport error (autocomplete/lookup are non-blocking helpers)
 * but log the failure rather than swallow it silently.
 */
export class IngredientRepository {
  constructor(private db: CorpusQueryExecutor) {}

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
    } catch (e) {
      if (__DEV__) console.warn('[IngredientRepository] autocomplete failed', e);
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
    } catch (e) {
      if (__DEV__) console.warn('[IngredientRepository] getActiveKey failed', e);
      return null;
    }
  }
}
