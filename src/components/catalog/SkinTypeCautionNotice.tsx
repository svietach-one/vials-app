import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SKIN_TYPE_OPTIONS } from '@/constants/labels';
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { SkinType } from '@/types';
import type { SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';

interface Props {
  /** `buildSkinTypeCaution`'s result — `null` means the trigger never fired. */
  caution: SkinTypeCautionResult | null;
  /** `profile.skinType` — drives the nudge below when a caution fired but no skin type is on file
   * (explore-insights-v2 task 05); still suppresses the caution sentence entirely when `caution` is null,
   * since a promised insight with nothing to say would be a lie. */
  skinType: SkinType | null;
  /** Navigates to the Profile tab so the user can set a skin type — only invoked from the nudge. */
  onSetSkinType: () => void;
}

/**
 * Story 7 skin-type caution (2026-08-26 decision batch, FE-13), extended by
 * explore-insights-v2 task 05. A real sentence naming the actual triggering
 * active(s) and the user's own stored skin type — never a generic
 * badge/icon/label (spec Story 7 AC3). Renders nothing at all when the
 * trigger never fired (`caution === null`), regardless of `skinType` — we
 * don't know there's anything to say either way, so promising insight would
 * be a lie. When the trigger DID fire but the user has no stored skin type,
 * renders a nudge instead of silently offering less to exactly the users
 * who've given us the least (task 05 — previously this branch was also
 * silent). Structurally separate from `CompositionComparisonMatrix` — never
 * nested inside it (spec Story 7 AC5).
 */
export function SkinTypeCautionNotice({ caution, skinType, onSetSkinType }: Props) {
  if (caution === null) return null;

  if (skinType === null) {
    return (
      <View style={styles.nudgeWrap} testID="skin-type-nudge">
        <Text style={styles.nudgeText}>Set your skin type to see how these ingredients suit you</Text>
        <Text style={styles.link} onPress={onSetSkinType} accessibilityRole="link">
          Set skin type
        </Text>
      </View>
    );
  }

  const activeNames = caution.triggeringKeys
    .map((key) => ACTIVES_RULESET.classes[key]?.displayName ?? key)
    .join(', ');
  const skinTypeLabel =
    SKIN_TYPE_OPTIONS.find((option) => option.value === skinType)?.label ?? skinType;

  return (
    <View style={styles.wrap} testID="skin-type-caution">
      <Text style={styles.text}>
        {activeNames} may need extra care for {skinTypeLabel.toLowerCase()} skin — worth watching how
        your skin responds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: space[4],
    borderRadius: 16,
    backgroundColor: colors.statusWarningTint,
    gap: space[2],
  },
  text: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  // Informational, not a warning — palette.cobalt/cobaltTint, never amber/cabernet:
  // the user has done nothing wrong by not having a skin type set yet.
  nudgeWrap: {
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: palette.cobaltTint,
    gap: space[2],
  },
  nudgeText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  link: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.cobalt,
    textDecorationLine: 'underline',
  },
});
