/**
 * Fixtures for `RemoveStepModal` (src/components/routine/RemoveStepModal.tsx).
 *
 * Spec:        docs/specs/multi-action-radio-picker.md §4 Story 2
 * Tech design: docs/tech-design/multi-action-radio-picker.md §3 FE-4
 *
 * No dedicated component test file existed for RemoveStepModal before this
 * task — every RoutinesScreen-level suite mocks it to `() => null`
 * (unchanged by this task; see progress/multi-action-radio-picker-handoff.json).
 * This is the first isolated test file for it.
 *
 * ── Binding contract qa-lead is testing against (tech design §3 FE-4) ─────
 *   props (UNCHANGED by the FE-4 conversion):
 *     { visible, productName, dow, onRemoveDay, onRemoveAll, onCancel }
 *   - Title text exactly: `Remove ${productName}?`
 *   - Internally renders a RadioConfirmModal with two radio options:
 *       { value: 'day', label: `${dayPlural} only` }   (default-selected)
 *       { value: 'all', label: 'All days' }
 *     where `dayPlural` is `${DAY_NAMES[dow]}s` (e.g. dow=1 -> "Mondays
 *     only"), matching spec Story 2 AC1's literal expected copy.
 *   - `defaultValue: 'day'` — tech design Assumption 3: no button was
 *     previously primary at this site, so the default is the narrower/
 *     less-destructive scope, NOT the previously-primary-styled option (this
 *     is the one converted site where "previously primary" does not apply).
 *   - Confirm dispatches to onRemoveDay ('day') or onRemoveAll ('all')
 *     depending on the selection at Confirm time; Cancel calls onCancel and
 *     neither removal callback.
 *   - Backdrop press / onRequestClose also invokes onCancel (existing
 *     RemoveStepModal behavior, preserved by the RadioConfirmModal wrapper).
 */
import type { RemoveStepModalProps } from '@/components/routine/RemoveStepModal';

export function makeRemoveStepModalProps(
  overrides: Partial<RemoveStepModalProps> = {},
): RemoveStepModalProps {
  return {
    visible: true,
    productName: 'Vitamin C Serum',
    dow: 1, // Monday
    onRemoveDay: () => {},
    onRemoveAll: () => {},
    onCancel: () => {},
    ...overrides,
  };
}
