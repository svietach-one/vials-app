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
import { Checkbox } from '@/components/ui/forms/Checkbox';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';
import { useSettingsStore } from '@/store/settingsStore';

// ─── Consent copy version ──────────────────────────────────────────────────────

/**
 * Bumped whenever the slide 3 disclaimer sentence changes materially. See
 * docs/tech-design/onboarding-consent-copy-update.md §4 — co-located here
 * rather than in a shared constants module since this screen is the only
 * call site; a future re-prompt-on-bump flow (out of scope) would hoist it.
 */
const CURRENT_MEDICAL_DISCLAIMER_VERSION = 1;

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    eyebrow: 'CARE THAT ASKS LESS OF YOU',
    title: "Beauty isn't just about the right products.",
    body: "It's a system of small decisions and reminders you have to keep in mind. Let Vials hold that part — so your ritual keeps only what you actually enjoy.",
    cta: 'Next',
    accent: colors.statusInfo,
  },
  {
    eyebrow: 'PRIVACY FIRST',
    title: 'Your beauty secrets stay exactly that — yours.',
    body: 'Your skin profile, routines, and procedure history stay on your device by default — nothing personal is uploaded unless you choose to. When you add a new product to your shelf, anonymous data about it joins the Vials database, so the catalog grows for the whole community.',
    cta: 'Next',
    accent: colors.statusWarning,
  },
  {
    eyebrow: 'SAFETY LOGIC',
    title: 'Warnings that actually matter.',
    body: 'Instead of long lists of generic advice, Vials watches your own routine and warns you only about the combinations of products and procedures that actually apply to you.',
    cta: 'Get started',
    accent: colors.statusSafe,
  },
] as const;

const CONSENT_LABEL =
  "I understand Vials is a planning tool, not a medical app. It doesn't replace a consultation with a doctor or aesthetician, and it doesn't diagnose. Decisions about which products to use and procedures to undergo are mine to make.";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'MarketingSlides'>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MarketingSlidesScreen({ navigation }: Props) {
  const { width: screenW } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const acceptMedicalDisclaimer = useSettingsStore((s) => s.acceptMedicalDisclaimer);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
    setActiveIndex(idx);
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (activeIndex + 1) * screenW, animated: true });
    } else {
      acceptMedicalDisclaimer(CURRENT_MEDICAL_DISCLAIMER_VERSION);
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
            {slide.title ? <Text style={styles.title}>{slide.title}</Text> : null}
            <Text style={styles.body}>{slide.body}</Text>
            {i === SLIDES.length - 1 ? (
              <Checkbox
                size="md"
                checked={consentChecked}
                onValueChange={setConsentChecked}
                label={CONSENT_LABEL}
                style={styles.consentCheckbox}
              />
            ) : null}
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
          disabled={isLast && !consentChecked}
          onPress={handleNext}
        >
          {SLIDES[activeIndex].cta}
        </Button>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgScreen,
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

  eyebrow: { ...typography.label },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  body: {
    ...typography.bodyLg,
    color: colors.textSecondary,
    maxWidth: 340,
  },
  consentCheckbox: {
    marginTop: space[2],
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
