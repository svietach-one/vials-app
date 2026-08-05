import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert, type AlertTone } from '@/components/ui/feedback/InlineAlert';
import { colors, space } from '@/constants/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import { getGoalCoverageFindings, type GoalCoverageInput } from '@/utils/goalCoverage';

/**
 * Standing goal-coverage banner (engine4.1 handoff §3): "does the saved
 * routine still contain an active that solves your stated care goal?" Up to
 * two findings (primary + secondary goal), each independently dismissible.
 * Never Cabernet, never blocking — 'safety_redirect' is the one Amber case
 * (pregnancy-safety fallback), everything else is Cobalt.
 *
 * Dumb presenter over `getGoalCoverageFindings()`: the host (RoutinesScreen)
 * already assembles `treatmentClassRanking`/`pregnancyRules` via
 * `buildRoutineContext()` for other purposes, so this component takes that
 * pre-resolved input rather than re-deriving it — mirrors
 * `SeasonalNoticeBanner`'s self-connect-to-stores pattern, except the routine
 * context here comes from the host to avoid a second `buildRoutineContext`
 * call per render.
 */
export interface GoalCoverageBannerProps {
  input: GoalCoverageInput;
}

const TONE_MAP: Record<'safety_redirect' | 'on_shelf' | 'not_owned', AlertTone> = {
  safety_redirect: 'warning',
  on_shelf: 'info',
  not_owned: 'info',
};

export function GoalCoverageBanner({ input }: GoalCoverageBannerProps) {
  const dismissedBanners = useSettingsStore((s) => s.dismissedBanners);
  const dismissBanner = useSettingsStore((s) => s.dismissBanner);

  const findings = getGoalCoverageFindings(input).filter(
    (f) => !dismissedBanners.includes(f.dismissKey),
  );

  if (findings.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {findings.map((finding) => (
        <InlineAlert
          key={finding.dismissKey}
          tone={TONE_MAP[finding.tone]}
          icon={
            <Icon
              name="target"
              size={16}
              color={finding.tone === 'safety_redirect' ? colors.statusWarning : colors.statusInfo}
            />
          }
          title={finding.title}
          onDismiss={() => dismissBanner(finding.dismissKey)}
          dismissAccessibilityLabel={`Dismiss ${finding.title}`}
        >
          {finding.message}
        </InlineAlert>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
});
