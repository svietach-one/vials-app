import type { PregnancyRule } from '@/constants/rulesets/rulesetTypes';
import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';

/**
 * Pregnancy / breastfeeding freeze rules (pregnancy-safety-handling spec §3,
 * tech design FE-2). Draft data, pending clinical sign-off — see spec §10.
 * Held here rather than in actives.json so enabling it after sign-off is a
 * flag flip plus this file staying as-is, not a re-derivation.
 *
 * One rule: retinoid-class products are frozen while
 * `profile.pregnantOrBreastfeeding` is true.
 *
 * Explicitly reviewed and deliberately NOT included (spec §3 non-goals — not
 * silent omissions):
 *  - AHA/BHA/benzoyl_peroxide: guidance is concentration-dependent and mixed.
 *    A potency-gated freeze is not mechanically expressible today —
 *    `RuleTargets` has no potency condition, only
 *    `PairRule.exceptions.whenPotencyAtMost`, which is pair-rule-specific
 *    machinery, not available to single-sided freeze targets. Flagged as a
 *    follow-up, not built here.
 *  - hydroquinone: not a class in actives.json's taxonomy at all — the engine
 *    cannot see it. A separate ticket, not implied as covered.
 */
export const PREGNANCY_RULESET: { rules: PregnancyRule[] } = {
  rules: [
    {
      id: 'pregnancy_retinoid_freeze',
      then: { action: 'freeze', targets: { classes: ['retinoid'] } },
      reasonCode: 'pregnancy_blocked',
    },
  ],
};

/**
 * The pregnancy rules to actually apply. Returns `[]` until
 * PREGNANCY_SAFETY_ENABLED flips true — mirrors
 * proposedPairRules.ts's getProposedPairRules self-gating so nothing
 * downstream needs its own flag check.
 */
export function getPregnancyRules(): readonly PregnancyRule[] {
  return PREGNANCY_SAFETY_ENABLED ? PREGNANCY_RULESET.rules : [];
}
