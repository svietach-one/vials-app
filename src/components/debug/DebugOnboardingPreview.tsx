import React, { useEffect, useRef } from 'react';
import { Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { IconButton } from '@/components/ui/core/IconButton';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';
import FirstProductScreen from '@/screens/onboarding/FirstProductScreen';
import MarketingSlidesScreen from '@/screens/onboarding/MarketingSlidesScreen';
import SkinProfileSetupScreen from '@/screens/onboarding/SkinProfileSetupScreen';
import { useProfileStore } from '@/store/profileStore';
import type { UserProfile } from '@/types';

/**
 * TEMPORARY DEBUG COMPONENT — remove together with the "Developer Tools"
 * section in ProfileScreen.tsx.
 *
 * Builds its own onboarding stack (rather than importing AppNavigator's)
 * because AppNavigator imports ProfileScreen for the Profile tab — reusing
 * its navigator here would be a circular import that also drags the entire
 * screen graph (react-native-webview via the OCR scanner, etc.) into any
 * test that touches ProfileScreen.
 *
 * SkinProfileSetupScreen and FirstProductScreen write straight to
 * profileStore/productsStore, including nulling out real skin-profile fields
 * on "Skip" — so the real profile is snapshotted on open and restored on
 * close/completion to avoid clobbering real data.
 */

const DebugOnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

function StandaloneOnboardingStack() {
  return (
    <DebugOnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <DebugOnboardingStack.Screen name="MarketingSlides" component={MarketingSlidesScreen} />
      <DebugOnboardingStack.Screen name="SkinProfileSetup" component={SkinProfileSetupScreen} />
      <DebugOnboardingStack.Screen name="FirstProduct" component={FirstProductScreen} />
    </DebugOnboardingStack.Navigator>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DebugOnboardingPreview({ visible, onClose }: Props) {
  const snapshotRef = useRef<UserProfile | null>(null);
  const onboardingCompleted = useProfileStore(
    (s) => s.profile?.onboardingCompleted ?? false,
  );

  useEffect(() => {
    if (visible && snapshotRef.current === null) {
      snapshotRef.current = useProfileStore.getState().profile;
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.flex}>
        {/* v7 requires nested containers to opt in explicitly via this wrapper */}
        <NavigationIndependentTree>
          <NavigationContainer>
            <StandaloneOnboardingStack />
          </NavigationContainer>
        </NavigationIndependentTree>

        <SafeAreaView style={styles.overlay} pointerEvents="box-none">
          <View style={styles.badgeRow} pointerEvents="box-none">
            <View style={styles.badge}>
              <Feather name="eye" size={12} color={palette.white} />
              <Text style={styles.badgeText}>Debug Preview</Text>
            </View>
            <IconButton
              icon={<Feather name="x" size={16} color={palette.white} />}
              label="Exit onboarding preview"
              variant="ghost"
              size="xs"
              style={styles.closeBtn}
              onPress={handleClose}
            />
          </View>
        </SafeAreaView>
      </View>
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
