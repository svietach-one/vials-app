import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { Icon } from '@/components/ui/Icon';
import { reasonText } from '@/constants/decisionReasons';
import { LEFT_OUT_COPY } from '@/constants/routineScreenCopy';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { Product } from '@/types';
import type { LeftOutItem } from '@/utils/routineLeftOut';

/**
 * "Not in your routine · N": the owned products that have no visible saved step,
 * each with ONE reason line (spec Story 4). Collapsed by default. Presentational:
 * the items come from the pure `buildLeftOutItems` rule and both actions are
 * reported upward — the screen records the override / opens the Draft Preview;
 * nothing is saved from here.
 */

export interface LeftOutSectionProps {
  items: LeftOutItem[];
  products: Product[];
  /** "Add" on a reserve row: force the product into the draft. */
  onAdd: (productId: string) => void;
  /** "Review" on a ready row: open the Draft Preview. */
  onReview: () => void;
}

/** The single reason line a row shows, by kind. */
function reasonLine(item: LeftOutItem): string | null {
  switch (item.kind) {
    case 'ready':
      return LEFT_OUT_COPY.readyToAdd;
    case 'alternative':
      return LEFT_OUT_COPY.backup;
    case 'frozen': {
      const reason = item.reasonCode ? reasonText(item.reasonCode) : null;
      if (!item.until) return reason;
      const until = LEFT_OUT_COPY.pausedUntil(item.until);
      return reason ? `${reason} (${until})` : until;
    }
    case 'reserve':
      return item.reasonCode ? reasonText(item.reasonCode) : null;
  }
}

export function LeftOutSection({ items, products, onAdd, onReview }: LeftOutSectionProps) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const header = LEFT_OUT_COPY.leftOutHeader(items.length);
  const nameOf = (productId: string) => products.find((p) => p.id === productId)?.name ?? 'Product';

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={header}
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <Text style={styles.heading}>{header}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
      </Pressable>

      {expanded
        ? items.map((item) => {
            const name = nameOf(item.productId);
            const line = reasonLine(item);
            return (
              <View key={item.productId} style={styles.row}>
                <View style={styles.textWrap}>
                  <Text style={styles.name}>{name}</Text>
                  {line ? <Text style={styles.reason}>{line}</Text> : null}
                </View>
                {item.kind === 'reserve' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => onAdd(item.productId)}
                    accessibilityLabel={`${LEFT_OUT_COPY.addAction} ${name}`}
                  >
                    {LEFT_OUT_COPY.addAction}
                  </Button>
                ) : null}
                {item.kind === 'ready' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={onReview}
                    accessibilityLabel={`${LEFT_OUT_COPY.reviewAction} ${name}`}
                  >
                    {LEFT_OUT_COPY.reviewAction}
                  </Button>
                ) : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    padding: space[3],
    gap: space[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    ...typography.label,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[1],
    marginTop: space[2],
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  reason: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
