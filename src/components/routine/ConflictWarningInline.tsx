import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space } from '@/constants/tokens';
import { ConflictEngine } from '@/utils/conflictEngine';
import type { Product, Routine } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConflictWarningInlineProps {
  routines: Routine[];
  products: Product[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders an InlineAlert (amber) for each unique ingredient conflict found
 * across all steps in the provided routines. Returns null when no conflicts exist.
 */
export function ConflictWarningInline({ routines, products }: ConflictWarningInlineProps) {
  const allSteps = routines.flatMap((r) => r.steps);
  const conflicts = ConflictEngine.detectConflicts(allSteps, products);

  if (conflicts.length === 0) return null;

  // De-duplicate: one alert per unique rule (same pair may appear multiple times)
  const seen = new Set<string>();
  const unique = conflicts.filter((c) => {
    if (seen.has(c.rule.id)) return false;
    seen.add(c.rule.id);
    return true;
  });

  return (
    <View style={styles.wrap}>
      {unique.map((c) => (
        <InlineAlert
          key={c.rule.id}
          tone="warning"
          icon={<Feather name="alert-triangle" size={14} color={colors.statusWarningAccent} />}
          title="Ingredient conflict"
        >
          {`${c.rule.explanation}\n\n${c.rule.suggestion}`}
        </InlineAlert>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
});
