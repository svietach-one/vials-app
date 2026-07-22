import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, space, typography } from '@/constants/tokens';
import type { RehabNotice } from '@/types';

export interface RehabNoticeCardProps {
  /** One merged rehab notice (see buildRehabNotices). */
  notice: RehabNotice;
}

const BARRIER_COPY: Record<RehabNotice['barrierStatus'], string> = {
  disrupted: 'Skin barrier disrupted — aggressive actives are paused below.',
  sensitive: 'Skin barrier still sensitive — actives return when recovery ends.',
};

/**
 * The single merged rehab card on the Routines screen (one per procedure).
 * Consolidates the former rehab shield + lifestyle-restrictions cards: the
 * restriction list rides inside this card during the acute (disrupted) phase
 * and disappears once the notice reports no restrictions, so the user never
 * sees two anxious cards about the same procedure. Amber "alarm" tone (calmer
 * than the old red SOS), collapsible to its header line. Pure render of a
 * RehabNotice — self-destructs when the window ends and the notice is gone.
 */
export function RehabNoticeCard({ notice }: RehabNoticeCardProps) {
  // Local UI only — collapses the card to its header line to save space.
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Pressable
        style={styles.headerRow}
        onPress={() => setCollapsed((c) => !c)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`Rehabilitation: ${notice.procedureName}, ${collapsed ? 'collapsed, tap to expand' : 'expanded, tap to collapse'}`}
      >
        <View style={styles.headerLeft}>
          <Feather name="shield" size={14} color={colors.statusWarning} />
          <Text style={styles.headerText}>Rehabilitation: {notice.procedureName}</Text>
        </View>
        <Feather
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.statusWarning}
        />
      </Pressable>

      {!collapsed ? (
        <>
          <Text style={styles.dayText}>
            Day {notice.currentDay} of {notice.totalDays}
          </Text>
          <Text style={styles.bodyText}>{BARRIER_COPY[notice.barrierStatus]}</Text>

          {notice.restrictions.length > 0 ? (
            <View style={styles.restrictions}>
              {notice.restrictions.map((text, i) => (
                <View key={i} style={styles.restrictionRow}>
                  <Feather
                    name="x-circle"
                    size={13}
                    color={colors.statusWarning}
                    style={styles.restrictionIcon}
                  />
                  <Text style={styles.restrictionText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.statusWarningTint,
    borderWidth: 1,
    borderColor: colors.statusWarningLine,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    gap: space[1],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 1,
  },
  headerText: {
    ...typography.label,
    color: colors.statusWarning,
    flexShrink: 1,
  },
  dayText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.statusWarning,
  },
  bodyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  restrictions: {
    marginTop: space[2],
    gap: space[2],
  },
  restrictionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
  },
  restrictionIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  restrictionText: {
    ...typography.bodySmall,
    color: colors.statusWarning,
    flex: 1,
  },
});
