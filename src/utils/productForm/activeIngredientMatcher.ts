import type { ActiveIngredientKey } from '../../types';
import { parseActiveIngredientsFromInci } from '../ingredientParser';

/**
 * Delegates to the canonical ruleset-driven parser (actives.json) rather
 * than keeping a second flat lookup table, so there is exactly one
 * client-side INCI matching implementation. The ruleset's negativePatterns
 * already resolve derivative-vs-parent collisions ("ethyl ascorbic acid"
 * must not also match "ascorbic acid").
 *
 * Deterministic string/regex matching only — no AI, no network. Non-Latin
 * or translated ingredient text simply returns [] by design; the pre-scan
 * notice (task 05) exists so users scan the original Latin INCI list.
 */
export function parseInciText(rawText: string): ActiveIngredientKey[] {
  return parseActiveIngredientsFromInci(rawText);
}
