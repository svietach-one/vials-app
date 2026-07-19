import { getContributionsDb } from '@/services/contributionsDb';
import type { SuggestPayload } from '@/types';
import { generateId } from '@/utils/generateId';

/**
 * Community product contribution (US-3, MVP scope).
 *
 * Writes one row straight into the `contributions` Turso database — no API
 * server, no object storage. The photo travels as a BLOB in the same row.
 * Moderation is manual: a human reviews `status = 'pending_review'` rows over
 * direct SQL and promotes approved ones into the corpus.
 *
 * The write is **awaited** and its outcome is returned. Nothing here is
 * fire-and-forget, because the whole point is that what the user is told
 * matches what actually happened.
 */

/** Schema revision of the row shape written below. */
export const CONTRIBUTION_SCHEMA_VERSION = 1;

export type ContributionResult =
  /** Row committed. `withPhoto` distinguishes a full from a text-only record. */
  | { status: 'success'; withPhoto: boolean }
  /**
   * No contributions connection in this build — the libSQL native module is
   * absent (Expo Go / bundled-corpus builds) or the env vars are unset.
   * NOT a failure: retrying cannot help, so the UI must say so distinctly.
   */
  | { status: 'unavailable' }
  /** The write was attempted and failed. Retryable by the user, by hand. */
  | { status: 'error'; message: string };

const INSERT_SQL = `
  INSERT INTO contributions
    (id, brand, name, product_type, inci_raw, photo_blob, status, created_at, schema_version)
  VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)
`;

/**
 * Submits one product suggestion.
 *
 * ANONYMITY (PRD architecture constraint): the bound parameters below are the
 * complete payload — product metadata only. No profile fields, no device or
 * install identifier, no timestamps tied to a session. `id` is a fresh local
 * UUID for the row itself, not a user handle. Photo bytes are EXIF-stripped
 * upstream by the image manipulator (see renderContributionBlob). Do not add a
 * field here without re-checking that rule.
 */
export async function submitContribution(
  payload: SuggestPayload,
  photoBlob: Uint8Array | null,
): Promise<ContributionResult> {
  const db = await getContributionsDb();
  if (!db) return { status: 'unavailable' };

  try {
    await db.runAsync(INSERT_SQL, [
      generateId(),
      payload.brand,
      payload.name,
      payload.productType,
      payload.inciRaw,
      photoBlob,
      new Date().toISOString(),
      CONTRIBUTION_SCHEMA_VERSION,
    ]);
    return { status: 'success', withPhoto: photoBlob !== null };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Could not share this product.',
    };
  }
}
