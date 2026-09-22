/**
 * Explore Composition flow — Skin-type caution signal (Story 7, 2026-08-26
 * decision batch, FE-11). docs/tech-design/explore-composition.md §3 FE-11.
 *
 * Fires on `exfoliating === true` OR `photosensitizing === true` OR
 * `irritancy >= 3` (the flat tier, read directly off `ActiveProperties` — NOT
 * potency-resolved via `resolveIrritancy()`; see the tech design's "flat
 * irritancy tier" assumption: the human's own 500-composition coverage check
 * that selected this exact logic was run against the flat tier), regardless
 * of whether a `barrierRepair === true` class is also present in the same
 * composition (the deliberately "loosened" definition, spec Story 7 AC1).
 *
 * This module takes no `skinType` argument and is not responsible for the
 * null-`skinType` suppression rule — it only knows about resolved classes,
 * not the profile (tech design's engineer-unit-test task note). Suppression
 * when `profile.skinType` is `null`, and composing the final sentence that
 * names the user's stored skin type, are both the caller's job
 * (`ExploreCompositionResultScreen.tsx` / `SkinTypeCautionNotice.tsx`).
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import type { ActiveIngredientKey } from '@/types';
import type { ClassFactsRecord } from '@/utils/productProfile/join';

export interface SkinTypeCautionResult {
  /** Every resolved class that met the trigger condition, not just the first. */
  triggeringKeys: ActiveIngredientKey[];
}

/** True when this class alone is enough to fire the caution (flat irritancy tier, no potency resolution). */
function triggersCaution(record: ClassFactsRecord): boolean {
  const { properties } = record.activeClass;
  return (
    properties.exfoliating === true ||
    properties.photosensitizing === true ||
    (properties.irritancy ?? 0) >= 3
  );
}

/**
 * Returns `null` when no present class meets the trigger condition. Else
 * returns every triggering class's key (not just the first) — the caller
 * decides how to phrase the sentence and whether `profile.skinType` allows it
 * to render at all.
 */
export function buildSkinTypeCaution(classFacts: ClassFactsRecord[]): SkinTypeCautionResult | null {
  const triggeringKeys = classFacts.filter(triggersCaution).map((record) => record.key);

  if (triggeringKeys.length === 0) return null;

  return { triggeringKeys };
}
