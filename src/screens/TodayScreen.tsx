import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, space, typography } from '@/constants/tokens';

// Placeholder — implemented in Phase 2 (Routine Hub)
export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.heading}>Today</Text>
        <Text style={styles.sub}>Routine Hub coming in Phase 2.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: space.gutterScreen },
  heading: { ...typography.h2, color: colors.textPrimary },
  sub: { ...typography.body, color: colors.textSecondary },
});
