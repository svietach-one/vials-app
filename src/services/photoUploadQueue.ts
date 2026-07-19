import { File } from 'expo-file-system';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import type { PhotoUploadQueueEntry } from '@/types';

/**
 * Persistent queue of product photos waiting to be uploaded to the community
 * server. Lives in its own AsyncStorage key so a retry/attempt bump never
 * rewrites the product list. Every operation is best-effort and silent — a
 * failed upload is not a user-facing error.
 *
 * NO TRANSPORT SHIPS TODAY. Contributed photos have no server destination:
 * the Turso corpus is a pull-only read-only replica the app can never write
 * to, and the stack has no object storage at all. {@link noopTransport} stays
 * wired until an upload endpoint exists — see
 * docs/tasks/product-images/BLOCKERS.md. The transport seam is deliberately
 * backend-agnostic so whichever design lands (API-owned upload or presigned
 * PUT) plugs in here without touching the queue.
 */

/** Uploads a single pending photo and returns where it landed. */
export interface PhotoUploadTransport {
  upload(entry: PhotoUploadQueueEntry): Promise<{ remoteUrl: string }>;
}

/**
 * The only transport that ships today. Always fails softly, so `drain` bumps
 * the attempt count and leaves every entry (and its file) intact.
 */
export const noopTransport: PhotoUploadTransport = {
  async upload() {
    throw new Error('noopTransport: photo upload not configured');
  },
};

export async function getAll(): Promise<PhotoUploadQueueEntry[]> {
  return loadJson<PhotoUploadQueueEntry[]>(STORAGE_KEYS.photoUploadQueue, []);
}

async function saveAll(entries: PhotoUploadQueueEntry[]): Promise<void> {
  await saveJson(STORAGE_KEYS.photoUploadQueue, entries);
}

/**
 * Adds (or replaces) the pending upload for a product. Re-attaching a photo
 * supersedes the previous pending entry — one upload per product.
 */
export async function enqueue(entry: PhotoUploadQueueEntry): Promise<void> {
  const entries = await getAll();
  const next = entries.filter((e) => e.productId !== entry.productId);
  next.push(entry);
  await saveAll(next);
}

export async function remove(productId: string): Promise<void> {
  const entries = await getAll();
  const next = entries.filter((e) => e.productId !== productId);
  if (next.length !== entries.length) await saveAll(next);
}

/** Best-effort delete of a pending-upload file; never throws. */
function deletePendingFile(filePath: string): void {
  try {
    const file = new File(filePath);
    if (file.exists) file.delete();
  } catch {
    // File already gone or unreadable — nothing to clean up.
  }
}

/** Give up automatic retries after this many failed attempts. */
export const MAX_UPLOAD_ATTEMPTS = 5;
/** Pending files are cleaned up once they reach this age. */
export const PENDING_FILE_TTL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function isExpired(entry: PhotoUploadQueueEntry, now: number): boolean {
  const created = Date.parse(entry.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created >= PENDING_FILE_TTL_DAYS * DAY_MS;
}

/**
 * Runs the queue once against `transport`. A successful upload completes the
 * entry: its pending file is deleted and it leaves the queue.
 *
 * Retry policy: after {@link MAX_UPLOAD_ATTEMPTS} failures the entry is marked
 * `failed` and skipped by later drains. Every entry (failed or not) is cleaned
 * up once it reaches {@link PENDING_FILE_TTL_DAYS} — its file is deleted and
 * the entry dropped, since it can never complete without the file. All failures
 * stay silent.
 *
 * Deliberately single-step. An upload→link state machine was written and then
 * removed: with no linking endpoint in existence, a transport wired without a
 * link implementation would leave every entry uncleared and grow the queue
 * forever. Linking belongs here only once a real endpoint exists (BLOCKERS.md).
 */
export async function drain(
  transport: PhotoUploadTransport,
  now: number = Date.now(),
): Promise<void> {
  const entries = await getAll();
  if (entries.length === 0) return;

  const remaining: PhotoUploadQueueEntry[] = [];

  for (const entry of entries) {
    // Age-based cleanup runs first, and applies to failed entries too.
    if (isExpired(entry, now)) {
      deletePendingFile(entry.filePath);
      continue;
    }

    // Capped-out entries are retained (for diagnostics) but never retried.
    if (entry.failed) {
      remaining.push(entry);
      continue;
    }

    try {
      await transport.upload(entry);
      deletePendingFile(entry.filePath);
    } catch {
      const attempts = entry.attempts + 1;
      remaining.push({
        ...entry,
        attempts,
        lastAttemptAt: new Date(now).toISOString(),
        ...(attempts >= MAX_UPLOAD_ATTEMPTS ? { failed: true } : {}),
      });
    }
  }

  await saveAll(remaining);
}
