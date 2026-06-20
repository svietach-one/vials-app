import AsyncStorage from '@react-native-async-storage/async-storage';

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
} as const;
