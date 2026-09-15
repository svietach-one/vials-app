import React, { useEffect, useRef, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';
import SkinProfileSetupScreen from '@/screens/onboarding/SkinProfileSetupScreen';
import { useProfileStore } from '@/store/profileStore';
import type { UserProfile } from '@/types';

/**
 * TEMPORARY DEBUG COMPONENT — remove together with the "Developer Tools"
 * section in ProfileScreen.tsx.
 *
 * Renders the onboarding screens via plain local-state step switching instead
 * of a real React Navigation stack. A previous version nested a full
 * `createNativeStackNavigator` (backed by react-native-screens) inside this
 * component's `Modal` — RN's `Modal` renders its subtree in a separate native
 * root, and nesting a react-native-screens native stack inside a `Modal` is a
 * documented source of touches failing to register at all on iOS (confirmed:
 * neither the checkbox nor the CTA button responded). Plain conditional
 * rendering sidesteps this entirely — no native view controllers, no
 * disconnected gesture root.
 *
 * The preview stops after SkinProfileSetup (tech design
 * onboarding-simplification.md FE-10): `ContributionConsentScreen` no longer
 * exists (it's now the `GrowDatabasePromptModal`, shown from a real product
 * save, not an onboarding step), and the rewritten `FirstProductScreen`
 * navigates into real stack screens (CaptureFlow/ManualProductForm/
 * AddProduct) that this Modal-based fake-navigation harness — which only
 * ever hands each screen a `replace(nextStep)` stub, never a real `navigate`
 * — cannot drive. Previewing MarketingSlides -> SkinProfileSetup still
 * exercises the harness's one real hazard area (native-screens-in-a-Modal).
 *
 * SkinProfileSetupScreen writes straight to profileStore, including nulling
 * out real skin-profile fields on "Skip" — so the real profile is snapshotted
 * on open and restored on close to avoid clobbering real data.
 */

type DebugStep = 'MarketingSlides' | 'SkinProfileSetup';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FAKE_ROUTE = { key: 'debug', name: 'debug', params: undefined } as never;

export function DebugOnboardingPreview({ visible, onClose }: Props) {
  const snapshotRef = useRef<UserProfile | null>(null);
  const [step, setStep] = useState<DebugStep>('MarketingSlides');
  const onboardingCompleted = useProfileStore(
    (s) => s.profile?.onboardingCompleted ?? false,
  );

  useEffect(() => {
    if (visible && snapshotRef.current === null) {
      snapshotRef.current = useProfileStore.getState().profile;
      setStep('MarketingSlides');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && onboardingCompleted) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingCompleted]);

  function handleClose() {
    if (snapshotRef.current) {
      useProfileStore.getState().setProfile(snapshotRef.current);
    }
    snapshotRef.current = null;
    onClose();
  }

  // Each remaining preview screen only ever calls `navigation.replace(...)`
  // (never reads its argument's value here — the action to take on Finish is
  // decided by the caller below) and never reads `route.params`, so a
  // minimal hand-built navigation/route pair is enough to drive it.
  function fakeNavigation(onReplace: () => void) {
    return { replace: onReplace } as never;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.flex}>
        {step === 'MarketingSlides' ? (
          <MarketingSlidesScreen
            navigation={fakeNavigation(() => setStep('SkinProfileSetup'))}
            route={FAKE_ROUTE}
          />
        ) : (
          // Preview ends here (tech design FE-10) — SkinProfileSetup's Finish
          // would normally advance to FirstProduct, which now navigates into
          // real stack screens this Modal-based harness cannot drive.
          <SkinProfileSetupScreen navigation={fakeNavigation(handleClose)} route={FAKE_ROUTE} />
        )}

        <SafeAreaView style={[styles.overlay, { pointerEvents: 'box-none' }]}>
          <View style={[styles.badgeRow, { pointerEvents: 'box-none' }]}>
            <View style={styles.badge}>
              <Icon name="eye" size={12} color={palette.white} />
              <Text style={styles.badgeText}>Debug Preview</Text>
            </View>
            <IconButton
              icon={<Icon name="x" size={16} color={palette.white} />}
              label="Exit onboarding preview"
              variant="ghost"
              size="xs"
              style={styles.closeBtn}
              onPress={handleClose}
            />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgSubtle },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingTop: space[1],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.statusWarning,
    borderRadius: radius.pill,
    paddingHorizontal: space[2] + 2,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'DMSans-Medium',
    color: palette.white,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: palette.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
