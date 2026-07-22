import React from 'react';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors } from '@/constants/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import { getCurrentSeason } from '@/utils/timeHelpers';

// ─── Season content ───────────────────────────────────────────────────────────

type Season = 'summer' | 'autumn' | 'winter' | 'spring';

const SEASON_TITLE: Record<Season, string> = {
  summer: 'Summer skin tip',
  autumn: 'Autumn skin tip',
  winter: 'Winter skin tip',
  spring: 'Spring skin tip',
};

const SEASON_MESSAGE: Record<Season, string> = {
  summer:
    'UV intensity is at its peak. SPF 50+ every day, reapply every 2 hours outdoors. Postpone deep chemical exfoliants until autumn.',
  autumn:
    'Cooler, drier air is prime time for retinol. Starting at 2× per week helps minimise sensitivity as your skin adjusts.',
  winter:
    'Cold air strips the lipid barrier fast. Reach for ceramide-rich moisturisers and skip harsh foaming cleansers.',
  spring:
    'Seasonal allergens can heighten sensitivity. Watch for new redness patterns and reduce active-ingredient frequency if needed.',
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Dismissible seasonal skincare tip. Suppressed after the user dismisses it
 * for the current year + season (stored in settingsStore.dismissedBanners).
 */
export function SeasonalNoticeBanner() {
  const dismissedBanners = useSettingsStore((s) => s.dismissedBanners);
  const dismissBanner = useSettingsStore((s) => s.dismissBanner);

  const season = getCurrentSeason();
  const year = new Date().getFullYear();
  const bannerKey = `banner_${year}_${season}`;

  if (dismissedBanners.includes(bannerKey)) return null;

  return (
    <InlineAlert
      tone="info"
      icon={<Feather name="sun" size={14} color={colors.statusInfo} />}
      title={SEASON_TITLE[season]}
      action={
        <IconButton
          icon={<Feather name="x" size={16} color={colors.statusInfo} />}
          label="Dismiss seasonal tip"
          variant="ghost"
          size="xs"
          onPress={() => dismissBanner(bannerKey)}
        />
      }
    >
      {SEASON_MESSAGE[season]}
    </InlineAlert>
  );
}
