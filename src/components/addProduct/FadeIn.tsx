import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { duration } from '@/constants/tokens';

export interface FadeInProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fade length in ms; defaults to the base motion token. */
  durationMs?: number;
}

/**
 * Mounts its children with a one-shot opacity fade. Built on React Native's
 * own Animated API — deliberately no new dependency. Remounting via a `key`
 * change replays the fade (used when a fresh photo/OCR result appears).
 */
export function FadeIn({ children, style, durationMs = duration.base }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [opacity, durationMs]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
