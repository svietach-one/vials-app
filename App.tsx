import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';
import { drainPhotoUploadsIfDue } from '@/domain/photoUploadActions';
import { refreshSeasonMaskIfDue } from '@/domain/seasonActions';
import AppNavigator from '@/navigation/AppNavigator';
import { CorpusProvider } from '@/providers/CorpusProvider';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';

export default function App() {
  const [storesReady, setStoresReady] = useState(false);

  const [fontsLoaded] = useFonts({
    'DMSans-Regular': require('@expo-google-fonts/dm-sans/DMSans_400Regular.ttf'),
    'DMSans-Medium': require('@expo-google-fonts/dm-sans/DMSans_500Medium.ttf'),
    'DMSans-Bold': require('@expo-google-fonts/dm-sans/DMSans_700Bold.ttf'),
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
        useTrackingStore.getState().hydrate(),
      ]);
      setStoresReady(true);
      // Weekly weather check (research §1.7): fire-and-forget after hydrate;
      // ≤1 request per interval, silent calendar fallback on any failure.
      void refreshSeasonMaskIfDue();
      // Drain any pending product-photo uploads on cold start (img-01).
      void drainPhotoUploadsIfDue();
    }
    void hydrateStores();
  }, []);

  // Drain the photo upload queue on every foreground, throttled to once per
  // 15 minutes (img-01). No-op until img-04 wires a real transport.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void drainPhotoUploadsIfDue();
    });
    return () => sub.remove();
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
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <CorpusProvider>
            <AppNavigator />
          </CorpusProvider>
        </BottomSheetModalProvider>
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
