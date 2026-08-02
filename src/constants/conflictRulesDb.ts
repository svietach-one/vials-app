import { ConflictSeverity, CosmeticProcedureKey, ProcedureCollisionRule } from '@/types';

/**
 * Ingredient pair rules used to live here as INGREDIENT_CONFLICT_RULES. They
 * now live in src/constants/rulesets/actives.json `pairRules` — the single
 * source of truth the routine engine already resolved against — and reach the
 * app through ConflictEngine. Procedure collisions stay here: a different
 * domain, never duplicated.
 */
export const PROCEDURE_COLLISION_RULES: ProcedureCollisionRule[] = [
  {
    itemA: 'botox',
    itemB: 'smas_lifting',
    severity: 'avoid',
    explanation:
      'Deep thermal energy from SMAS devices accelerates tissue metabolism, breaking down and prematurely flushing out botulinum toxin.',
    suggestion:
      'Wait at least 4-6 weeks after Botox injections before scheduling high-intensity micro-focused ultrasound treatments.',
  },
  {
    itemA: 'fillers',
    itemB: 'chemical_peel_deep',
    severity: 'avoid',
    explanation:
      'Deep chemical acids used before full filler stabilization (first 14 days) can cause severe deep tissue swelling and migration of hyaluronic acid.',
    suggestion:
      'Ensure at least 14 days of complete internal healing post-filler injection before applying professional peels.',
  },
];

/**
 * Pregnancy / breastfeeding procedure severity map (pregnancy-safety-handling
 * spec §4 Story 3, tech design FE-8). Draft data, pending clinical review —
 * spec §10. Read only by ConflictEngine.checkPregnancyConflict, which
 * self-gates on PREGNANCY_SAFETY_ENABLED before ever consulting this map.
 */
export const PREGNANCY_PROCEDURE_SEVERITY: Partial<Record<CosmeticProcedureKey, ConflictSeverity>> = {
  botox: 'avoid',
  fillers: 'avoid',
  smas_lifting: 'avoid',
  mesotherapy: 'avoid',
  chemical_peel_deep: 'avoid',
  mechanical_facial: 'caution',
};

/**
 * Pregnancy / breastfeeding advisory copy per procedure, paired 1:1 with
 * {@link PREGNANCY_PROCEDURE_SEVERITY}. Draft text pending clinical review —
 * spec §10. Every suggestion routes to a professional, never a categorical
 * medical claim (spec §5).
 */
export const PREGNANCY_PROCEDURE_COPY: Partial<
  Record<CosmeticProcedureKey, { explanation: string; suggestion: string }>
> = {
  botox: {
    explanation: 'Injectable neurotoxin, routinely deferred during pregnancy or breastfeeding.',
    suggestion: 'Discuss timing with your doctor or practitioner.',
  },
  fillers: {
    explanation:
      'Injectable dermal filler — safety data in pregnancy and breastfeeding is limited, so it is routinely deferred.',
    suggestion: 'Discuss timing with your doctor or practitioner.',
  },
  smas_lifting: {
    explanation:
      'Energy-based lifting device — not studied for safety during pregnancy or breastfeeding.',
    suggestion: 'Discuss timing with your doctor or practitioner.',
  },
  mesotherapy: {
    explanation:
      'Injectable micro-dosing of actives — ingredient exposure is routinely avoided during pregnancy or breastfeeding.',
    suggestion: 'Discuss timing with your doctor or practitioner.',
  },
  chemical_peel_deep: {
    explanation:
      'Deep chemical peel — systemic absorption and healing load are routinely avoided during pregnancy or breastfeeding.',
    suggestion: 'Discuss timing with your doctor or practitioner.',
  },
  mechanical_facial: {
    explanation:
      'Generally considered lower-risk, but some techniques and products used during the treatment may warrant a second look during pregnancy or breastfeeding.',
    suggestion: 'Mention it to your practitioner so they can adjust products and technique if needed.',
  },
};
