import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CompositionComparisonMatrix } from '@/components/catalog/CompositionComparisonMatrix';
import { DetectedActivesCard } from '@/components/catalog/DetectedActivesCard';
import { FunctionalProfileCard } from '@/components/catalog/FunctionalProfileCard';
import { RoutinePlacementCard } from '@/components/catalog/RoutinePlacementCard';
import { SkinTypeCautionNotice } from '@/components/catalog/SkinTypeCautionNotice';
import { space, typography, colors } from '@/constants/tokens';
import type { CompositionInsights } from '@/hooks/useCompositionInsights';
import { findOnePercentLine } from '@/utils/productProfile/onePercentLine';

type Props = CompositionInsights & {
  /** Navigates to the Profile tab so the user can set a skin type (explore-insights-v2 task 05). */
  onSetSkinType: () => void;
};

/**
 * Shared insight-sections block (Story 9, tech design FE-20) — composes, in
 * the fixed order established by the 2026-08-26 decision batch: Functional
 * profile -> Detected actives -> Skin-type caution -> Comparison matrix
 * (only when `shelfComparison` is non-null) -> Routine placement (only when
 * `routinePosition` is non-null) -> disclaimer (lifted verbatim, same
 * `testID="explore-result-disclaimer"` the result screen already shipped).
 *
 * Purely presentational: takes `useCompositionInsights`' output as props, no
 * store/hook access of its own. Both `ExploreCompositionResultScreen.tsx`
 * (FE-21 refactor) and the new `WishlistEntryDetailScreen.tsx` (FE-22) render
 * this one component instead of each keeping a parallel copy of the same
 * five sections.
 */
export function CompositionInsightsSection({
  capabilityTags,
  resolvedActiveKeys,
  ingredientTokens,
  positionByKey,
  skinType,
  skinTypeCaution,
  shelfComparison,
  shelfOverlap,
  shelfProductCount,
  routinePosition,
  routineFit,
  onSetSkinType,
}: Props) {
  // Computed once here, not inside useCompositionInsights — a pure
  // presentation-layer derivation from the hook's already-exposed
  // `ingredientTokens`, same convention as this component owning the
  // null-skinType suppression for SkinTypeCautionNotice below.
  const onePercentLine = useMemo(() => findOnePercentLine(ingredientTokens), [ingredientTokens]);

  return (
    <>
      <FunctionalProfileCard capabilityTags={capabilityTags} />

      <DetectedActivesCard
        resolvedActiveKeys={resolvedActiveKeys}
        ingredientTokens={ingredientTokens}
        positionByKey={positionByKey}
        onePercentLine={onePercentLine}
      />

      <SkinTypeCautionNotice
        caution={skinTypeCaution}
        skinType={skinType}
        onSetSkinType={onSetSkinType}
      />

      {shelfComparison ? (
        <CompositionComparisonMatrix
          comparison={shelfComparison}
          shelfOverlap={shelfOverlap}
          shelfProductCount={shelfProductCount}
        />
      ) : null}

      {routinePosition ? (
        <RoutinePlacementCard position={routinePosition} routineFit={routineFit} />
      ) : null}

      <View testID="explore-result-disclaimer" style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          This overview reflects known ingredient functions only — it is not a personalized
          recommendation. Check with a dermatologist for advice about your own skin.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    paddingTop: space[2],
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
