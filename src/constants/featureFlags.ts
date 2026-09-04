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

/**
 * Acting-on-pregnancy behavior: excludes retinoid-class products from
 * generated routines / the Today screen, and surfaces a pregnancy-specific
 * advisory in AddProcedureModal. `UserProfile.pregnantOrBreastfeeding`
 * itself (schema v6) is always collected and stored — this flag gates only
 * whether anything ACTS on it.
 *
 * **ON.** Clinical sign-off on the draft retinoid-freeze class list and
 * procedure-severity map (src/constants/rulesets/pregnancy.ts,
 * PREGNANCY_PROCEDURE_SEVERITY in conflictRulesDb.ts) has been obtained
 * (2026-07-30, docs/specs/pregnancy-safety-handling.md §10). The
 * pin-survival gap in the non-overridable guarantee (buildStepsFromPlan
 * previously keying off `until` instead of `overridesPin`, tech-lead Point C
 * on 2026-07-29) was closed first, as a prerequisite — see
 * docs/specs/pregnancy-pin-survival-fix.md, tech-lead ACCEPT 2026-07-30.
 */
export const PREGNANCY_SAFETY_ENABLED = true;

/**
 * "Stored locally on this device" InlineAlert in Profile → Your Data,
 * warning that Vials doesn't sync to the cloud and prompting a manual
 * export.
 *
 * **OFF.** Parked mid-iteration on the local-storage/export messaging —
 * revisit before re-enabling. Export All Data itself is unaffected.
 */
export const LOCAL_STORAGE_NOTICE_ENABLED = false;

/**
 * Explore Composition flow (docs/specs/explore-composition.md) — the
 * ingredient-only capture -> result -> Wishlist/Shelf path, and its
 * `WishlistEntry` rendering inside the Catalog "Wishlist · N" tab.
 *
 * **ON** (2026-08-27, product decision after real-device testing across all
 * four slices). Of spec §10's two open questions, the entry-card subtitle
 * copy is resolved (no longer a placeholder); how `WishlistEntry` rows
 * should visually relate to the pre-existing wishlist-status products tab
 * (tech design Assumption 5) is still genuinely open, but accepted as a
 * non-blocking cosmetic follow-up rather than a reason to keep the whole
 * flow off — the shipped default (a distinct, separately-labeled section
 * within the same tab) stands until product/design revisit it. Flip off
 * only if a real problem surfaces with that default, not by default.
 */
export const EXPLORE_COMPOSITION_ENABLED = true;
