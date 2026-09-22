import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space } from '@/constants/tokens';
import { ACTIVES_RULESET, type Period } from '@/constants/rulesets/rulesetTypes';
import { useSettingsStore } from '@/store/settingsStore';
import {
  applyConditionDensityModifiers,
  getActiveDensityFindings,
  type DensityFinding,
} from '@/utils/activeIngredientDensity';
import { ConflictEngine, type ConflictStepInput } from '@/utils/conflictEngine';
import { resolveNoticeCollapsed, toNoticeCollapseEntry } from '@/utils/noticeCollapse';
import {
  applyConditionSeverityModifiers,
  getConditionRiskWarnings,
  type ConditionAdvisory,
  type ModifiedConflict,
} from '@/utils/skinConditionModifiers';
import type { ConflictSeverity, Product, RoutineStep, SkinConditionType } from '@/types';

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
  /**
   * Optional override of the step set used ONLY for pairwise ingredient
   * conflict detection (`ConflictEngine.detectConflicts`). Product-pair
   * chemistry doesn't care which tab is currently open — a retinoid used in
   * the morning and an AHA used in the evening still clash (for a `'day'`
   * -scoped rule) — so a caller that scopes `morningSteps`/`eveningSteps` to
   * a single active period (a single-active-period UI, e.g. RoutinesScreen's
   * Morning/Evening PillToggle) must pass the FULL routine here to keep that
   * detection working across both periods. Condition advisories and density
   * findings intentionally stay scoped to `morningSteps`/`eveningSteps` only
   * — those warn about what's actually rendered right now, and merging
   * periods there previously caused a stale advisory for a product from the
   * inactive period (progress/routine-step-grouping.md, bug-fix round
   * 2026-08-31). Each entry must carry its own `period` (conflict-
   * resolution-scope task) — a `'slot'`-scoped rule can only tell a same-
   * period hit from a split one when the override tags it, unlike
   * `morningSteps`/`eveningSteps` below, which this component tags itself.
   * Defaults to the period-tagged `[...morningSteps, ...eveningSteps]`, so
   * existing callers that already pass both periods' steps (e.g. rendering
   * both accordions at once) are unaffected.
   */
  allSteps?: ConflictStepInput[];
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

/**
 * Severity-driven copy prefix (tech-design vials-conflict-matrix-expansion.md
 * §3 FE-5). Exactly two tiers — `ConflictSeverity` is deliberately never
 * extended to a third ("Low"/"Minor") tier, so this map must stay exhaustive
 * over the two-member union rather than growing a fallback branch. Tone stays
 * `tone="warning"` (amber) for both — the prefix is the only visible
 * distinction between an `avoid` and a `caution` row.
 */
const CONFLICT_SEVERITY_PREFIX: Record<ConflictSeverity, string> = {
  avoid: 'Strong conflict — ',
  caution: 'Possible conflict — ',
};

/**
 * The routine the OTHER period's label names, for a same-period `'slot'`
 * conflict's actionable suggestion (FE-5). Exhaustive over `Period` on
 * purpose — a third period would need this map extended deliberately, not
 * silently fall through.
 */
const OTHER_PERIOD_ROUTINE_LABEL: Record<Period, string> = {
  am: 'evening',
  pm: 'morning',
};

/**
 * Generic, code-level copy for a same-period `resolutionScope: 'slot'`
 * conflict (spec Story 3) — parameterized only by which period the conflict
 * fired in, never stored per-rule in the ruleset (tech design Assumption 4).
 * A `'day'`-scoped rule (every real pair today) never reaches this; its
 * stored `rule.suggestion` renders unchanged.
 */
function buildSlotScopeSuggestion(firedInPeriod: Period): string {
  const otherRoutine = OTHER_PERIOD_ROUTINE_LABEL[firedInPeriod];
  return `Try moving one of these products to your ${otherRoutine} routine — using them in separate periods fully resolves this conflict.`;
}

function ConflictRow({
  conflict,
  suggestion,
  collapsed,
  onToggleCollapse,
}: { conflict: ModifiedConflict; suggestion: string } & RowCollapseProps) {
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
      {`${CONFLICT_SEVERITY_PREFIX[rule.severity]}${rule.explanation}\n\n${suggestion}${
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
  allSteps: allStepsOverride,
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

  // Advisories/density stay scoped to exactly what's rendered right now.
  const visibleSteps = [...morningSteps, ...eveningSteps];
  // Conflicts use the full routine (both periods) unless the caller scopes
  // morningSteps/eveningSteps to a single active period — see allSteps' doc
  // comment above for why this must not be tab-scoped. Tagged with period so
  // a `resolutionScope: 'slot'` rule can tell a same-period hit from a split
  // one; the caller-supplied override must already carry its own tags.
  const conflictSteps: ConflictStepInput[] =
    allStepsOverride ??
    [
      ...morningSteps.map((step): ConflictStepInput => ({ ...step, period: 'am' })),
      ...eveningSteps.map((step): ConflictStepInput => ({ ...step, period: 'pm' })),
    ];

  // De-duplicate: one alert per unique rule (same pair may appear multiple times)
  const seen = new Set<string>();
  const conflicts = applyConditionSeverityModifiers(
    ConflictEngine.detectConflicts(conflictSteps, products),
    skinConditions,
  ).filter((c) => {
    if (seen.has(c.result.rule.id)) return false;
    seen.add(c.result.rule.id);
    return true;
  });

  // FE-5: same-period `'slot'` hits get an actionable, code-level suggestion
  // naming the other period; everything else keeps its stored `rule.suggestion`
  // unchanged. Looked up from `conflictSteps` (already in scope) rather than
  // growing the shared ConflictResult/ConflictRule types in src/types/index.ts
  // — resolutionScope is a display-only concern (tech design §1).
  const suggestionFor = (conflict: ModifiedConflict): string => {
    const { rule, stepIdA, stepIdB } = conflict.result;
    const pairRule = ACTIVES_RULESET.pairRules.find((r) => r.id === rule.id);
    const stepA = conflictSteps.find((s) => s.id === stepIdA);
    const stepB = conflictSteps.find((s) => s.id === stepIdB);
    if (
      pairRule?.resolutionScope === 'slot' &&
      stepA?.period != null &&
      stepB?.period != null &&
      stepA.period === stepB.period
    ) {
      return buildSlotScopeSuggestion(stepA.period);
    }
    return rule.suggestion;
  };

  const scheduledProducts = products.filter((product) =>
    visibleSteps.some((step) => step.productId === product.id),
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
          suggestion={suggestionFor(c)}
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
