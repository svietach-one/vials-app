import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Product photo capture + local persistence. Filesystem/native access lives
 * here in the service layer (utils stay pure).
 *
 * One copy is kept on disk: a DISPLAY copy (800px / JPEG 0.7) rendered on
 * cards — the value stored as `product.localImageUri`.
 *
 * A second, larger render is produced *on demand* for a community
 * contribution ({@link renderContributionBlob}) and never written to disk —
 * it goes straight into the contributions database as a BLOB.
 *
 * Nothing here ever throws to the caller: capture returns `null` on
 * cancel/permission-denied, deletion is best-effort.
 */

// ── Directories (under the document dir — safe from OS cache eviction) ────────
const DISPLAY_DIR = 'product-images';

// ── Render targets ───────────────────────────────────────────────────────────
const DISPLAY_MAX_EDGE = 800;
const DISPLAY_QUALITY = 0.7;
/** Contribution blob: legible enough to verify packaging during SQL review. */
const CONTRIBUTION_MAX_EDGE = 1200;
const CONTRIBUTION_QUALITY = 0.7;

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

  const displayTmp = await renderResized(
    sourceUri,
    width,
    height,
    DISPLAY_MAX_EDGE,
    DISPLAY_QUALITY,
  );

  return { localImageUri: persist(displayDir, productId, displayTmp) };
}

/**
 * Renders a product photo into bytes for the contributions BLOB column.
 *
 * PRIVACY — load-bearing: the bytes always come from the image-manipulator
 * re-encode, never from the raw camera/picker file. `saveAsync` drops ALL EXIF
 * during re-encoding, so GPS coordinates and device metadata cannot ride along
 * in the blob. This is what keeps the contribution anonymous (PRD architecture
 * constraint); do not "optimize" this by reading the original file instead.
 *
 * Returns null when there is no photo or the render fails — the caller then
 * submits a text-only contribution rather than failing the whole submission.
 */
export async function renderContributionBlob(
  localImageUri: string | null | undefined,
): Promise<Uint8Array | null> {
  if (!localImageUri) return null;
  try {
    const tmpUri = await renderResized(
      localImageUri,
      0,
      0,
      CONTRIBUTION_MAX_EDGE,
      CONTRIBUTION_QUALITY,
    );
    return await new File(tmpUri).bytes();
  } catch {
    return null;
  }
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

/** Best-effort removal of the stored photo. Never throws. */
export async function deleteProductPhoto(productId: string): Promise<void> {
  try {
    const file = new File(new Directory(Paths.document, DISPLAY_DIR), `${productId}.jpg`);
    if (file.exists) file.delete();
  } catch {
    // Missing/unreadable file — nothing to clean up.
  }
}
