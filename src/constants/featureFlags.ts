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
 * Barcode scanning entry point on the Add Product hub (the "Scan Barcode" row
 * → BarcodeScanner screen).
 *
 * **OFF.** Hidden while barcode lookup is unreliable. Manual entry and corpus
 * search remain the supported add paths. Flip on once the scan/lookup path is
 * solid; the BarcodeScanner screen stays registered in the navigator so this is
 * a pure UI gate.
 */
export const BARCODE_SCANNER_ENABLED = false;
