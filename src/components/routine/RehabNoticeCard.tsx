import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space, typography } from '@/constants/tokens';
import type { RehabNotice } from '@/types';

export interface RehabNoticeCardProps {
  /** One merged rehab notice (see buildRehabNotices). */
  notice: RehabNotice;
  /**
   * Additive eczema/rosacea recovery line (US-25), or null when it does not
   * apply. Computed by the caller via getRecoveryConditionCaution — copy-only:
   * it never changes the rehab window, the restrictions, or the card's tone.
   */
  conditionCaution?: string | null;
  /**
   * Controlled collapse state, resolved by the caller from the persisted
   * per-day snapshot (src/utils/rehabNoticeCollapse.ts) so a manual collapse
   * survives a re-visit for the rest of the skincare day instead of
   * re-expanding on every remount. Defaults to expanded for callers that
   * don't need day-scoped persistence (e.g. presentational tests).
   */
  collapsed?: boolean;
  /** Fires on header tap; the caller owns persisting the new value. */
  onToggleCollapse?: () => void;
}

const BARRIER_COPY: Record<RehabNotice['barrierStatus'], string> = {
  disrupted: 'Skin barrier disrupted — aggressive actives are paused below.',
  sensitive: 'Skin barrier still sensitive — actives return when recovery ends.',
};

/**
 * The single merged rehab card on the Routines screen (one per procedure).
 * Built on InlineAlert's collapsible variant — the "dropdown" alert type — so
 * this card shares the same chrome (tone, radius, padding, title typography)
 * as every other alert in the app instead of reimplementing it. Consolidates
 * the former rehab shield + lifestyle-restrictions cards: the restriction
 * list rides inside this card during the acute (disrupted) phase and
 * disappears once the notice reports no restrictions, so the user never sees
 * two anxious cards about the same procedure. Amber "alarm" tone (calmer than
 * the old red SOS), collapsible to its header + day-count line. Pure render
 * of a RehabNotice — self-destructs when the window ends and the notice is
 * gone.
 */
export function RehabNoticeCard({
  notice,
  conditionCaution = null,
  collapsed = false,
  onToggleCollapse,
}: RehabNoticeCardProps) {
  return (
    <View accessibilityRole="summary">
      <InlineAlert
        tone="warning"
        icon={<Icon name="shield" size={16} color={colors.statusWarning} />}
        title={`Rehabilitation: ${notice.procedureName}`}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        collapseAccessibilityLabel={`Rehabilitation: ${notice.procedureName}, ${collapsed ? 'collapsed, tap to expand' : 'expanded, tap to collapse'}`}
        summary={
          <Text style={styles.dayText}>
            Day {notice.currentDay} of {notice.totalDays}
          </Text>
        }
      >
        <Text style={styles.bodyText}>{BARRIER_COPY[notice.barrierStatus]}</Text>

        {notice.restrictions.length > 0 ? (
          <View style={styles.restrictions}>
            {notice.restrictions.map((text, i) => (
              <View key={i} style={styles.restrictionRow}>
                <Icon
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

        {conditionCaution ? (
          <Text style={styles.conditionCaution}>{conditionCaution}</Text>
        ) : null}
      </InlineAlert>
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Additive advisory line — same Amber caution family as the card, set apart
  // from the restriction list so it never reads as another restriction.
  conditionCaution: {
    ...typography.bodySmall,
    color: colors.statusWarning,
    marginTop: space[2],
    fontStyle: 'italic',
  },
});
