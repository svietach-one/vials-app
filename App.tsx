import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';
import AppNavigator from '@/navigation/AppNavigator';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';

export default function App() {
  const [storesReady, setStoresReady] = useState(false);

  const [fontsLoaded] = useFonts({
    'DMSans-Regular': require('@expo-google-fonts/dm-sans/DMSans_400Regular.ttf'),
    'DMSans-Medium': require('@expo-google-fonts/dm-sans/DMSans_500Medium.ttf'),
    'DMSerifDisplay-Regular': require('@expo-google-fonts/dm-serif-display/DMSerifDisplay_400Regular.ttf'),
  });

  useEffect(() => {
    async function hydrateStores() {
      await Promise.all([
        useProfileStore.getState().hydrate(),
        useProductsStore.getState().hydrate(),
        useRoutinesStore.getState().hydrate(),
        useProceduresStore.getState().hydrate(),
        useSettingsStore.getState().hydrate(),
      ]);
      setStoresReady(true);
    }
    void hydrateStores();
  }, []);

  if (!fontsLoaded || !storesReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.controlFill} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
  },
});
