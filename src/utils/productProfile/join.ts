/**
 * Product Profile builder — Stage 2: Corpus × Ruleset Join.
 * docs/tasks/product_profile/02-profile-builder.md §5.
 *
 * For each resolved `activeKey`, look up its full class record in
 * `actives.json`. Pure read, no data copied — the single join point stages
 * 3–7 read from instead of re-querying `ACTIVES_RULESET` directly.
 *
 * Pure module: no React, no react-native, no store, no I/O.
 */
import { ACTIVES_RULESET, type ActiveClass, type Potency } from '@/constants/rulesets/rulesetTypes';
import type { ActiveIngredientKey } from '@/types';

/** One present class's full ruleset record, plus its best-evidenced potency. */
export interface ClassFactsRecord {
  key: ActiveIngredientKey;
  activeClass: ActiveClass;
  potency?: Potency;
}

/**
 * Joins resolved active keys against `ACTIVES_RULESET.classes`. Keys with no
 * matching class are skipped (resolve.ts already filters to known classes
 * only, so this is a defensive no-op in practice, not a silent data loss).
 */
export function joinActiveKeys(
  resolvedActiveKeys: ActiveIngredientKey[],
  potencyByKey: Partial<Record<ActiveIngredientKey, Potency>> = {},
): ClassFactsRecord[] {
  const records: ClassFactsRecord[] = [];
  for (const key of resolvedActiveKeys) {
    const activeClass = ACTIVES_RULESET.classes[key];
    if (!activeClass) continue;
    records.push({ key, activeClass, potency: potencyByKey[key] });
  }
  return records;
}
