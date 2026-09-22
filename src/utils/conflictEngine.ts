import {
  PREGNANCY_PROCEDURE_COPY,
  PREGNANCY_PROCEDURE_SEVERITY,
  PROCEDURE_COLLISION_RULES,
} from '@/constants/conflictRulesDb';
import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';
import { ACTIVES_RULESET, type PairRule, type Period } from '@/constants/rulesets/rulesetTypes';
import {
  ActiveIngredientKey,
  ClinicalConflictResult,
  ConflictResult,
  ConflictRule,
  CosmeticProcedureKey,
  ProcedureLogKey,
  Product,
  RoutineStep,
  SkinPhototype,
} from '@/types';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import { getCurrentSeason } from '@/utils/timeHelpers';

export type { ClinicalConflictResult };

/**
 * A routine step optionally tagged with the AM/PM period it belongs to
 * (conflict-resolution-scope task). Display-layer-only concern: `RoutineStep`
 * itself carries no period field (period is a property of the containing
 * `Routine.timeOfDay`), so callers that know it attach it here rather than it
 * being persisted. `period` is optional so every pre-existing caller passing
 * plain `RoutineStep[]` keeps compiling and behaving exactly as before —
 * `resolutionScope: 'slot'` treats an unknown period on either side as "warn
 * regardless" (the same as `'day'`), never as a silent false negative.
 */
export type ConflictStepInput = RoutineStep & { period?: Period };

/** A pair-rule side is a single class key or a shared group of them. */
function sideKeys(side: PairRule['a']): ActiveIngredientKey[] {
  return Array.isArray(side) ? side : [side];
}

/**
 * Projects a matched pair rule onto the flat ConflictRule shape this engine's
 * callers (catalog, product detail) already render, naming the two classes that
 * actually matched rather than the rule's whole group.
 *
 * `scope` and potency `exceptions` are deliberately not applied here: this is
 * the app-facing "do these two products clash at all" view. Scheduling-aware
 * resolution — periods, day splits, potency downgrades — is the routine
 * engine's job (resolve.ts), which reads the same pairRules.
 */
function toConflictRule(
  rule: PairRule,
  itemA: ActiveIngredientKey,
  itemB: ActiveIngredientKey,
): ConflictRule {
  return {
    id: rule.id,
    itemA,
    itemB,
    severity: rule.severity,
    explanation: rule.explanation,
    suggestion: rule.suggestion,
  };
}

/**
 * Matches a pair of active classes against the pairRules table and returns
 * the raw matched rule (not yet projected), or null when compatible. Kept
 * internal — `matchPairRule` below is the public, ConflictRule-projecting
 * entry point every other caller keeps using unchanged.
 */
function matchRawPairRule(keyA: ActiveIngredientKey, keyB: ActiveIngredientKey): PairRule | null {
  for (const rule of ACTIVES_RULESET.pairRules) {
    const a = sideKeys(rule.a);
    const b = sideKeys(rule.b);
    if ((a.includes(keyA) && b.includes(keyB)) || (a.includes(keyB) && b.includes(keyA))) {
      return rule;
    }
  }
  return null;
}

/**
 * The one place a pair of active classes is matched against the pairRules
 * table. Returns the first rule covering the pair in either direction, or null
 * when they are compatible (an absent pair is a compatible pair). Deterministic:
 * rules are tried in declaration order.
 */
export function matchPairRule(
  keyA: ActiveIngredientKey,
  keyB: ActiveIngredientKey,
): ConflictRule | null {
  const rule = matchRawPairRule(keyA, keyB);
  if (!rule) return null;
  const a = sideKeys(rule.a);
  return a.includes(keyA) ? toConflictRule(rule, keyA, keyB) : toConflictRule(rule, keyB, keyA);
}

function findIngredientConflict(
  keysA: ActiveIngredientKey[],
  keysB: ActiveIngredientKey[],
): ConflictRule | null {
  for (const keyA of keysA) {
    for (const keyB of keysB) {
      const rule = matchPairRule(keyA, keyB);
      if (rule) return rule;
    }
  }
  return null;
}

