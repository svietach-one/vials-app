import type { PregnancyRule } from '@/constants/rulesets/rulesetTypes';
import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';

/**
 * Pregnancy / breastfeeding freeze rules (pregnancy-safety-handling spec §3,
 * tech design FE-2; extended per engine4.1 handoff §4). Draft data, pending
 * clinical sign-off — see spec §10. Held here rather than in actives.json so
 * enabling it after sign-off is a flag flip plus this file staying as-is, not
 * a re-derivation.
 *
 * Two rules, both freezing while `profile.pregnantOrBreastfeeding` is true:
 * retinoid-class products, and hydroquinone. Both are the ACOG/AAD-consensus
 * high-agreement tier (engine4.1 handoff §4, evidence base in
 * `GOAL_COVERAGE_AND_PREGNANCY_SAFETY.md` §4); this is also what makes the
 * shipped `PREGNANCY_HINT` copy ("retinoids and other restricted actives",
 * `src/constants/labels.ts`) honest rather than an overpromise.
 *
 * Explicitly reviewed and deliberately NOT included (spec §3 non-goals — not
 * silent omissions):
 *  - AHA/BHA/benzoyl_peroxide/salicylic acid: guidance is concentration-
 *    dependent and mixed, and the engine cannot read concentration. A
 *    potency-gated freeze is not mechanically expressible today —
 *    `RuleTargets` has no potency condition, only
 *    `PairRule.exceptions.whenPotencyAtMost`, which is pair-rule-specific
 *    machinery, not available to single-sided freeze targets. Flagged as a
 *    follow-up, not built here — do not hard-freeze a whole class the app
 *    can't dose-distinguish without explicit reviewer sign-off.
 */
export const PREGNANCY_RULESET: { rules: PregnancyRule[] } = {
  rules: [
    {
      id: 'pregnancy_retinoid_freeze',
      then: { action: 'freeze', targets: { classes: ['retinoid'] } },
      reasonCode: 'pregnancy_blocked',
    },
    {
      id: 'pregnancy_hydroquinone_freeze',
      then: { action: 'freeze', targets: { classes: ['hydroquinone'] } },
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
