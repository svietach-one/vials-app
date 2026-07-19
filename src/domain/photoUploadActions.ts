import { drain, noopTransport, type PhotoUploadTransport } from '@/services/photoUploadQueue';

/**
 * Photo-upload domain action (img-01). Owns the drain cadence so screens and
 * App root never touch the queue directly. The transport is a no-op stub until
 * img-04 swaps in the real Supabase transport (behind an env flag) via
 * {@link activeTransport}.
 */

const THROTTLE_MS = 15 * 60 * 1000; // at most one drain per 15 minutes

let lastDrainAt = 0;

/**
 * The upload transport in force. img-04 replaces the noop with a real
 * transport (or keeps the noop when server env vars are absent).
 */
function activeTransport(): PhotoUploadTransport {
  return noopTransport;
}

/**
 * Drains the photo upload queue at most once per 15 minutes. Safe to call on
 * every app foreground; fire-and-forget and never throws. `now` is injectable
 * for tests.
 */
export async function drainPhotoUploadsIfDue(now: number = Date.now()): Promise<void> {
  if (now - lastDrainAt < THROTTLE_MS) return;
  lastDrainAt = now;
  try {
    await drain(activeTransport());
  } catch {
    // drain is already silent; guard against any transport surprises.
  }
}
