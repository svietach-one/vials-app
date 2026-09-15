import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SKIN_TYPE_OPTIONS } from '@/constants/labels';
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { SkinType } from '@/types';
import type { ConditionCautionFinding } from '@/utils/productProfile/conditionCaution';
import type { SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';

interface Props {
  /** `buildSkinTypeCaution`'s result — `null` means the generic trigger never fired. */
  caution: SkinTypeCautionResult | null;
  /** `profile.skinType` — drives the nudge below when a caution fired but no skin type is on file
   * (explore-insights-v2 task 05); still suppresses the generic caution sentence entirely when `caution`
   * is null, since a promised insight with nothing to say would be a lie. */
  skinType: SkinType | null;
  /**
   * `buildConditionCaution`'s result (explore-fit-signals FE-3/FE-4). Renders
   * independently of `caution`/`skinType` — a real case (azelaic acid under
   * eczema) trips a condition advisory but never the generic skin-type
   * trigger. Takes precedence over the generic sentence for any active it
   * already names; the generic sentence still covers any OTHER triggering
   * active not covered by a condition-specific finding.
   */
  conditionCaution: ConditionCautionFinding[];
  /** Navigates to the Profile tab so the user can set a skin type — only invoked from the nudge. */
  onSetSkinType: () => void;
}

/**
 * Story 7 skin-type caution (2026-08-26 decision batch, FE-13), extended by
 * explore-insights-v2 task 05 (skin-type-unset nudge) and explore-fit-signals
 * FE-4 (condition-aware enrichment). A real sentence naming the actual
 * triggering active(s) and the user's own stored skin type — never a generic
 * badge/icon/label (spec Story 7 AC3). Structurally separate from
 * `CompositionComparisonMatrix` — never nested inside it (spec Story 7 AC5).
 *
 * Top-level guard: renders nothing only when BOTH signals are empty
 * (`caution === null && conditionCaution.length === 0`) — extended from the
 * original `caution === null` guard, since a condition-specific finding can
 * fire on its own (spec §4 Story 2 AC3). The skin-type-unset nudge's own gate
 * stays exactly `caution !== null && skinType === null` — NOT widened by the
 * presence of a condition-only finding (spec §10 Open Question 3, RESOLVED:
 * a deliberate non-change).
 */
export function SkinTypeCautionNotice({ caution, skinType, conditionCaution, onSetSkinType }: Props) {
  if (caution === null && conditionCaution.length === 0) return null;

  // Same-active precedence (spec Story 2 AC2): a condition-specific line for
  // an active takes priority over repeating the generic sentence for that
  // same active — the generic sentence still names any OTHER triggering
  // active not covered by a condition-specific line.
  const conditionCoveredKeys = new Set(conditionCaution.map((finding) => finding.tag));
  const remainderKeys =
    caution !== null ? caution.triggeringKeys.filter((key) => !conditionCoveredKeys.has(key)) : [];

  const showNudge = caution !== null && skinType === null;
  const showGenericCaution = caution !== null && skinType !== null && remainderKeys.length > 0;

  const skinTypeLabel =
    skinType !== null
      ? SKIN_TYPE_OPTIONS.find((option) => option.value === skinType)?.label ?? skinType
      : null;

  return (
    <>
      {conditionCaution.length > 0 ? (
        <View style={styles.wrap} testID="condition-caution">
          {conditionCaution.map((finding) => (
            <Text key={finding.tag} style={styles.text}>
              {finding.message}
            </Text>
          ))}
        </View>
      ) : null}

      {showNudge ? (
        <View style={styles.nudgeWrap} testID="skin-type-nudge">
          <Text style={styles.nudgeText}>Set your skin type to see how these ingredients suit you</Text>
          <Text style={styles.link} onPress={onSetSkinType} accessibilityRole="link">
            Set skin type
          </Text>
        </View>
      ) : null}

      {showGenericCaution ? (
        <View style={styles.wrap} testID="skin-type-caution">
          <Text style={styles.text}>
            {remainderKeys.map((key) => ACTIVES_RULESET.classes[key]?.displayName ?? key).join(', ')} may
            need extra care for {skinTypeLabel?.toLowerCase()} skin — worth watching how your skin
            responds.
          </Text>
        </View>
      ) : null}
    </>
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
