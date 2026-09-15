import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import { buildGoalFitMatchMessage, buildGoalFitMissMessage, type GoalFitFinding } from '@/utils/productProfile/goalFit';

interface Props {
  goalFit: GoalFitFinding[];
}

/**
 * Goal-fit insight card (explore-fit-signals FE-2). Spec: Story 1, tech
 * design §3 FE-2.
 *
 * Plain informational card, matching `FunctionalProfileCard`/
 * `DetectedActivesCard`'s icon-circle-header visual family — a fit fact, not
 * a warning, so it deliberately never reuses `SkinTypeCautionNotice`'s
 * tinted-alert treatment. Renders nothing at all when no real goal is set
 * (`goalFit` empty — `buildGoalFit` already drops `'maintenance'`).
 * Otherwise renders exactly ONE card with one line per finding (match or
 * miss), up to two — primary + secondary — never two separate cards, never a
 * goal silently dropped (spec §10 Open Questions 1/2, both RESOLVED).
 */
export function GoalFitCard({ goalFit }: Props) {
  if (goalFit.length === 0) return null;

  return (
    <View testID="goal-fit-card">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="target" size={18} color={palette.plum} />
          </View>
          <Text style={styles.cardTitle}>Goal fit</Text>
        </View>
        <View style={styles.rows}>
          {goalFit.map((finding) => (
            <View key={finding.goal} testID={`goal-fit-row-${finding.goal}`}>
              <Text style={styles.rowText}>
                {finding.matchedKeys.length > 0
                  ? buildGoalFitMatchMessage(finding.goal, finding.matchedKeys)
                  : buildGoalFitMissMessage(finding.goal)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[3],
    borderWidth: 0,
    ...shadow.sm,
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
  rows: {
    gap: space[3],
  },
  rowText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
});
