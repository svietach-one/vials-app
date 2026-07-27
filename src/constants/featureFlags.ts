/**
 * Build-time feature flags. Each flag must document why it is set as it is and
 * what has to be true to change it.
 */

/**
 * Community contribution (US-3): submitting locally-added products to a shared
 * database so other users benefit.
 *
 * **ON.** Contributions are written directly to the `vials-contributions`
 * Turso database (`src/services/contributions.ts`) — no API server, no object
 * storage. Moderation is manual SQL against that database. This resolved
 * BLOCKER-2, which had this flag off because there was nowhere to submit to.
 *
 * Being on does NOT mean a submission always succeeds: the write is awaited
 * and reports `success` / `unavailable` / `error` honestly. In builds without
 * the libSQL native module (Expo Go, bundled-corpus) the result is
 * `unavailable`, and the UI says so rather than faking success — the failure
 * mode that made this flag necessary in the first place.
 */
export const COMMUNITY_CONTRIBUTION_ENABLED = true;

/**
 * Clinic "Still seeing results?" fading prompt — the in-card Still visible /
 * Mostly faded buttons on a fading ProcedureLifespanCard.
 *
 * **OFF.** Parked pending a product decision: effect feedback will likely be
 * requested at "Move to history" time (or reworked) rather than mid-lifespan.
 * With this off the fading card still shows its bar, time label, and
 * "Repeat around" footer — only the interactive prompt is hidden. Flip back on
 * (or delete the flag) once the feedback flow is settled.
 */
export const CLINIC_FADING_PROMPT_ENABLED = false;

/**
 * Barcode scan tile inside the Add Product flow — the "Scan barcode" tile on
 * step 2 (BarcodeSection).
 *
 * **ON.** Barcode capture is offered only while actually adding a product, next
 * to the field it fills. Manual entry and corpus search remain available
 * alongside it. The BarcodeScanner screen stays registered in the navigator, so
 * this is a pure UI gate.
 */
export const BARCODE_SCANNER_ENABLED = true;

/**
 * Standalone "Scan Barcode" entry row on the Add Product hub (the previous
 * screen) → BarcodeScanner screen.
 *
 * **OFF.** Per product request, barcode scanning lives only inside the add-a-
 * product step (see BARCODE_SCANNER_ENABLED), not as a top-level hub shortcut.
 * Separate from the step-2 gate so the two can move independently.
 */
export const BARCODE_HUB_ENTRY_ENABLED = false;

/**
 * The four "proposed" v1.2 collision rows from PRD §5.2 that are NOT in
 * production: `benzoyl_peroxide` + acids, `benzoyl_peroxide` + copper
 * peptides, `azelaic_acid` + acids, and pure-vitamin-C + benzoyl peroxide.
 * (`benzoyl_peroxide` + retinoid and vitamin-C-derivative + benzoyl peroxide
 * already shipped in actives.json long before v1.2 and are untouched by this
 * flag.)
 *
 * **OFF.** These rows are a research proposal sourced at the same confidence
 * level already judged insufficient for the §5.3 procedure-spacing table, and
 * PRD §6 routes them through one combined clinical sign-off pass. BPO/AZA tag
 * DETECTION ships regardless — the single-ingredient condition-risk checks in
 * skinConditionModifiers.ts and the density tiers in activeIngredientDensity.ts
 * both use those tags today.
 *
 * Flip to true once sign-off lands: the pairs are declared in
 * PROPOSED_V12_PAIR_RULES (src/constants/rulesets/proposedPairRules.ts) ready
 * to append to the effective ruleset, so this is a one-line change, not a
 * re-implementation.
 */
export const PROPOSED_V12_PAIR_RULES_ENABLED = false;
