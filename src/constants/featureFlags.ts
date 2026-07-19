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
