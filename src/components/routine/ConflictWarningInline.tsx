import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space } from '@/constants/tokens';
import { useSettingsStore } from '@/store/settingsStore';
import {
  applyConditionDensityModifiers,
  getActiveDensityFindings,
  type DensityFinding,
} from '@/utils/activeIngredientDensity';
import { ConflictEngine } from '@/utils/conflictEngine';
import { resolveNoticeCollapsed, toNoticeCollapseEntry } from '@/utils/noticeCollapse';
import {
  applyConditionSeverityModifiers,
  getConditionRiskWarnings,
  type ConditionAdvisory,
  type ModifiedConflict,
} from '@/utils/skinConditionModifiers';
import type { Product, RoutineStep, SkinConditionType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConflictWarningInlineProps {
  /**
   * The morning steps the user is actually looking at — already filtered for
   * the selected day, hidden steps, hidden products, and clinical freezes.
   * Taking rendered steps rather than whole routines is deliberate: warning
   * about a step the screen has removed (a retinoid frozen during peel rehab)
   * names products that are not in today's routine.
   */
  morningSteps: RoutineStep[];
  /** The evening steps the user is actually looking at. Same contract. */
  eveningSteps: RoutineStep[];
  products: Product[];
  /**
   * Self-reported conditions from the profile. Default `[]` — with none
   * selected this component renders exactly the pairwise conflict rows it
   * rendered before v1.2 (US-27).
   */
  skinConditions?: SkinConditionType[];
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

interface RowCollapseProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function ConflictRow({
  conflict,
  collapsed,
  onToggleCollapse,
}: { conflict: ModifiedConflict } & RowCollapseProps) {
  const { rule } = conflict.result;
  const title = 'Ingredient conflict';
  return (
    <InlineAlert
      tone="warning"
      icon={<Icon name="alert-triangle" size={16} color={colors.statusWarningAccent} />}
      title={title}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      collapseAccessibilityLabel={`${title}, ${collapsed ? 'collapsed, tap to expand' : 'expanded, tap to collapse'}`}
    >
      {`${rule.explanation}\n\n${rule.suggestion}${
        conflict.escalated
          ? '\n\nFlagged more strongly because of a skin condition in your profile.'
          : ''
      }`}
    </InlineAlert>
  );
}

function AdvisoryRow({
  advisory,
  collapsed,
  onToggleCollapse,
}: { advisory: ConditionAdvisory } & RowCollapseProps) {
  const title = `Sensitivity note · ${advisory.conditionLabels.join(' + ')}`;
  return (
    <InlineAlert
      tone="warning"
      icon={<Icon name="alert-circle" size={16} color={colors.statusWarningAccent} />}
      title={title}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      collapseAccessibilityLabel={`${title}, ${collapsed ? 'collapsed, tap to expand' : 'expanded, tap to collapse'}`}
    >
      {`${advisory.message}\n\nIn your routine: ${advisory.productNames.join(', ')}.`}
    </InlineAlert>
  );
}

function DensityRow({
  finding,
  collapsed,
  onToggleCollapse,
}: { finding: DensityFinding } & RowCollapseProps) {
  const isWarning = finding.tier === 'warning';
  const title = isWarning ? 'Ingredient overlap' : 'Routine insight';
  return (
    <InlineAlert
      tone={isWarning ? 'warning' : 'info'}
      icon={
        <Icon
          name={isWarning ? 'alert-circle' : 'info'}
          size={16}
          color={isWarning ? colors.statusWarningAccent : colors.statusInfo}
        />
      }
      title={title}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      collapseAccessibilityLabel={`${title}, ${collapsed ? 'collapsed, tap to expand' : 'expanded, tap to collapse'}`}
    >
      {`${finding.message}\n\n${finding.period === 'morning' ? 'Morning' : 'Evening'}: ${finding.productNames.join(', ')}.`}
    </InlineAlert>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * The routine's advisory stack, in descending seriousness:
 *
 * | Row kind | Tone | Source |
 * |---|---|---|
 * | `conflict` | Amber | pairwise matrix, severity possibly escalated (US-24) |
 * | `condition-advisory` | Amber | single ingredient + a selected condition (US-24) |
 * | `density-warning` | Amber | 2+ irritant-tier products in one period (US-28) |
 * | `density-insight` | **Cobalt** | 2+ mild-active products in one period (US-28) |
 *
 * None of these block anything, and all four are visually distinct from the
 * Cabernet (`sos`) hard blocks used for clinical seasonal/spacing rules — an
 * advisory must never be mistakable for a block (US-26). The insight row is
 * Cobalt on purpose: rendering "you have two vitamin C serums" in warning
 * colours would defeat the whole tier split.
 */
export function ConflictWarningInline({
  morningSteps,
  eveningSteps,
  products,
  skinConditions = [],
}: ConflictWarningInlineProps) {
  // Each row collapses independently and persists for the rest of the
  // skincare day (same day-scoped pattern as RehabNoticeCard) — with a
  // pairwise conflict, a condition advisory, and 2+ density findings all
  // possible at once, an all-expanded stack would otherwise pin the whole
  // screen until every one of them is resolved.
  const persistedCollapse = useSettingsStore((s) => s.routineNoticeCollapsed);
  const setRoutineNoticeCollapsed = useSettingsStore((s) => s.setRoutineNoticeCollapsed);
  const collapseProps = (key: string): RowCollapseProps => {
    const collapsed = resolveNoticeCollapsed(persistedCollapse[key]);
    return {
      collapsed,
      onToggleCollapse: () => setRoutineNoticeCollapsed(key, toNoticeCollapseEntry(!collapsed)),
    };
  };

  const allSteps = [...morningSteps, ...eveningSteps];

  // De-duplicate: one alert per unique rule (same pair may appear multiple times)
  const seen = new Set<string>();
  const conflicts = applyConditionSeverityModifiers(
    ConflictEngine.detectConflicts(allSteps, products),
    skinConditions,
  ).filter((c) => {
    if (seen.has(c.result.rule.id)) return false;
    seen.add(c.result.rule.id);
    return true;
  });

  const scheduledProducts = products.filter((product) =>
    allSteps.some((step) => step.productId === product.id),
  );
  const advisories = getConditionRiskWarnings(scheduledProducts, skinConditions);

  const density = applyConditionDensityModifiers(
    getActiveDensityFindings(
      [
        { period: 'morning', steps: morningSteps },
        { period: 'evening', steps: eveningSteps },
      ],
      products,
    ),
    skinConditions,
  );

  if (conflicts.length === 0 && advisories.length === 0 && density.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {conflicts.map((c) => (
        <ConflictRow
          key={c.result.rule.id}
          conflict={c}
          {...collapseProps(`conflict:${c.result.rule.id}`)}
        />
      ))}
      {advisories.map((advisory) => (
        <AdvisoryRow
          key={advisory.id}
          advisory={advisory}
          {...collapseProps(`advisory:${advisory.id}`)}
        />
      ))}
      {density.map((finding) => (
        <DensityRow
          key={finding.id}
          finding={finding}
          {...collapseProps(`density:${finding.id}`)}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    gap: space[3],
  },
});
