import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AddProductOptionsList } from '@/components/addProduct/AddProductOptionsList';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { IconButton } from '@/components/ui/core/IconButton';
import { colors, space } from '@/constants/tokens';
import type { AddProductFlowParamList } from '@/navigation/AppNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AddProductFlowParamList, 'AddProductHub'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * "My Shelf"'s Add Product hub — a thin AppHeader/back-button shell around
 * the shared `AddProductOptionsList` (tech design FE-7). All Scan/Search/
 * Manual mechanics live in that component; this screen's own behavior is
 * unchanged by the extraction.
 */
export default function AddProductHubScreen({ navigation, route }: Props) {
  const initialStatus = route.params?.initialStatus;
  const isExploring = initialStatus === 'wishlist';

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader
        title={isExploring ? 'Explore Product' : 'Add Product'}
        leftAction={
          <IconButton
            icon={<Icon name="arrow-left" size={20} color={colors.textPrimary} />}
            label="Back"
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AddProductOptionsList navigation={navigation} initialStatus={initialStatus} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
  },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[12],
    gap: space[3],
  },
});
