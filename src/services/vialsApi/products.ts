import { COMMUNITY_CONTRIBUTION_ENABLED } from '@/constants/featureFlags';
import type { AddProductDraft, SuggestPayload } from '@/types';
import { buildSuggestPayload } from '@/utils/productForm/saveProduct';

/**
 * Vials community API — background product suggestions.
 * (lookupBarcode / searchByText arrive with the community-DB feature; only
 * the suggest surface exists in this scope.)
 */

const BASE_URL = process.env.EXPO_PUBLIC_VIALS_API_URL ?? null;

/** POST /api/v1/products/suggest — community contribution, status 'pending'. */
export async function suggestProduct(payload: SuggestPayload): Promise<void> {
  if (BASE_URL === null) {
    // Backend not configured in this environment — the contribution is
    // optional infrastructure, so skip silently (same UX as a network error).
    return;
  }
  const response = await fetch(`${BASE_URL}/api/v1/products/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`suggestProduct failed: HTTP ${response.status}`);
  }
}

/**
 * Fire-and-forget background suggest. Never await this from a UI path —
 * the local save IS the save; this never gates or blocks any UI state.
 * Errors are the caller's to swallow (catch + console.warn, never surfaced
 * to the user — per db-tech-design.md §5.3).
 */
export async function suggestProductInBackground(draft: AddProductDraft): Promise<void> {
  // Hard stop while community contribution is disabled: the endpoint this
  // targets does not exist (PRD §4.3), so firing it would only ever produce a
  // swallowed failure behind UI that claimed success. See featureFlags.ts.
  if (!COMMUNITY_CONTRIBUTION_ENABLED) return;
  await suggestProduct(buildSuggestPayload(draft));
}
