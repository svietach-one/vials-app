import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { Button } from '@/components/ui/core/Button';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space, typography } from '@/constants/tokens';

/**
 * One-time notice for profiles that migrated to the contribution-consent
 * schema (spec Story 3) — i.e. installs that predate the onboarding consent
 * screen and were backfilled to `{ granted: false, timestamp: null }`. Dumb
 * presenter, same pattern as GoalConfirmBanner/PhototypeConfirmBanner: the
 * host (RoutinesScreen) owns the visibility condition and dismissal
 * persistence via `settingsStore.dismissedBanners`; this component only
 * renders the copy and forwards its two callbacks.
 */
export interface ContributionConsentMigrationBannerProps {
  onGoToSettings: () => void;
  onDismiss: () => void;
}

export function ContributionConsentMigrationBanner({
  onGoToSettings,
  onDismiss,
}: ContributionConsentMigrationBannerProps) {
  return (
    <InlineAlert
      tone="info"
      icon={<Icon name="image" size={16} color={colors.statusInfo} />}
      title="Share photos with Vials?"
    >
      <Text style={styles.body}>
        You can now choose to share product photos with the Vials community database. Manage
        this anytime in Settings.
      </Text>
      <View style={styles.actions}>
        <Button variant="textActive" size="sm" onPress={onGoToSettings} accessibilityLabel="Go to Settings">
          Go to Settings
        </Button>
        <Button variant="textActive" size="sm" onPress={onDismiss} accessibilityLabel="Dismiss">
          Dismiss
        </Button>
      </View>
    </InlineAlert>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: space[4],
    marginTop: space[2],
  },
});
