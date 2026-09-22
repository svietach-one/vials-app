import { STEP_ACTION_FOR_TYPE } from '@/constants/rulesets/stepActions';
import {
  TRANSITION_PRECEDENCE,
  TRANSITION_RULES,
  type StepTransitionNoteText,
} from '@/constants/rulesets/stepTransitions';
import type { Product, RoutineStep, StepAction, StepTransition } from '@/types';
import { normalizeActiveKey } from '@/utils/ingredientParser';
import { reclassifyMakeupRemover } from '@/utils/productForm/categoryDetector';
import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';

/**
 * Pure grouping + transition logic for the routine-step-grouping render
 * layer (docs/specs/routine-step-grouping/PRD_Spec.md §2, §3, §5). No React,
 * no store access — callers pass the already period/weekday/paused-filtered
 * step list and the shelf, and read the result back into props.
 */

/** One member of a rendered step group — the persisted step, plus its
 *  resolved product (`null` when `productId` is null — an orphaned slot). */
export interface StepGroupMember {
  step: RoutineStep;
  product: Product | null;
}

/** One rendered "process" — all steps sharing a `StepAction`. */
export interface StepGroup {
  action: StepAction;
  members: StepGroupMember[];
}

/**
 * Buckets `steps` by `StepAction`, one group per action, ordered by the
 * array index of each group's FIRST member — never by `LAYERING_ORDER`
 * (PRD_Spec.md §3.1: a `LAYERING_ORDER`-derived order would silently undo
 * every manual drag). A consecutive-run walk is the wrong shape here: any
 * action whose layering index falls between two members of another action
 * (e.g. `mask` between `eye_cream` and `cream`) would split that action in
 * two — bucketing avoids that unconditionally.
 *
 * Within a group, `reapply` products sort last; everything else keeps its
 * incoming array order. Grouping uses the RECLASSIFIED product type
 * (`reclassifyMakeupRemover`) so a mistyped micellar water groups under
 * Cleanse the same way its badge already does. An orphaned step
 * (`productId: null`, no matching product) buckets on its own persisted
 * `step.productType`, since there is no product to reclassify.
 */
export function groupStepsIntoActions(steps: RoutineStep[], products: Product[]): StepGroup[] {
  const order: StepAction[] = [];
  const buckets = new Map<StepAction, StepGroupMember[]>();

  for (const step of steps) {
    const product = step.productId ? products.find((p) => p.id === step.productId) ?? null : null;
    const bucketType = product ? reclassifyMakeupRemover(product).productType : step.productType;
    const action = STEP_ACTION_FOR_TYPE[bucketType];

    if (!buckets.has(action)) {
      buckets.set(action, []);
      order.push(action);
    }
    buckets.get(action)?.push({ step, product });
  }

  return order.map((action) => {
    const members = buckets.get(action) ?? [];
    const inline = members.filter((m) => m.product?.timing !== 'reapply');
    const reapply = members.filter((m) => m.product?.timing === 'reapply');
    return { action, members: [...inline, ...reapply] };
  });
}

/** Normalized active-class keys carried by a group member's product, or []
 *  for an orphaned member or a `reapply` product (excluded from transitions
 *  in both directions per PRD_Spec.md §4.2/§5.4). */
function inlineActiveKeys(member: StepGroupMember): ReturnType<typeof normalizeActiveKey>[] {
  if (!member.product || member.product.timing === 'reapply') return [];
  const raw = member.product.activeTags ?? member.product.activeIngredients.map((i) => i.key);
  return raw.map(normalizeActiveKey);
}

/**
 * Resolves the transition on the gap after `from` (and before `to`, when
 * `to` is not the final step) — PRD_Spec.md §5.4:
 * 1. Collect `after` rules from `from`'s inline members and `before` rules
 *    from `to`'s inline members (`to === null` handles the final gap —
 *    `after` rules only, which is exactly how `spf_filters`' `before_sun`
 *    fires on an AM routine's last step).
 * 2. Exactly one note -> it is the transition.
 * 3. Several -> precedence `dry_skin` > `until_dry` > `immediate` (`before_sun`
 *    only ever occurs alone, at the final gap).
 * 4. Otherwise `none`.
 */
export function resolveTransition(from: StepGroup, to: StepGroup | null): StepTransition {
  const notes = new Set<StepTransitionNoteText>();

  for (const member of from.members) {
    for (const key of inlineActiveKeys(member)) {
      const rule = TRANSITION_RULES[key]?.after;
      if (rule?.kind === 'note') notes.add(rule.text);
    }
  }

  if (to) {
    for (const member of to.members) {
      for (const key of inlineActiveKeys(member)) {
        const rule = TRANSITION_RULES[key]?.before;
        if (rule?.kind === 'note') notes.add(rule.text);
      }
    }
  }

  for (const text of TRANSITION_PRECEDENCE) {
    if (notes.has(text)) return { kind: 'note', text };
  }
  return { kind: 'none' };
}

/** True when every member of the group is completed. A group with no members
 *  at all is vacuously "all completed" — callers should not call this on an
 *  empty group (a rendered step always has >= 1 member). */
export function isGroupAllCompleted(
  group: StepGroup,
  isCompleted: (member: StepGroupMember) => boolean,
): boolean {
  return group.members.every(isCompleted);
}

/** A rendered group plus any generator `placeholder`s matched onto its action
 *  (US-44 / SCREENS.md §6.1) — rendered as a `GapCard` among its members. */
export interface RenderGroup extends StepGroup {
  gaps: PlaceholderSlot[];
}

/**
 * Matches unfilled `placeholder`s (`validateCurrentRoutines().proposedPlan
 * .placeholders`, already period-filtered by the caller) onto the group for
 * their `productTypes[0]`'s action. A placeholder whose action has no
 * existing real group produces a synthetic gap-only group instead of being
 * dropped — returned separately in `extraGroups` since it has no persisted
 * steps to participate in drag reordering.
 */
export function attachPlaceholderGaps(
  groups: StepGroup[],
  placeholders: PlaceholderSlot[],
): { groups: RenderGroup[]; extraGroups: RenderGroup[] } {
  const withGaps: RenderGroup[] = groups.map((group) => ({
    ...group,
    gaps: placeholders.filter((p) => STEP_ACTION_FOR_TYPE[p.productTypes[0]] === group.action),
  }));

  const matchedActions = new Set(groups.map((g) => g.action));
  const unmatched = placeholders.filter((p) => !matchedActions.has(STEP_ACTION_FOR_TYPE[p.productTypes[0]]));

  const extraByAction = new Map<StepAction, PlaceholderSlot[]>();
  for (const placeholder of unmatched) {
    const action = STEP_ACTION_FOR_TYPE[placeholder.productTypes[0]];
    extraByAction.set(action, [...(extraByAction.get(action) ?? []), placeholder]);
  }
  const extraGroups: RenderGroup[] = [...extraByAction.entries()].map(([action, gaps]) => ({
    action,
    members: [],
    gaps,
  }));

  return { groups: withGaps, extraGroups };
}