/**
 * Whether a matched rule should actually fire for this pair of steps, given
 * their (optional) periods. `'day'` fires unconditionally — today's behavior
 * for every pair. `'slot'` fires only when both periods are known and equal;
 * an unknown period on either side falls back to firing (see
 * {@link ConflictStepInput} doc comment — never a silent false negative for
 * callers that haven't adopted period tagging).
 */
function resolutionScopeAllows(
  rule: PairRule,
  periodA: Period | undefined,
  periodB: Period | undefined,
): boolean {
  if (rule.resolutionScope !== 'slot') return true;
  if (periodA == null || periodB == null) return true;
  return periodA === periodB;
}

/**
 * Same pairwise search as `findIngredientConflict`, but resolutionScope-aware:
 * a matched rule is skipped (search continues over the remaining key pairs)
 * when its scope requires the same period and the two steps' periods differ.
 * Used only by `detectConflicts`, the one caller with per-step period info.
 */
function findIngredientConflictForSteps(
  keysA: ActiveIngredientKey[],
  keysB: ActiveIngredientKey[],
  periodA: Period | undefined,
  periodB: Period | undefined,
): ConflictRule | null {
  for (const keyA of keysA) {
    for (const keyB of keysB) {
      const rule = matchRawPairRule(keyA, keyB);
      if (!rule) continue;
      if (!resolutionScopeAllows(rule, periodA, periodB)) continue;
      const a = sideKeys(rule.a);
      return a.includes(keyA) ? toConflictRule(rule, keyA, keyB) : toConflictRule(rule, keyB, keyA);
    }
  }
  return null;
}

/**
 * Local safety engine for ingredient and clinical procedure conflicts.
 */
export class ConflictEngine {
  /** Detect ingredient conflicts across routine steps. */
  static detectConflicts(steps: ConflictStepInput[], products: Product[]): ConflictResult[] {
    const visibleSteps = steps.filter((step) => !step.hidden && step.productId);
    const results: ConflictResult[] = [];

    for (let i = 0; i < visibleSteps.length; i++) {
      for (let j = i + 1; j < visibleSteps.length; j++) {
        const stepA = visibleSteps[i];
        const stepB = visibleSteps[j];
        const productA = products.find((p) => p.id === stepA.productId);
        const productB = products.find((p) => p.id === stepB.productId);

        if (!productA || !productB) continue;

        const rule = findIngredientConflictForSteps(
          getProductActiveKeys(productA),
          getProductActiveKeys(productB),
          stepA.period,
          stepB.period,
        );

        if (rule) {
          results.push({ stepIdA: stepA.id, stepIdB: stepB.id, rule });
        }
      }
    }

    return results;
  }

  /** Check a new product against all existing catalog products. */
  static getConflictsForProduct(product: Product, catalog: Product[]): ConflictResult[] {
    const newKeys = getProductActiveKeys(product);
    const results: ConflictResult[] = [];

    for (const existing of catalog) {
      if (existing.id === product.id) continue;

      const rule = findIngredientConflict(newKeys, getProductActiveKeys(existing));
      if (rule) {
        results.push({
          stepIdA: product.id,
          stepIdB: existing.id,
          rule,
        });
      }
    }

    return results;
  }

  /**
   * Cross-procedure check (Procedure + Procedure).
   * Uses the procedure collision matrix from conflictRulesDb.
   * Custom procedures have no collision mappings and never match a rule.
   */
  static checkProcedureCollision(
    newProcedure: CosmeticProcedureKey,
    activeProcedures: { procedureKey: ProcedureLogKey; datePerformed: string }[],
  ): ClinicalConflictResult | null {
    for (const active of activeProcedures) {
      for (const rule of PROCEDURE_COLLISION_RULES) {
        const matches =
          (rule.itemA === newProcedure && rule.itemB === active.procedureKey) ||
          (rule.itemB === newProcedure && rule.itemA === active.procedureKey);

        if (matches) {
          return {
            severity: rule.severity,
            explanation: rule.explanation,
            suggestion: rule.suggestion,
          };
        }
      }
    }

    return null;
  }

