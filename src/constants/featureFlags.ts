/**
 * Build-time feature flags. Each flag must document why it is off and what has
 * to be true before it flips.
 */

/**
 * Community contribution (US-3): submitting locally-added products back to a
 * shared database so other users benefit.
 *
 * **OFF — there is nothing to submit to.** `docs/PRD_Spec.md` (sync note
 * 2026-07-07) states plainly: "there is no such API", and §4.3 confirms the
 * `POST /api/v1/products/suggest` pipeline is "not built". With the flag off,
 * `suggestProductInBackground` does not fire and no UI claims a contribution
 * was made — previously the barcode section showed "Community contribution
 * saved" with a success check for a request that never left the device.
 *
 * Barcode scanning itself stays fully enabled: the code is stored on the local
 * product record and used for local lookup. Only the *community* claims are
 * gated.
 *
 * Flip to `true` only once a contribution endpoint actually exists — see
 * docs/tasks/product-images/BLOCKERS.md (BLOCKER-2).
 */
export const COMMUNITY_CONTRIBUTION_ENABLED = false;
