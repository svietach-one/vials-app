import { File } from 'expo-file-system';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import type { PhotoUploadQueueEntry } from '@/types';

/**
 * Persistent queue of product photos waiting to be uploaded to the community
 * server (img-01 scaffolding; img-04 provides the real transport). Lives in
 * its own AsyncStorage key so a retry/attempt bump never rewrites the product
 * list. Every operation is best-effort and silent — a failed upload is not a
 * user-facing error.
 */

/**
 * Uploads a single pending photo. Implemented by img-04's Supabase transport;
 * until then {@link noopTransport} is wired so {@link drain} is a no-op.
 */
export interface PhotoUploadTransport {
  upload(entry: PhotoUploadQueueEntry): Promise<{ remoteUrl: string }>;
}

/**
 * Stub transport used until img-04. Always fails softly, so `drain` bumps the
 * attempt count and leaves every entry (and its file) intact.
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

/**
 * Attempts every queued upload once via `transport`. On success the entry is
 * dropped and its pending file deleted; on failure the attempt count is bumped
 * and the entry retained. Errors are never surfaced to the user.
 */
export async function drain(transport: PhotoUploadTransport): Promise<void> {
  const entries = await getAll();
  if (entries.length === 0) return;

  const remaining: PhotoUploadQueueEntry[] = [];
  for (const entry of entries) {
    try {
      await transport.upload(entry);
      deletePendingFile(entry.filePath);
    } catch {
      remaining.push({
        ...entry,
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
      });
    }
  }
  await saveAll(remaining);
}
