import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SKIN_TYPE_OPTIONS } from '@/constants/labels';
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { colors, space, typography } from '@/constants/tokens';
import type { SkinType } from '@/types';
import type { SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';

interface Props {
  /** `buildSkinTypeCaution`'s result — `null` means the trigger never fired. */
  caution: SkinTypeCautionResult | null;
  /** `profile.skinType` — `null` suppresses the notice entirely, even when `caution` fired
   * (tech design's "null skinType suppression" assumption: the pure `skinTypeCaution.ts`
   * function doesn't know about the profile, so this component owns the suppression). */
  skinType: SkinType | null;
}

/**
 * Story 7 skin-type caution (2026-08-26 decision batch, FE-13). A real
 * sentence naming the actual triggering active(s) and the user's own stored
 * skin type — never a generic badge/icon/label (spec Story 7 AC3). Renders
 * nothing at all — no placeholder, no hidden markup — when either the
 * trigger never fired or the user has no stored skin type (spec Story 7
 * AC2/AC4). Structurally separate from `CompositionComparisonMatrix` — never
 * nested inside it (spec Story 7 AC5).
 */
export function SkinTypeCautionNotice({ caution, skinType }: Props) {
  if (caution === null || skinType === null) return null;

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
});
