/**
 * Product Profile builder — Stage 5 (Irritation Aggregation) and Stage 6
 * (Sensitivity Compatibility).
 * docs/tasks/product_profile/02-profile-builder.md §8–9,
 * docs/tech-design/product-profile-m1.md FE-5.
 *
 * Pure module: no React, no react-native, no store, no I/O.
 */
import { resolveIrritancy } from '@/constants/rulesets/rulesetTypes';
import type { IrritationProfile, SensitivityCompatibility } from '@/types';
import type { ClassFactsRecord } from '@/utils/productProfile/join';

/**
 * `max_of_present` (docs/tasks/product_profile/06-open-questions.md Q1,
 * final): the single highest irritancy value among present classes,
 * `resolveIrritancy()` reused verbatim per class (never reimplemented — this
 * is exactly the `isStrongActive()` duplication pattern this design exists
 * to stop). `photosensitizing`/`lowPh` are OR-merged booleans, not aggregated
 * numerically: a single photosensitizing ingredient makes the whole product
 * photosensitizing regardless of what else is present.
 */
export function buildIrritationProfile(classFacts: ClassFactsRecord[]): IrritationProfile {
  if (classFacts.length === 0) {
    return {
      score: null,
      photosensitizing: false,
      lowPh: false,
      aggregationMethod: 'max_of_present',
      confidence: 'insufficient_data',
      sourceRefs: [],
      caveat: 'No resolved active classes to assess irritation from.',
    };
  }

  let score = 0;
  let photosensitizing = false;
  let lowPh = false;
  const sourceRefs: string[] = [];

  for (const { key, activeClass, potency } of classFacts) {
    score = Math.max(score, resolveIrritancy(activeClass.properties, potency));
    photosensitizing ||= activeClass.properties.photosensitizing === true;
    lowPh ||= activeClass.properties.lowPh === true;
    sourceRefs.push(`actives.json:classes.${key}.properties.irritancy`);
  }

  return {
    score,
    photosensitizing,
    lowPh,
    aggregationMethod: 'max_of_present',
    // Always at least 'heuristic' — the aggregation formula itself is a
    // design choice, per 01-product-profile.md §7, even though the
    // underlying per-class irritancy values are solid.
    confidence: 'heuristic',
    sourceRefs,
  };
}

/**
 * Ships `compatible: null` / `thresholdUsed: null` unconditionally this
 * milestone (tech-design FE-5, spec Non-Goals §3) — a numeric irritation
 * cutoff is a clinical/product decision not yet made
 * (docs/tasks/product_profile/06-open-questions.md Q3), never invented here.
 * Required field, still populated (never `undefined`).
 */
export function buildSensitivityCompatibility(): SensitivityCompatibility {
  return {
    compatible: null,
    thresholdUsed: null,
    confidence: 'insufficient_data',
    sourceRefs: [],
    caveat: 'Sensitivity threshold not yet clinically defined (spec §3/Q3).',
  };
}
