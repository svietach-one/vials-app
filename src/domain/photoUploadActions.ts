import { drain, noopTransport, type PhotoUploadTransport } from '@/services/photoUploadQueue';

/**
 * Photo-upload domain action (img-01). Owns the drain cadence so screens and
 * App root never touch the queue directly.
 *
 * {@link activeTransport} returns the no-op stub and will keep doing so until
 * contributed photos have a server destination — the Turso corpus is a
 * pull-only read-only replica and the stack has no object storage. See
 * docs/tasks/product-images/BLOCKERS.md before wiring anything real here.
 */

const THROTTLE_MS = 15 * 60 * 1000; // at most one drain per 15 minutes

let lastDrainAt = 0;

/** The upload transport in force. No real transport exists yet (BLOCKERS.md). */
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
