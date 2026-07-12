import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';

export type SectionAccordionStatus = 'empty' | 'in-progress' | 'complete' | 'skipped';

export interface SectionAccordionProps {
  index: 1 | 2 | 3 | 4;
  title: string;
  status: SectionAccordionStatus;
  isExpanded: boolean;
  onToggle: () => void;
  /** Rendered in the collapsed row once the section is complete. */
  summary: React.ReactNode;
  /** Rendered when expanded. */
  children: React.ReactNode;
}

function StatusIndicator({ index, status }: { index: number; status: SectionAccordionStatus }) {
  if (status === 'complete') {
    return (
      <View style={[styles.indicator, styles.indicatorFilled]}>
        <Feather name="check" size={14} color={colors.textOnDark} />
      </View>
    );
  }
  if (status === 'skipped') {
    return (
      <View style={[styles.indicator, styles.indicatorFilled]}>
        <Feather name="minus" size={14} color={colors.textOnDark} />
      </View>
    );
  }
  // 'empty' and 'in-progress' share one visual: outlined circle with the
  // section number ('in-progress' exists for the reducer's bookkeeping).
  return (
    <View style={[styles.indicator, styles.indicatorOutlined]}>
      <Text style={styles.indicatorNumber}>{index}</Text>
    </View>
  );
}

/**
 * Generic collapsible section shell. Purely prop-driven — expansion state
 * lives in the parent (one expandedSection value for the whole screen), and
 * this component knows nothing about the add-product draft. Tapping the
 * header row (anywhere on it) is the sole re-edit mechanism; there is no
 * "Back" navigation in this flow.
 */
export function SectionAccordion({
  index,
  title,
  status,
  isExpanded,
  onToggle,
  summary,
  children,
}: SectionAccordionProps) {
  const showSummary = status === 'complete' && !isExpanded;

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.headerRow, pressed && styles.headerRowPressed]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`Section ${index}: ${title}`}
      >
        <StatusIndicator index={index} status={status} />

        <View style={styles.headerContent}>
          {showSummary ? summary : <Text style={styles.title}>{title}</Text>}
        </View>

        <Feather
          name={showSummary ? 'edit-2' : isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>

      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[4],
  },
  headerRowPressed: {
    backgroundColor: colors.surfaceSunken,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: space[4],
    paddingBottom: space[4],
  },

  indicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorOutlined: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  indicatorFilled: {
    backgroundColor: colors.textPrimary,
  },
  indicatorNumber: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
});
