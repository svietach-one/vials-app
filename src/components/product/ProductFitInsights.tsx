import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivesBadge } from '@/components/ui/ActivesBadge';
import { DetectedActivesCard } from '@/components/catalog/DetectedActivesCard';
import { GoalFitCard } from '@/components/catalog/GoalFitCard';
import { SkinTypeCautionNotice } from '@/components/catalog/SkinTypeCautionNotice';
import { getMatchesForKey, hasAliasOverride } from '@/utils/attributionLookup';
import { colors, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import type { ActiveIngredientKey, Product } from '@/types';
import { buildConditionCaution } from '@/utils/productProfile/conditionCaution';
import { buildGoalFit } from '@/utils/productProfile/goalFit';
import { joinActiveKeys } from '@/utils/productProfile/join';
import { findOnePercentLine } from '@/utils/productProfile/onePercentLine';
import { resolveFromProduct, tokenizeIngredientsText } from '@/utils/productProfile/resolve';
import { buildSkinTypeCaution } from '@/utils/productProfile/skinTypeCaution';

interface Props {
  product: Product;
  /** Navigates to the Profile tab so the user can set a skin type. */
  onSetSkinType: () => void;
  /** Opens the attribution tooltip for a tapped active. */
  onActivePress: (key: ActiveIngredientKey) => void;
  /** Rendered directly under the actives card (the screen passes the Allergens card). */
  afterActives?: React.ReactNode;
}

/**
 * Explore-derived insights on the saved-product page: INCI position of each
 * active (with the 1% line), skin-type / condition caution, goal fit, and the
 * disclaimer. Reuses the Explore result cards verbatim. Shelf overlap,
 * routine occupancy and the SPF hint are deliberately excluded — they are
 * pre-purchase signals and would compare the product with itself.
 *
 * Resolves keys with `resolveFromProduct` (confirmed `activeTags` ∪ keys
 * parsed from `fullIngredientText`), so tag-only products still get caution
 * and goal fit; they just have no INCI position.
 */
export function ProductFitInsights({ product, onSetSkinType, onActivePress, afterActives }: Props) {
  const profile = useProfileStore((s) => s.profile);

  const insights = useMemo(() => {
    const resolved = resolveFromProduct(product);
    const tokens = product.fullIngredientText ? tokenizeIngredientsText(product.fullIngredientText) : [];
    return {
      resolved,
      tokens,
      onePercentLine: findOnePercentLine(tokens),
      aliasKeys: resolved.resolvedActiveKeys.filter((key) =>
        hasAliasOverride(getMatchesForKey(product.fullIngredientText, key)),
      ),
      skinTypeCaution: buildSkinTypeCaution(joinActiveKeys(resolved.resolvedActiveKeys, resolved.potencyByKey)),
    };
  }, [product]);

  const goalFit = useMemo(
    () =>
      buildGoalFit(
        insights.resolved.resolvedActiveKeys,
        profile?.primaryGoal ?? 'maintenance',
        profile?.secondaryGoal ?? null,
      ),
    [insights.resolved.resolvedActiveKeys, profile?.primaryGoal, profile?.secondaryGoal],
  );
  const conditionCaution = useMemo(
    () => buildConditionCaution(insights.resolved.resolvedActiveKeys, profile?.skinConditions ?? []),
    [insights.resolved.resolvedActiveKeys, profile?.skinConditions],
  );

  if (insights.resolved.resolvedActiveKeys.length === 0) return <>{afterActives}</>;

  return (
    <>
      <DetectedActivesCard
        resolvedActiveKeys={insights.resolved.resolvedActiveKeys}
        ingredientTokens={insights.tokens}
        positionByKey={insights.resolved.positionByKey}
        onePercentLine={insights.onePercentLine}
        onActivePress={onActivePress}
        aliasKeys={insights.aliasKeys}
        legend={
          <View style={styles.legend}>
            <ActivesBadge />
            <Text style={styles.legendText}>
              Products with detected actives carry this badge on routine cards.
            </Text>
          </View>
        }
      />

      {afterActives}

      <SkinTypeCautionNotice
        caution={insights.skinTypeCaution}
        skinType={profile?.skinType ?? null}
        conditionCaution={conditionCaution}
        onSetSkinType={onSetSkinType}
      />

      <GoalFitCard goalFit={goalFit} />

      <View testID="product-fit-disclaimer">
        <Text style={styles.disclaimerText}>
          This overview reflects known ingredient functions only — it is not a personalized
          recommendation. Check with a dermatologist for advice about your own skin.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  legendText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingTop: space[2],
  },
});
