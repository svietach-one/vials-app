import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { ROUTINE_PHASE_LABELS } from '@/constants/labels';
import { LAYERING_ORDER } from '@/constants/rulesets/productFacts';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RoutineFit } from '@/hooks/useCompositionInsights';
import type { RoutinePosition } from '@/types';

interface Props {
  position: RoutinePosition;
  /** `null` only when `category === null` — the card itself isn't rendered in that case either (same gate). */
  routineFit: RoutineFit | null;
}

/** At most 2 labels, then a `+{n} more` suffix — copy per task 06 (narrower than task 04's 3, deliberately). */
const MAX_OCCUPANT_LABELS = 2;

function formatOccupantList(occupants: Array<{ label: string }>): string {
  const shown = occupants.slice(0, MAX_OCCUPANT_LABELS).map((o) => o.label);
  const remainder = occupants.length - shown.length;
  return remainder > 0 ? [...shown, `+${remainder} more`].join(', ') : shown.join(', ');
}

/**
 * Story 8 routine placement (2026-08-26 decision batch, FE-13), extended by
 * explore-insights-v2 task 06. Keeps the phase-label position, and adds two
 * routine-aware lines beneath it:
 *   - occupancy: which real Shelf products already sit in this phase
 *     (`routineFit.occupants`, matched by `LAYERING_ORDER` slot — several
 *     `ProductType`s share a slot, e.g. serum/gel — so this is a phase
 *     question, not a single-ProductType one);
 *   - morning SPF presence (`routineFit.morningSpf`, from
 *     `morningSpfPresence.ts` — absence-only, never `spfAdequacy.ts`'s
 *     strength threshold, and never rendered for `'no-morning-routine'` —
 *     a user with no morning routine yet is never told something is
 *     missing from it).
 * Still shows only the phase-label position otherwise — no AM/PM
 * eligibility, rinse-off status, or writing to `routinesStore` (spec Story 8
 * §3 Non-Goals; task 06 Out of Scope).
 */
export function RoutinePlacementCard({ position, routineFit }: Props) {
  const label = position.layeringOrder !== null ? ROUTINE_PHASE_LABELS[position.layeringOrder] : undefined;
  if (label === undefined) return null;

  // This composition's own phase IS sun protection when its layeringOrder
  // matches the slot every 'spf' ProductType maps to — reuses the same
  // single source of truth `routineFit`'s occupancy matching already reads,
  // rather than requiring a separate `category` prop just for this check.
  const isThisCompositionSpf = position.layeringOrder === LAYERING_ORDER.spf;

  return (
    <View testID="routine-placement">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="calendar" size={18} color={palette.plum} />
          </View>
          <Text style={styles.cardTitle}>Routine placement</Text>
        </View>
        <Text style={styles.label}>{label}</Text>

        {routineFit ? (
          <>
            {routineFit.occupants.length > 0 ? (
              <Text style={styles.occupancyText} testID="routine-occupancy">
                You already have {routineFit.occupants.length} here:{' '}
                {formatOccupantList(routineFit.occupants)}
              </Text>
            ) : (
              <Text style={styles.occupancyText} testID="routine-occupancy">
                Nothing in this step yet
              </Text>
            )}

            {routineFit.morningSpf === 'absent' ? (
              <View style={styles.spfWrap} testID="routine-morning-spf-gap">
                <Text style={styles.spfText}>
                  {isThisCompositionSpf
                    ? 'This would fill the SPF gap in your morning routine'
                    : 'Your morning routine still has no SPF'}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[2],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  occupancyText: {
    ...typography.bodySmall,
    color: palette.plum,
  },
  // The only amber in this batch — a missing SPF is a genuine caution under
  // the semantic mapping in PRD_Spec.md §2, unlike the occupancy lines above.
  spfWrap: {
    alignSelf: 'flex-start',
    backgroundColor: colors.statusWarningTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: 4,
  },
  spfText: {
    ...typography.bodySmall,
    color: colors.statusWarningAccent,
  },
});
