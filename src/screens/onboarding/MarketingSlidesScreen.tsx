import React, { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/ui/core/Button';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    eyebrow: 'Privacy first',
    title: 'Your data stays\non your device.',
    body: 'Everything you log — products, routines, procedures — is saved locally. No account, no cloud, no tracking. You own your data.',
    accent: colors.statusInfo,
  },
  {
    eyebrow: 'Safety logic',
    title: 'Ingredient conflicts\ncaught before they happen.',
    body: 'Vials cross-checks active ingredients and clinical procedures in real time, so you get warnings exactly when they matter — not generic disclaimers.',
    accent: colors.statusWarning,
  },
  {
    eyebrow: 'Cyclic planning',
    title: 'A routine that adapts\nto your skin cycle.',
    body: 'Schedule products by day of week, manage clinical recovery windows, and let the app handle the timing logic while you focus on your skin.',
    accent: colors.statusSafe,
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'MarketingSlides'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MarketingSlidesScreen({ navigation }: Props) {
  const { width: screenW } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
    setActiveIndex(idx);
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * screenW, animated: true });
    } else {
      navigation.replace('SkinProfileSetup');
    }
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width: screenW }]}>
            <Text style={[styles.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Footer: dots + CTA */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleNext}
        >
          {isLast ? 'Get started' : 'Continue'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: space.gutterScreen,
    justifyContent: 'center',
    gap: space[4],
  },

  eyebrow: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  body: {
    ...typography.bodyLg,
    color: colors.textSecondary,
    maxWidth: 340,
  },

  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
    gap: space[5],
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.textPrimary,
  },
});
