/**
 * Fixtures for the shared `RadioOptionGroup` component (ui/forms).
 *
 * Spec:        docs/specs/multi-action-radio-picker.md
 * Tech design: docs/tech-design/multi-action-radio-picker.md §2, §3 FE-1
 *
 * `RadioOptionGroup` does not exist yet
 * (src/components/ui/forms/RadioOptionGroup.tsx) — written tests-first per
 * .claude/rules/agent-layer-protocol.md. Prop types are imported with
 * `import type` only, so this fixtures module itself loads cleanly before
 * FE-1 ships; only the *.test.tsx file (which imports the component as a
 * VALUE, to render it) fails to resolve until then. That failure is expected
 * and normal at this pipeline stage.
 *
 * ── Binding contract qa-lead is testing against (tech design §2) ──────────
 *   RadioOptionGroup<T extends string>:
 *     { options: { value: T; label: string; sublabel?: string }[];
 *       value: T; onChange: (v: T) => void; testID?: string }
 *   - Pure controlled component: no Modal, no footer, no business logic.
 *   - Container: accessibilityRole="radiogroup" (precedent: PhototypeStep.tsx);
 *     testID (if given) is applied to that same container.
 *   - Each row: accessibilityRole="radio" + accessibilityState={{checked}},
 *     matching the house convention already used by Select.tsx,
 *     ReplaceStepSheet's OptionRow, and QuizSheet's QuizAnswerChip. The row's
 *     accessible name (accessibilityLabel, queryable via
 *     `getByRole('radio', { name: option.label })` per the PhototypeStep.test.tsx
 *     precedent) is the option's `label` ONLY — a `sublabel`, when present, is
 *     rendered as its own separate visible Text node, not folded into the
 *     accessible name (qa-lead assumption; flagged in progress log for batch
 *     review — Select.tsx's own convention instead folds its "reason" fragment
 *     into the accessible name, but RadioOptionGroup's `sublabel` is modeled
 *     as auxiliary description text, not part of the choice's identity).
 *   - Tapping a row always calls `onChange(option.value)`, even when that
 *     value already equals the current `value` — mirrors Select.tsx's
 *     onValueChange, which fires unconditionally on every option tap. Never
 *     calls any other callback; RadioOptionGroup has no onConfirm/onCancel of
 *     its own (those live one level up, in RadioConfirmModal or a caller's own
 *     footer).
 */
import type { RadioOption, RadioOptionGroupProps } from '@/components/ui/forms/RadioOptionGroup';

export type ThreeWayScope = 'replace' | 'keep_both' | 'extra';

export const THREE_OPTIONS: RadioOption<ThreeWayScope>[] = [
  { value: 'replace', label: 'Replace' },
  { value: 'keep_both', label: 'Keep both' },
  { value: 'extra', label: 'A third option', sublabel: 'Extra context for this choice' },
];

export function makeRadioOptionGroupProps(
  overrides: Partial<RadioOptionGroupProps<ThreeWayScope>> = {},
): RadioOptionGroupProps<ThreeWayScope> {
  return {
    options: THREE_OPTIONS,
    value: 'replace',
    onChange: () => {},
    ...overrides,
  };
}