  /**
   * Seasonal check (Procedure + Calendar).
   * Protects against severe pigmentation during high-UV months.
   */
  static checkSeasonalConflict(
    procedure: CosmeticProcedureKey,
    season: 'summer' | 'winter' | 'autumn' | 'spring' = getCurrentSeason(),
  ): ClinicalConflictResult | null {
    if (season === 'summer' && procedure === 'chemical_peel_deep') {
      return {
        severity: 'avoid',
        explanation:
          'Deep chemical peels completely strip the skin protective barrier. Summer UV levels will trigger severe post-inflammatory hyperpigmentation (PIH).',
        suggestion:
          'Postpone deep peels until autumn. Switch to gentle, all-season alternative enzymes if exfoliation is needed.',
      };
    }

    return null;
  }

  /**
   * Fitzpatrick phototype check (Procedure + Skin tone).
   * Melanin protection guidance for medium-to-dark phototypes.
   */
  static checkPhototypeConflict(
    procedure: CosmeticProcedureKey,
    phototype: SkinPhototype | null,
  ): ClinicalConflictResult | null {
    if (!phototype) return null;

    if (
      (phototype === 'type_3_4' || phototype === 'type_5_6') &&
      procedure === 'chemical_peel_deep'
    ) {
      return {
        severity: 'caution',
        explanation:
          'Medium to dark skin phototypes have hyper-reactive melanocytes. Deep chemical trauma can trigger uneven skin bleaching or severe dark stains.',
        suggestion:
          'Consult a dermatologist specialized in dark skin phototypes. A strict pre-treatment melanin-blocking protocol is required before this procedure.',
      };
    }

    return null;
  }

  /**
   * Pregnancy / breastfeeding advisory (Procedure + profile flag).
   * Mirrors checkSeasonalConflict's shape/self-gating philosophy: self-gates
   * on PREGNANCY_SAFETY_ENABLED internally (tech design FE-9) so callers like
   * AddProcedureModal never need their own flag check. Draft severity/copy
   * (conflictRulesDb.ts), pending clinical sign-off — spec §10.
   */
  static checkPregnancyConflict(
    procedure: CosmeticProcedureKey,
    isPregnantOrBreastfeeding: boolean,
  ): ClinicalConflictResult | null {
    if (!PREGNANCY_SAFETY_ENABLED || !isPregnantOrBreastfeeding) return null;

    const severity = PREGNANCY_PROCEDURE_SEVERITY[procedure];
    const copy = PREGNANCY_PROCEDURE_COPY[procedure];
    if (!severity || !copy) return null;

    return { severity, explanation: copy.explanation, suggestion: copy.suggestion };
  }

  /** Lifestyle restrictions for the Today screen during rehab (Phase 1). */
  static getRehabRestrictions(procedure: CosmeticProcedureKey): string[] {
    const restrictions: Record<CosmeticProcedureKey, string[]> = {
      botox: [
        'No sauna or hot baths',
        'No intense gym workouts / sweating',
        'Do not massage injection areas',
        'Stay upright for 4 hours',
      ],
      fillers: [
        'Avoid sleeping on your face',
        'No intense facial massages',
        'No extreme dental procedures',
        'No alcohol for 48 hours',
      ],
      smas_lifting: [
        'Avoid cooling or icing the face',
        'Skip active retinol for 5 days',
        'Use mild non-scented cleansers',
      ],
      mesotherapy: [
        'Do not touch papules or micro-wounds',
        'No makeup for 24 hours',
        'Strictly apply barrier-support creams',
      ],
      chemical_peel_deep: [
        'Do NOT pick or peel flaking skin',
        'Strictly indoor shelter or SPF 50+',
        'Zero active acids/retinol',
      ],
      mechanical_facial: [
        'No heavy comedogenic makeup today',
        'Change your pillowcase tonight',
        'Avoid touching your face',
      ],
    };

    return restrictions[procedure] ?? [];
  }
}
