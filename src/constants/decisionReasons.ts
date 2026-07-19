/**
 * Closed vocabulary of routine-engine decision reason codes and their
 * user-facing English text (V2.1 phase-07).
 *
 * This is the single source of truth for "why is this product not in my
 * routine / why is it capped". Two invariants, both machine-checked:
 *   1. `REASON_TEXT satisfies Record<DecisionReasonCode, string>` — a code
 *      without dictionary text is a COMPILE error.
 *   2. `rulesetIntegrity.test.ts` asserts every reasonCode authored in the
 *      ruleset JSON and every reasonCode emitted by engine code is a member of
 *      this union (no orphans in either direction).
 *
 * Reason codes are DECOUPLED from pair-rule ids (§4.4 ruling): a rule's `id`
 * is renameable provenance carried as `ruleId`; its `reasonCode` is a stable
 * member of this union. `rule_*` ids must never appear here.
 *
 * `pregnancy_blocked` is intentionally absent — deferred with Phase 3 §4.3.
 */

/** Reason codes authored in the ruleset JSON (procedures / seasons / actives). */
export type RulesetReasonCode =
  // pair-rule conflicts (actives.json pairRules)
  | 'retinoid_acid_conflict'
  | 'benzoyl_retinoid_conflict'
  | 'copper_peptide_acid_conflict'
  | 'vitamin_c_acid_conflict'
  | 'vitamin_c_copper_conflict'
  | 'vitamin_c_benzoyl_conflict'
  // phototype modifiers
  | 'phototype_pih_risk'
  | 'phototype_pih_exfoliant_cap'
  | 'phototype_uv_sensitivity_spf'
  // base + seasonal mandates / limits
  | 'spf_required_photosensitizing'
  | 'spf_required_goal'
  | 'summer_photosensitizer_spf'
  | 'summer_uv_exfoliant_limit'
  | 'winter_barrier_repair'
  // clinical procedure rules
  | 'botox_no_massage'
  | 'fillers_no_massage'
  | 'smas_no_massage'
  | 'smas_rehab_no_exfoliants'
  | 'meso_rehab_no_exfoliants'
  | 'meso_rehab_no_aggressive_actives'
  | 'meso_spf_mandatory'
  | 'peel_rehab_no_exfoliants'
  | 'peel_rehab_no_aggressive_actives'
  | 'peel_sos_recovery'
  | 'peel_spf_mandatory'
  | 'facial_recovery'
  | 'facial_rehab_no_exfoliants'
  | 'custom_rehab_recovery'
  | 'custom_rehab_conservative'
  | 'custom_rehab_spf';

/** Reason codes emitted by engine code (not authored in JSON). */
export type EngineReasonCode =
  // eligibility gates
  | 'product_hidden'
  | 'pao_expired'
  | 'no_allowed_period'
  // skeleton selection (phase-04)
  | 'not_needed_for_goals'
  | 'duplicate_function'
  | 'cumulative_active_cap'
  | 'moisturizer_recommended'
  | 'pre_cleanse_requires_followup'
  | 'rinse_off_active_note'
  | 'exfoliant_treatment_cap'
  | 'reclassified_treatment_cap'
  // goal model (phase-03)
  | 'barrier_repair_excludes_irritants'
  // admission ladder
  | 'relocation_rejected'
  // adaptation (phase-05)
  | 'adaptation_phase_1'
  | 'adaptation_phase_2'
  | 'adaptation_phase_3'
  // dynamic cycling (phase-06)
  | 'dynamic_unavailable_no_actives';

export type DecisionReasonCode = RulesetReasonCode | EngineReasonCode;

/**
 * Human-readable English text per reason code (CLAUDE.md: English-only).
 * `satisfies` makes a missing entry a compile error and forbids stray keys.
 */
