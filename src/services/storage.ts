import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BASELINE_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
} from '@/utils/routineEngine/migrations';

export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage write failed (quota, permissions). Data will be stale on next cold start.
    if (__DEV__) console.warn('[storage] saveJson failed for key:', key, e);
  }
}

export const STORAGE_KEYS = {
  profile: '@vials/profile',
  products: '@vials/products',
  routines: '@vials/routines',
  procedures: '@vials/procedures',
  settings: '@vials/settings',
  /** Persisted schema version driving one-time migrations on hydrate. */
  schemaVersion: '@vials/schemaVersion',
  /** Dynamic-cycling state + per-product application counters (FE-6). */
  tracking: '@vials/tracking',
  /**
   * Pending product-photo uploads (img-01). Kept OUT of productsStore so a
   * transient upload-retry state never rewrites the product list.
   */
  photoUploadQueue: '@vials/photoUploadQueue',
} as const;

/** Reads the persisted schema version, defaulting to the pre-versioning baseline. */
export async function loadSchemaVersion(): Promise<number> {
  return loadJson<number>(STORAGE_KEYS.schemaVersion, BASELINE_SCHEMA_VERSION);
}

/**
 * Persists the current schema version when the stored version is behind.
 * Writes a constant, so concurrent calls from parallel store hydrations
 * converge regardless of ordering.
 */
export function persistSchemaVersionIfBehind(storedVersion: number): void {
  if (storedVersion < CURRENT_SCHEMA_VERSION) {
    void saveJson(STORAGE_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
  }
}
