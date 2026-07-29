import type { Product } from '@/types';
import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type { RoutineContext } from '@/utils/routineEngine/context';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';
import { periodsForProduct } from '@/utils/routineEngine/slotting';
import { findMatchingRule } from '@/utils/routineEngine/targeting';

/**
 * Pipeline step 3 — Eligibility. Hard gates only; every rejection carries an
 * explainable cause. Clinically frozen items are rejections here but are NOT
 * discarded downstream — the UI renders them as dimmed "Paused until" rows.
 */

export type EligibilityGate =
  | 'hidden'
  | 'pao_expired'
  | 'clinical_freeze'
  | 'pregnancy_freeze'
  | 'no_allowed_period';

export interface EligibilityRejection {
  productId: string;
  gate: EligibilityGate;
  reasonCode: DecisionReasonCode;
  /** Skincare date the gate expires — day-windowed clinical freezes only;
   * absent for freezes with no natural expiry (e.g. pregnancy_freeze). */
  until?: string;
}

export interface EligibilityResult {
  eligible: Product[];
  rejections: EligibilityRejection[];
}

/**
 * Applies the hard gates in a fixed order (hidden → PAO → clinical freeze →
 * no allowed period) so each product reports exactly one, deterministic cause.
 */
export function applyEligibilityGates(
  products: Product[],
  facts: Map<string, ProductFacts>,
  context: RoutineContext,
): EligibilityResult {
  const eligible: Product[] = [];
  const rejections: EligibilityRejection[] = [];
  const procedureFreezeRules = context.procedureRules.filter((rule) => rule.action === 'freeze');

  for (const product of products) {
    const f = facts.get(product.id);
    if (!f) continue; // no facts record — treat as absent from the shelf

    if (product.isHidden === true) {
      rejections.push({ productId: product.id, gate: 'hidden', reasonCode: 'product_hidden' });
      continue;
    }
    if (!f.eligible) {
      // facts.eligible folds hidden + PAO; hidden was handled above
      rejections.push({ productId: product.id, gate: 'pao_expired', reasonCode: 'pao_expired' });
      continue;
    }

    const freeze = findMatchingRule(product.productType, f, procedureFreezeRules);
    if (freeze) {
      rejections.push({
        productId: product.id,
        gate: 'clinical_freeze',
        reasonCode: freeze.reasonCode,
        until: freeze.untilDate,
      });
      continue;
    }

    // pregnancy_freeze runs right after clinical_freeze (tech design FE-5):
    // same structural non-overridability — a rejection here never reaches
    // selectSkeleton's reserve/userOverrides pool.
    const pregnancyFreeze = findMatchingRule(product.productType, f, context.pregnancyRules);
    if (pregnancyFreeze) {
      rejections.push({
        productId: product.id,
        gate: 'pregnancy_freeze',
        reasonCode: pregnancyFreeze.reasonCode,
      });
      continue;
    }

    if (periodsForProduct(product.productType, f).length === 0) {
      rejections.push({
        productId: product.id,
        gate: 'no_allowed_period',
        reasonCode: 'no_allowed_period',
      });
      continue;
    }

    eligible.push(product);
  }

  return { eligible, rejections };
}
