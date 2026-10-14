/**
 * Fixtures for the shared `RadioConfirmModal` component (ui/core).
 *
 * Spec:        docs/specs/multi-action-radio-picker.md
 * Tech design: docs/tech-design/multi-action-radio-picker.md §2, §3 FE-2
 *
 * `RadioConfirmModal` does not exist yet
 * (src/components/ui/core/RadioConfirmModal.tsx) — written tests-first per
 * .claude/rules/agent-layer-protocol.md. Prop types are imported with
 * `import type` only, so this fixtures module itself loads cleanly before
 * FE-2 ships; only the *.test.tsx file (which imports the component as a
 * VALUE, to render it) fails to resolve until then. That failure is expected
 * and normal at this pipeline stage.
 *
 * ── Binding contract qa-lead is testing against (tech design §2, §3 FE-2) ──
 *   RadioConfirmModal<T extends string>:
 *     { visible: boolean; title: string; body?: ReactNode;
 *       options: RadioOption<T>[]; defaultValue: T;
 *       onConfirm: (v: T) => void; onCancel: () => void; testID?: string }
 *   - Plain RN `Modal` (transparent, animationType="fade"), backdrop
 *     Pressable + centered sheet View — byte-identical chrome to
 *     DuplicateSlotChoiceSheet's pre-existing styles.backdrop/styles.sheet.
 *   - Renders `title` (typography.h3) + optional `body` + a `RadioOptionGroup`
 *     built from `options`/an internally-owned `selected` state + a fixed
 *     Cancel/Confirm action row — literal, non-customizable button text
 *     "Cancel" then "Confirm" (spec §5, tech design Assumption 4), queried in
 *     tests via visible text (`getByText('Confirm')`/`getByText('Cancel')`),
 *     per .claude/rules/testing.md's "query by visible text" guidance — no
 *     accessibilityLabel contract is imposed on the Confirm/Cancel Button
 *     instances themselves.
 *   - Selected state is seeded from `defaultValue` and MUST reset to
 *     `defaultValue` every time `visible` transitions from false to true
 *     (tech design §1: "seeded from defaultValue, reset whenever visible
 *     turns true") — a stale selection must never survive a close/reopen
 *     cycle.
 *   - Tapping a radio row only updates the local `selected` state — it must
 *     never call `onConfirm` or `onCancel` by itself (spec §5 / Story 1 AC5).
 *   - Confirm calls `onConfirm(selected)` — using whatever is currently
 *     selected, including the untouched `defaultValue` (spec Story 1 AC3 /
 *     Story 3 AC "Confirm without changing the default").
 *   - Cancel calls `onCancel` and must never call `onConfirm`.
 *   - `visible={false}` must render none of the modal's actionable content
 *     (title text absent/not queryable, no radio rows, no Confirm/Cancel —
 *     matches RN `Modal`'s own behavior of not rendering children while
 *     `visible` is false, mirrored by the existing
 *     DuplicateSlotChoiceSheet/RemoveStepModal convention).
 */
import type { ReactNode } from 'react';
import type { RadioOption } from '@/components/ui/forms/RadioOptionGroup';
import type { RadioConfirmModalProps } from '@/components/ui/core/RadioConfirmModal';

export type ScopeValue = 'both' | 'am' | 'pm';

export const SCOPE_OPTIONS: RadioOption<ScopeValue>[] = [
  { value: 'both', label: 'Morning & Evening' },
  { value: 'am', label: 'Morning Only' },
  { value: 'pm', label: 'Evening Only' },
];

export function makeRadioConfirmModalProps(
  overrides: Partial<RadioConfirmModalProps<ScopeValue>> = {},
): RadioConfirmModalProps<ScopeValue> {
  return {
    visible: true,
    title: 'Save this routine for',
    body: undefined as ReactNode,
    options: SCOPE_OPTIONS,
    defaultValue: 'both',
    onConfirm: () => {},
    onCancel: () => {},
    ...overrides,
  };
}
