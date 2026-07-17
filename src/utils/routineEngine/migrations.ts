import type {
  ActiveIngredientKey,
  FitzpatrickType,
  Product,
  Routine,
  SkinConcern,
  SkinGoal,
  SkinPhototype,
  UserProfile,
} from '@/types';
import { normalizeActiveKey } from '@/utils/ingredientParser';

/**
 * Persisted-data migrations bridging pre-ruleset storage to the V2 routine
 * engine schema. Pure and deterministic: no React, no store access, no
 * AsyncStorage — stores call these on hydrate and persist the result once.
 *
 * Every migration is idempotent AND returns the SAME reference when nothing
 * changes, so stores can persist only on an actual change (`result !== input`)
 * and re-running a migration over already-migrated data is a no-op.
 */

/** Current persisted schema version. Bumped whenever a migration is added. */
export const CURRENT_SCHEMA_VERSION = 2;

/** Version assumed for installs that predate the schemaVersion key. */
export const BASELINE_SCHEMA_VERSION = 1;

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * Maps the grouped phototype to its stricter Fitzpatrick member — the
 * safety-first default (harsher SPF / PIH assumptions; the user can refine it):
 * type_1_2 → 1, type_3_4 → 4, type_5_6 → 6. Null grouped value → null.
 */
export function deriveFitzpatrick(phototype: SkinPhototype | null): FitzpatrickType | null {
  switch (phototype) {
    case 'type_1_2':
      return 1;
    case 'type_3_4':
      return 4;
    case 'type_5_6':
      return 6;
    default:
      return null;
  }
}

/**
 * Reverse mapping for UI writes of the numeric scale (FE-9 six-card input):
 * 1|2 → type_1_2, 3|4 → type_3_4, 5|6 → type_5_6. Null → null.
 */
export function deriveGroupedPhototype(
  fitzpatrick: FitzpatrickType | null,
): SkinPhototype | null {
  if (fitzpatrick === null) return null;
  if (fitzpatrick <= 2) return 'type_1_2';
  if (fitzpatrick <= 4) return 'type_3_4';
  return 'type_5_6';
}

/**
 * Adds the schema-v2 profile fields: `city` (default null) and the numeric
 * `fitzpatrick` derived from the grouped `phototype`. The grouped field is left
 * untouched (transitional shape); profileStore setters keep the two in sync.
 */
/**
 * Concern → goal heuristic for pre-goal profiles (V2.1 phase-03 §3.1).
 * First match wins in this order; empty concerns default to maintenance.
 */
const CONCERN_GOAL_ORDER: [SkinConcern[], SkinGoal][] = [
  [['acne', 'pores'], 'acne'],
  [['hyperpigmentation', 'dark_spots'], 'pigmentation'],
  [['wrinkles'], 'aging'],
  [['dryness'], 'dehydration'],
  [['sensitivity', 'redness', 'eczema'], 'barrier_repair'],
];

export function deriveGoalFromConcerns(concerns: SkinConcern[]): SkinGoal {
  for (const [group, goal] of CONCERN_GOAL_ORDER) {
    if (concerns.some((c) => group.includes(c))) return goal;
  }
  return 'maintenance';
}

