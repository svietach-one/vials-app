import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space } from '@/constants/tokens';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getSpfAdequacyFinding, SPF_ADEQUACY_TITLE } from '@/utils/spfAdequacy';
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
 * Dismissible seasonal skincare tips. Two independent Cobalt notices, each
 * with its own season-scoped dismiss key:
 *
 *  - the standing seasonal tip, and
 *  - (v1.2, US-29) the SPF adequacy recommendation, shown only to Light/Fair
 *    phototypes in summer whose scheduled morning sunscreen is below SPF 30.
 *
 * Both render Cobalt (`info`), never Amber: this is proactive information, not
 * a caution about an interaction. Neither blocks anything, and both reappear
 * next season because the dismiss key carries the season and year.
 */
export function SeasonalNoticeBanner() {
  const dismissedBanners = useSettingsStore((s) => s.dismissedBanners);
  const dismissBanner = useSettingsStore((s) => s.dismissBanner);
  const routines = useRoutinesStore((s) => s.routines);
  const products = useProductsStore((s) => s.products);
  const profile = useProfileStore((s) => s.profile);

  const season = getCurrentSeason();
  const year = new Date().getFullYear();
  const bannerKey = `banner_${year}_${season}`;

  const spfFinding = getSpfAdequacyFinding({
    routines,
    products,
    fitzpatrick: profile?.fitzpatrick ?? null,
    phototype: profile?.phototype ?? null,
  });
  const showSpf = spfFinding !== null && !dismissedBanners.includes(spfFinding.dismissKey);
  const showSeasonal = !dismissedBanners.includes(bannerKey);

  if (!showSeasonal && !showSpf) return null;

  return (
    <View style={styles.wrap}>
      {showSeasonal ? (
        <InlineAlert
          tone="info"
          icon={<Icon name="sun" size={14} color={colors.statusInfo} />}
          title={SEASON_TITLE[season]}
          onDismiss={() => dismissBanner(bannerKey)}
          dismissAccessibilityLabel="Dismiss seasonal tip"
        >
          {SEASON_MESSAGE[season]}
        </InlineAlert>
      ) : null}

      {showSpf && spfFinding ? (
        <InlineAlert
          tone="info"
          icon={<Icon name="shield" size={14} color={colors.statusInfo} />}
          title={SPF_ADEQUACY_TITLE}
          onDismiss={() => dismissBanner(spfFinding.dismissKey)}
          dismissAccessibilityLabel="Dismiss sunscreen recommendation"
        >
          {spfFinding.message}
        </InlineAlert>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
});
