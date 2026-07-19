import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { enqueue, remove as removeFromQueue } from '@/services/photoUploadQueue';
import type { PhotoUploadQueueEntry } from '@/types';

/**
 * Product photo capture + local persistence (img-01). Filesystem/native access
 * lives here in the service layer (utils stay pure). Two copies are produced
 * from every picked image:
 *
 *  - a small DISPLAY copy (800px / JPEG 0.7) rendered on cards — the value
 *    stored as `product.localImageUri`;
 *  - a larger UPLOAD copy (1600px / JPEG 0.8) queued for the community server
 *    (img-04). Deleted only after a successful upload or product deletion.
 *
 * Nothing here ever throws to the caller: capture returns `null` on
 * cancel/permission-denied, deletion is best-effort.
 */

// ── Directories (under the document dir — safe from OS cache eviction) ────────
const DISPLAY_DIR = 'product-images';
const UPLOAD_DIR = 'pending-uploads';

// ── Render targets (img-01 locked decisions) ─────────────────────────────────
const DISPLAY_MAX_EDGE = 800;
const DISPLAY_QUALITY = 0.7;
const UPLOAD_MAX_EDGE = 1600;
const UPLOAD_QUALITY = 0.8;

export type PhotoSource = 'camera' | 'library';

// ── Filesystem helpers (new File/Directory/Paths API — not /legacy) ───────────

function ensureDir(name: string): Directory {
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * Constrains the longer edge to `maxEdge` without upscaling. When the source
 * dimensions are unknown (0), falls back to constraining width only.
 */
function resizeTarget(
  width: number,
  height: number,
  maxEdge: number,
): { width?: number; height?: number } {
  if (!width || !height) return { width: maxEdge };
  if (width >= height) return { width: Math.min(maxEdge, width) };
  return { height: Math.min(maxEdge, height) };
}

/** Resizes + JPEG-compresses `sourceUri`, returning a temp cache-file URI. */
async function renderResized(
  sourceUri: string,
  width: number,
  height: number,
  maxEdge: number,
  quality: number,
): Promise<string> {
  const ref = await ImageManipulator.manipulate(sourceUri)
    .resize(resizeTarget(width, height, maxEdge))
    .renderAsync();
  const result = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return result.uri;
}

/** Moves a freshly rendered temp file into `dir` as `<productId>.jpg`. */
function persist(dir: Directory, productId: string, tmpUri: string): string {
  const dest = new File(dir, `${productId}.jpg`);
  if (dest.exists) dest.delete();
  new File(tmpUri).copy(dest);
  return dest.uri;
}

// ── Shared resize → copy → enqueue core ───────────────────────────────────────

async function storeFromUri(
  productId: string,
  sourceUri: string,
  width: number,
  height: number,
): Promise<{ localImageUri: string }> {
  const displayDir = ensureDir(DISPLAY_DIR);
  const uploadDir = ensureDir(UPLOAD_DIR);

  const displayTmp = await renderResized(
    sourceUri,
    width,
    height,
    DISPLAY_MAX_EDGE,
    DISPLAY_QUALITY,
  );
  const localImageUri = persist(displayDir, productId, displayTmp);

  const uploadTmp = await renderResized(
    sourceUri,
    width,
    height,
    UPLOAD_MAX_EDGE,
    UPLOAD_QUALITY,
  );
  const uploadUri = persist(uploadDir, productId, uploadTmp);

  const entry: PhotoUploadQueueEntry = {
    productId,
    filePath: uploadUri,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await enqueue(entry);

  return { localImageUri };
}

// ── Picker (mirrors CameraCaptureModal's permission + Alert pattern) ──────────

async function launchPicker(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Camera Access Needed',
        'Enable camera access in Settings to take a product photo.',
      );
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return null;
    return result.assets[0] ?? null;
  }

  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    Alert.alert(
      'Photo Access Needed',
      'Enable photo library access in Settings > Vials to choose a product photo.',
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Prompts for a photo (camera or gallery), produces both copies, enqueues the
 * upload, and returns the display URI. Returns `null` on cancel or denied
 * permission — never throws.
 */
export async function pickAndStoreProductPhoto(
  productId: string,
  source: PhotoSource,
): Promise<{ localImageUri: string } | null> {
  try {
    const asset = await launchPicker(source);
    if (!asset) return null;
    return await storeFromUri(productId, asset.uri, asset.width, asset.height);
  } catch {
    return null;
  }
}

/**
 * Runs the same resize → copy → enqueue pipeline on an already-captured image
 * URI (e.g. the OCR shot reused as the product photo in img-02). Source
 * dimensions are unknown here, so the longer edge is constrained by width.
 */
export async function storeExistingPhotoAsProductPhoto(
  productId: string,
  sourceUri: string,
): Promise<{ localImageUri: string } | null> {
  try {
    return await storeFromUri(productId, sourceUri, 0, 0);
  } catch {
    return null;
  }
}

/** Best-effort removal of both copies + the queue entry. Never throws. */
export async function deleteProductPhoto(productId: string): Promise<void> {
  for (const dirName of [DISPLAY_DIR, UPLOAD_DIR]) {
    try {
      const file = new File(new Directory(Paths.document, dirName), `${productId}.jpg`);
      if (file.exists) file.delete();
    } catch {
      // Missing/unreadable file — nothing to clean up.
    }
  }
  await removeFromQueue(productId);
}