export function migrateProfile(profile: UserProfile): UserProfile {
  const fitzpatrick = deriveFitzpatrick(profile.phototype);
  const cityPresent = profile.city !== undefined;
  const fitzpatrickCurrent = profile.fitzpatrick === fitzpatrick;
  // Pre-goal persisted profiles lack the field entirely; a present value —
  // including a user-confirmed 'maintenance' — is never re-derived.
  const goalsPresent = profile.primaryGoal !== undefined;

  if (cityPresent && fitzpatrickCurrent && goalsPresent) return profile;

  const primaryGoal = goalsPresent ? profile.primaryGoal : deriveGoalFromConcerns(profile.concerns);
  return {
    ...profile,
    city: cityPresent ? profile.city : null,
    fitzpatrick,
    primaryGoal,
    secondaryGoal: goalsPresent ? profile.secondaryGoal : null,
    // Confirmation is only owed for a real guess — an empty-concerns default
    // of maintenance is not one (tech design Phase 3, Assumption 1).
    goalNeedsConfirmation: goalsPresent
      ? profile.goalNeedsConfirmation
      : profile.concerns.length > 0,
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

/** Canonicalizes a tag list, de-duplicating collapsed keys. */
function migrateTagList(tags: ActiveIngredientKey[]): {
  tags: ActiveIngredientKey[];
  vitaminCFired: boolean;
} {
  let vitaminCFired = false;
  const seen = new Set<ActiveIngredientKey>();
  const out: ActiveIngredientKey[] = [];

  for (const key of tags) {
    const next = normalizeActiveKey(key);
    if (key === 'vitamin_c' && next === 'vitamin_c_pure') vitaminCFired = true;
    if (!seen.has(next)) {
      seen.add(next);
      out.push(next);
    }
  }

  const changed = out.length !== tags.length || out.some((k, i) => k !== tags[i]);
  return { tags: changed ? out : tags, vitaminCFired };
}

/**
 * Canonicalizes a product's persisted `activeTags` and `activeIngredients`
 * keys via the ruleset legacyKeyMap (retinol → retinoid, vitamin_c →
 * vitamin_c_pure, spf_chemical → spf_filters). When the vitamin_c →
 * vitamin_c_pure mapping fires, sets the persistent `vitaminCAutoMigrated`
 * marker the product-detail infobox reads. Returns the same reference when the
 * product is already canonical.
 */
export function migrateProductActiveKeys(product: Product): Product {
  let vitaminCFired = false;

  // activeTags (optional)
  let nextTags = product.activeTags;
  if (product.activeTags) {
    const result = migrateTagList(product.activeTags);
    nextTags = result.tags;
    vitaminCFired = vitaminCFired || result.vitaminCFired;
  }
  const tagsChanged = nextTags !== product.activeTags;

  // activeIngredients (always present)
  let ingredientsChanged = false;
  const nextIngredients = product.activeIngredients.map((ing) => {
    const next = normalizeActiveKey(ing.key);
    if (next === ing.key) return ing;
    ingredientsChanged = true;
    if (ing.key === 'vitamin_c' && next === 'vitamin_c_pure') vitaminCFired = true;
    return { ...ing, key: next };
  });

  const vitaminCAutoMigrated = vitaminCFired || product.vitaminCAutoMigrated === true;
  const markerChanged = vitaminCAutoMigrated !== (product.vitaminCAutoMigrated === true);

  if (!tagsChanged && !ingredientsChanged && !markerChanged) return product;

  return {
    ...product,
    ...(tagsChanged ? { activeTags: nextTags } : {}),
    ...(ingredientsChanged ? { activeIngredients: nextIngredients } : {}),
    ...(vitaminCAutoMigrated ? { vitaminCAutoMigrated: true } : {}),
  };
}

/**
 * Backfills `source` for products persisted before the provenance field
 * existed: an Open Beauty Facts id means the product came from an OBF
 * result ('obf_import'); everything else was typed in by hand
 * ('user_local'). Same-ref when already set.
 */
export function migrateProductSource(product: Product): Product {
  if (product.source !== undefined) return product;
  return {
    ...product,
    source: product.openBeautyFactsId !== null ? 'obf_import' : 'user_local',
  };
}

/** Applies the per-product migrations across a list, same-ref when unchanged. */
export function migrateProducts(products: Product[]): Product[] {
  let changed = false;
  const next = products.map((p) => {
    const migrated = migrateProductSource(migrateProductActiveKeys(p));
    if (migrated !== p) changed = true;
    return migrated;
  });
  return changed ? next : products;
}

// ─── Routines ─────────────────────────────────────────────────────────────────

/**
 * Normalizes routine steps to the current schema: defaults `scheduledDays` to
 * [] (pre-field data) and `userPinned` to false. Returns the same reference
 * when every step already conforms.
 */
export function migrateRoutines(routines: Routine[]): Routine[] {
  let anyRoutineChanged = false;

  const next = routines.map((routine) => {
    let anyStepChanged = false;

    const steps = routine.steps.map((step) => {
      const scheduledDays = step.scheduledDays ?? [];
      const needsSchedule = scheduledDays !== step.scheduledDays;
      const needsPinned = step.userPinned === undefined;
      if (!needsSchedule && !needsPinned) return step;
      anyStepChanged = true;
      return {
        ...step,
        scheduledDays,
        userPinned: step.userPinned ?? false,
      };
    });

    if (!anyStepChanged) return routine;
    anyRoutineChanged = true;
    return { ...routine, steps };
  });

  return anyRoutineChanged ? next : routines;
}
