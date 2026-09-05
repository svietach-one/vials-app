import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';
import type { OnePercentLineResult } from '@/utils/productProfile/onePercentLine';

interface Props {
  resolvedActiveKeys: ActiveIngredientKey[];
  /** Ordered comma-split ingredient tokens — used only for the total count. */
  ingredientTokens: string[];
  /** 1-based INCI position per resolved key; a key may be absent. */
  positionByKey: Partial<Record<ActiveIngredientKey, number>>;
  onePercentLine: OnePercentLineResult | null;
}

interface ActiveRow {
  key: ActiveIngredientKey;
  position?: number;
  belowLine: boolean;
}

/** English ordinal suffix (1st, 2nd, 3rd, 4th, 11th, 21st, 42nd…). No i18n layer in this app (audit §6). */
function formatOrdinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Sorts by INCI position ascending; keys with no recorded position go last,
 * in their current (already-alphabetical, per `resolve.ts`'s `sortKeys`)
 * order — explore-insights-v2 task 03.
 */
function buildRows(
  resolvedActiveKeys: ActiveIngredientKey[],
  positionByKey: Partial<Record<ActiveIngredientKey, number>>,
  onePercentLine: OnePercentLineResult | null,
): ActiveRow[] {
  const withPosition: { key: ActiveIngredientKey; position: number }[] = [];
  const withoutPosition: ActiveIngredientKey[] = [];

  for (const key of resolvedActiveKeys) {
    const position = positionByKey[key];
    if (position === undefined) {
      withoutPosition.push(key);
    } else {
      withPosition.push({ key, position });
    }
  }
  withPosition.sort((a, b) => a.position - b.position);

  // The result is 0-based, positions are 1-based: a position at or after
  // `lineIndex + 1` sits at or below the boundary — the boundary token
  // itself counts as below.
  const belowLineFloor = onePercentLine !== null ? onePercentLine.lineIndex + 1 : null;
  const isBelowLine = (position: number) => belowLineFloor !== null && position >= belowLineFloor;

  return [
    ...withPosition.map(({ key, position }) => ({ key, position, belowLine: isBelowLine(position) })),
    ...withoutPosition.map((key) => ({ key, position: undefined, belowLine: false })),
  ];
}

/**
 * "Detected actives" insight card (Story 9, FE-19; extended by
 * explore-insights-v2 task 03). One row per active — label on the left,
 * INCI position on the right, an optional below-the-1%-line note beneath —
 * ordered by position ascending, most-prominent-first, the same order the
 * INCI list itself uses. Replaces the flat alphabetical `Tag` pill row: a
 * pill cannot legibly carry two pieces of metadata per item.
 */
export function DetectedActivesCard({
  resolvedActiveKeys,
  ingredientTokens,
  positionByKey,
  onePercentLine,
}: Props) {
  const totalCount = ingredientTokens.length;
  const rows = buildRows(resolvedActiveKeys, positionByKey, onePercentLine);

  return (
    <View testID="detected-actives">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="droplet" size={18} color={palette.plum} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Detected actives</Text>
            {rows.length > 0 ? (
              <Text style={styles.cardSubtitle}>{totalCount} ingredients in this list</Text>
            ) : null}
          </View>
        </View>
        {rows.length > 0 ? (
          <View style={styles.rows}>
            {rows.map((row) => (
              <View key={row.key} testID={`active-row-${row.key}`} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowLabel}>{ACTIVE_INGREDIENT_LABELS[row.key] ?? row.key}</Text>
                  {row.position !== undefined ? (
                    <Text style={styles.rowPosition}>
                      {formatOrdinal(row.position)} of {totalCount}
                    </Text>
                  ) : null}
                </View>
                {row.belowLine ? (
                  <View style={styles.belowLineNoteWrap}>
                    <Text style={styles.belowLineNoteText}>
                      {onePercentLine?.confidence === 'medium'
                        ? 'Probably below the 1% line — likely a small amount'
                        : 'Below the 1% line — likely a small amount'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedText}>
            No known active ingredients detected in this composition.
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardHeaderText: {
    gap: 2,
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
  cardSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  rows: {
    gap: space[3],
  },
  row: {
    gap: 2,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  rowPosition: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  belowLineNoteWrap: {
    alignSelf: 'flex-start',
    backgroundColor: palette.cobaltTint,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  belowLineNoteText: {
    ...typography.caption,
    color: palette.cobalt,
  },
  mutedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
