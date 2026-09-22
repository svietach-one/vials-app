import React from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddProductOptionsList } from '@/components/addProduct/AddProductOptionsList';
import { Button } from '@/components/ui/core/Button';
import { colors, space, typography } from '@/constants/tokens';
import type { AddProductFlowParamList, OnboardingStackParamList } from '@/navigation/AppNavigator';
import { useProfileStore } from '@/store/profileStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'FirstProduct'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Onboarding's own first-product step — a thin wrapper around the shared
 * `AddProductOptionsList` (tech design FE-8), giving onboarding the exact
 * same Scan/Search/Manual entry points as "My Shelf"'s `AddProductHubScreen`.
 * Header copy and the "Skip for now" footer action are unchanged from the
 * previous bespoke implementation; there is no back button (nothing to go
 * back to).
 */
export default function FirstProductScreen({ navigation }: Props) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  function completeOnboarding() {
    updateProfile({ onboardingCompleted: true });
    // AppNavigator re-renders automatically when the store updates
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Step 2 of 2</Text>
          <Text style={styles.title}>Add your first{'\n'}product.</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <AddProductOptionsList
            navigation={navigation as unknown as NativeStackNavigationProp<AddProductFlowParamList>}
            entryContext="onboarding"
          />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button variant="secondary" size="lg" fullWidth onPress={completeOnboarding}>
            Skip for now
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    gap: space[2],
    marginBottom: space[5],
  },
  eyebrow: { ...typography.label, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary },

  content: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
    gap: space[3],
  },

  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
  },
});
