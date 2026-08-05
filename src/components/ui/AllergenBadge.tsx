import React from 'react';
import { StyleSheet } from 'react-native';

import { Badge } from '@/components/ui/feedback/Badge';
import type { DetectedAllergenMatch } from '@/types';
import { hasRestrictedAllergenMatch } from '@/utils/allergenDetector';

export interface AllergenBadgeProps {
  matches: DetectedAllergenMatch[];
}

/**
 * Thin wrapper around the shared `Badge` component (tech-design
 * vials-eu-allergen-detection.md FE-4) — a fixed 28x28 circle showing a
 * bold "A" glyph. Cobalt for an ordinary allergen match, Amber when any
 * matched entry is restricted (Story 2 AC1: a restricted match forces the
 * whole badge to Amber regardless of how many non-restricted entries also
 * matched — one badge, never two). Renders nothing at all — not an empty
 * or faded circle — when there are zero matches (Story 1 AC2/AC3).
 * Non-interactive: no press handler, no attribution tooltip (spec §5 —
 * allergen names match near-exactly, unlike active-ingredient regional
 * aliases, so there is no ambiguity to resolve here).
 */
export function AllergenBadge({ matches }: AllergenBadgeProps) {
  if (matches.length === 0) return null;

  const restricted = hasRestrictedAllergenMatch(matches);

  return (
    <Badge
      testID="allergen-badge"
      status={restricted ? 'Amber' : 'Cobalt'}
      type="Light"
      style={styles.circle}
      textStyle={styles.glyph}
      accessibilityLabel={
        restricted
          ? 'Contains an EU-regulated fragrance allergen no longer permitted in new EU products'
          : 'Contains an EU-regulated fragrance allergen'
      }
    >
      A
    </Badge>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Overrides Badge's default pill padding/alignment to a fixed circle —
  // matches RoutineStepCard.tsx's zap `activeBadge` size (28x28).
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'auto',
    flexShrink: 0,
  },
  glyph: {
    fontFamily: 'DMSans-Bold',
  },
});
