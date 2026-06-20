/** Generates a locally unique ID. Sufficient for local-only AsyncStorage; no server dedup needed. */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
