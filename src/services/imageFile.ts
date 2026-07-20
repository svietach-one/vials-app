import { File } from 'expo-file-system';

/**
 * Lightweight local-photo existence probe (img-02). Kept separate from
 * productImage.ts so UI (ProductThumbnail) can verify a `file://` URI without
 * pulling the picker / manipulator / upload-queue chain into a card render.
 * Best-effort and never throws.
 */
export async function localPhotoExists(uri: string): Promise<boolean> {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