export const REASON_TEXT = {
  // ── pair-rule conflicts ──────────────────────────────────────────────────
  retinoid_acid_conflict: 'Retinoids and exfoliating acids irritate together — kept apart.',
  benzoyl_retinoid_conflict: 'Benzoyl peroxide deactivates retinoids — kept apart.',
  copper_peptide_acid_conflict: 'Acids break down copper peptides — kept apart.',
  vitamin_c_acid_conflict: 'Layering pure vitamin C with acids over-lowers pH — kept apart.',
  vitamin_c_copper_conflict: 'Pure vitamin C oxidises copper peptides — kept apart.',
  vitamin_c_benzoyl_conflict: 'Benzoyl peroxide degrades vitamin C — kept apart.',
  // ── phototype ────────────────────────────────────────────────────────────
  phototype_pih_risk: 'Higher pigmentation risk for your skin tone — this pair is treated more cautiously.',
  phototype_pih_exfoliant_cap: 'Exfoliation limited to protect against dark marks on your skin tone.',
  phototype_uv_sensitivity_spf: 'Your skin tone needs daily SPF alongside this active.',
  // ── mandates / limits ────────────────────────────────────────────────────
  spf_required_photosensitizing: 'This routine has a sun-sensitising active — add a morning SPF.',
  spf_required_goal: 'Your pigmentation goal needs daily SPF to work — add a morning SPF.',
  summer_photosensitizer_spf: 'Summer UV plus a sun-sensitising active — a morning SPF is required.',
  summer_uv_exfoliant_limit: 'Exfoliation is limited in summer to reduce UV damage.',
  winter_barrier_repair: 'Winter air is drying — barrier-repair steps are prioritised.',
  // ── clinical procedures ──────────────────────────────────────────────────
  botox_no_massage: 'No facial massage while your Botox settles.',
  fillers_no_massage: 'No facial massage while your fillers settle.',
  smas_no_massage: 'No facial massage during SMAS-lift recovery.',
  smas_rehab_no_exfoliants: 'No exfoliants during SMAS-lift recovery.',
  meso_rehab_no_exfoliants: 'No exfoliants while your mesotherapy heals.',
  meso_rehab_no_aggressive_actives: 'No strong actives while your mesotherapy heals.',
  meso_spf_mandatory: 'Daily SPF is required after mesotherapy.',
  peel_rehab_no_exfoliants: 'No exfoliants while your peel heals.',
  peel_rehab_no_aggressive_actives: 'No strong actives while your peel heals.',
  peel_sos_recovery: 'Barrier-recovery steps are prioritised after your peel.',
  peel_spf_mandatory: 'Daily SPF is required after a peel.',
  facial_recovery: 'Gentle care is prioritised while your facial settles.',
  facial_rehab_no_exfoliants: 'No exfoliants right after a mechanical facial.',
  custom_rehab_recovery: 'Gentle care is prioritised during your recovery window.',
  custom_rehab_conservative: 'Strong actives are paused during your recovery window.',
  custom_rehab_spf: 'Daily SPF is required during your recovery window.',
  // ── eligibility ──────────────────────────────────────────────────────────
  product_hidden: 'You hid this product.',
  pao_expired: 'Past its opened-shelf-life — replace it before using.',
  no_allowed_period: 'This product has no valid morning or evening slot.',
  // ── skeleton selection ───────────────────────────────────────────────────
  not_needed_for_goals: 'Your current goals don’t call for this product — kept in reserve.',
  duplicate_function: 'Another product already covers this role — kept in reserve.',
  cumulative_active_cap: 'One strong active per evening is enough — kept in reserve.',
  moisturizer_recommended: 'Add a plain moisturiser to finish this routine.',
  pre_cleanse_requires_followup:
    'Micellar water and cleansing oils/balms don’t rinse clean — add a gentle rinse-off cleanser after this step.',
  rinse_off_active_note: 'Heads-up: your cleanser also contains an active (it rinses off, so it’s fine).',
  exfoliant_treatment_cap: 'Exfoliating treatments are limited to two nights a week.',
  reclassified_treatment_cap: 'This leave-on active is treated as a treatment, not a daily step.',
  // ── goal model ───────────────────────────────────────────────────────────
  barrier_repair_excludes_irritants: 'Repairing your barrier first — strong actives are paused.',
  // ── admission ────────────────────────────────────────────────────────────
  relocation_rejected: 'No conflict-free time of day for this product — kept in reserve.',
  // ── adaptation ───────────────────────────────────────────────────────────
  adaptation_phase_1: 'Easing in — twice a week while your skin adjusts.',
  adaptation_phase_2: 'Building up — every other night as your skin adapts.',
  adaptation_phase_3: 'Fully adapted — no frequency limit.',
  // ── dynamic cycling ──────────────────────────────────────────────────────
  dynamic_unavailable_no_actives: 'Add an exfoliant or retinoid to use skin cycling, or switch to fixed days.',
} satisfies Record<DecisionReasonCode, string>;

/**
 * Reason text for a code. Defensive: an unknown code (e.g. a future one not
 * yet in the dictionary) yields a generic line rather than throwing — the
 * integrity test is the real guard against orphans.
 */
export function reasonText(code: string): string {
  return (REASON_TEXT as Record<string, string>)[code] ?? 'Adjusted to keep your routine safe.';
}
