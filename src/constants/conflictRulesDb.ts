import { ConflictRule, ProcedureCollisionRule } from '@/types';

export const INGREDIENT_CONFLICT_RULES: ConflictRule[] = [
  {
    id: 'rule_retinol_aha',
    itemA: 'retinoid',
    itemB: 'aha',
    severity: 'avoid',
    explanation:
      'Both Retinol and AHA (Glycolic/Lactic acid) accelerate skin cell turnover. Combining them in the same routine causes severe redness, peeling, and chemical irritation.',
    suggestion:
      'Separate them: use AHA 2 nights a week, and Retinol on the other nights. Never layer them together.',
  },
  {
    id: 'rule_retinol_bha',
    itemA: 'retinoid',
    itemB: 'bha',
    severity: 'avoid',
    explanation:
      'Salicylic Acid (BHA) strips lipids, while Retinol alters deep cell behavior. Layering them compromises the moisture barrier, triggering breakout flare-ups and dermatitis.',
    suggestion: 'Use BHA in your morning cleanser step (wash-off) and Retinol strictly at night.',
  },
  {
    id: 'rule_vitc_niacinamide',
    itemA: 'vitamin_c_pure',
    itemB: 'niacinamide',
    severity: 'caution',
    explanation:
      'Pure Vitamin C (Ascorbic Acid) requires a low pH to work. Niacinamide raises skin pH, which can neutralize Vitamin C efficiency and cause temporary facial flushing.',
    suggestion:
      'Apply Vitamin C first in the morning, wait 10 minutes to absorb, or move Niacinamide to your evening routine.',
  },
  {
    id: 'rule_benzoyl_retinol',
    itemA: 'benzoyl_peroxide',
    itemB: 'retinoid',
    severity: 'avoid',
    explanation:
      'Benzoyl Peroxide oxidizes Retinol, rendering both compounds completely useless while doubling skin dryness.',
    suggestion: 'Use Benzoyl Peroxide as a spot treatment in the morning, and Retinol at night.',
  },
];

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
