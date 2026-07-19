import { ProcedureCollisionRule } from '@/types';

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
