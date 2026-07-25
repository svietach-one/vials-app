import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { Button } from '@/components/ui/core/Button';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';

/**
 * Product-contribution consent modal — full-screen decision moment, used both
 * for the first-ever manual save and for periodic reminders while `declined`.
 * See docs/specs/contribution-consent-flow/01-copy-and-consent-states.md §4.
 */

export type ContributionConsentModalVariant = 'first-time' | 'reminder';

export interface ContributionConsentModalProps {
  visible: boolean;
  variant: ContributionConsentModalVariant;
  /** `shareThisProduct` reflects the modal's own toggle at the moment Continue was pressed. */
  onContinue: (shareThisProduct: boolean) => void;
  onNotNow: () => void;
}

const COPY = {
  'first-time': {
    headline: 'Make adding products easier for everyone.',
    body: 'Share this product anonymously to help improve Vials for everyone. Every shared product makes adding products faster and easier for the next person.',
    footnote: 'You can change this anytime in Profile → Privacy.',
  },
  reminder: {
    headline: 'Still building the Vials shelf.',
    body: "You've added a few more products since we last asked. Want to share one? It's anonymous, and takes one tap.",
    footnote: null,
  },
} as const;

export function ContributionConsentModal({
  visible,
  variant,
  onContinue,
  onNotNow,
}: ContributionConsentModalProps) {
  // Toggle defaults on every time the modal is (re)shown — a fresh decision
  // moment each time, per the state-machine spec (§1: "Off" is the inline
  // toggle's default, not this modal's).
  const [shareThisProduct, setShareThisProduct] = useState(true);
  useEffect(() => {
    if (visible) setShareThisProduct(true);
  }, [visible, variant]);

  const copy = COPY[variant];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onNotNow}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.iconBadge}>
            <Icon name="droplet" size={20} color={palette.plum} />
          </View>

          <Text style={styles.headline}>{copy.headline}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Share this product</Text>
            <Switch
              checked={shareThisProduct}
              onValueChange={setShareThisProduct}
              activeColor={palette.plum}
              accessibilityLabel="Share this product"
            />
          </View>

          <View style={styles.buttonRow}>
            <Button
              variant="secondary"
              size="lg"
              onPress={onNotNow}
              style={styles.btn}
            >
              Not now
            </Button>
            <Button
              variant="primary"
              size="lg"
              onPress={() => onContinue(shareThisProduct)}
              style={styles.btn}
            >
              Continue
            </Button>
          </View>

          {copy.footnote ? <Text style={styles.footnote}>{copy.footnote}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.bgBase,
    borderRadius: radius.xl,
    padding: space[6],
    gap: space[4],
    ...shadow.lg,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  toggleLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  btn: {
    flex: 1,
  },
  footnote: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
