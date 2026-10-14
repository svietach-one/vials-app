/**
 * Component tests — `RadioOptionGroup` (ui/forms), the shared always-visible
 * radio list introduced to replace per-file N-button clusters.
 * Spec: docs/specs/multi-action-radio-picker.md
 * Tech design: docs/tech-design/multi-action-radio-picker.md §2, §3 FE-1
 *
 * RadioOptionGroup does not exist yet — this file fails to resolve until the
 * engineer creates src/components/ui/forms/RadioOptionGroup.tsx per the
 * contract documented in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { makeRadioOptionGroupProps, THREE_OPTIONS } from './fixtures';

import { RadioOptionGroup } from '@/components/ui/forms/RadioOptionGroup';

describe('rendering every option', () => {
  it('renders one row per option with its label visible', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />);

    expect(screen.getByText('Replace')).toBeTruthy();
    expect(screen.getByText('Keep both')).toBeTruthy();
    expect(screen.getByText('A third option')).toBeTruthy();
  });

  it('renders an option sublabel as its own visible text when provided', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />);

    expect(screen.getByText('Extra context for this choice')).toBeTruthy();
  });

  it('renders sublabel text only for the option that provides one', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />);

    // "Replace" and "Keep both" have no sublabel in the fixture — only "A
    // third option" should produce the extra descriptive text node.
    expect(screen.getAllByText(/Extra context/).length).toBe(1);
  });
});

describe('accessibility roles and state', () => {
  it('exposes the container as a radiogroup', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />);

    expect(screen.getByRole('radiogroup')).toBeTruthy();
  });

  it('exposes every row as a radio, named by its label', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />);

    THREE_OPTIONS.forEach((option) => {
      expect(screen.getByRole('radio', { name: option.label })).toBeTruthy();
    });
  });

  it('marks only the row whose value matches the `value` prop as checked', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps({ value: 'keep_both' })} />);

    expect(screen.getByRole('radio', { name: 'Replace' }).props.accessibilityState.checked).toBe(
      false,
    );
    expect(
      screen.getByRole('radio', { name: 'Keep both' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole('radio', { name: 'A third option' }).props.accessibilityState.checked,
    ).toBe(false);
  });

  it('moves the checked row when the controlling `value` prop changes', () => {
    const { rerender } = render(<RadioOptionGroup {...makeRadioOptionGroupProps({ value: 'replace' })} />);
    expect(screen.getByRole('radio', { name: 'Replace' }).props.accessibilityState.checked).toBe(
      true,
    );

    rerender(<RadioOptionGroup {...makeRadioOptionGroupProps({ value: 'extra' })} />);

    expect(screen.getByRole('radio', { name: 'Replace' }).props.accessibilityState.checked).toBe(
      false,
    );
    expect(
      screen.getByRole('radio', { name: 'A third option' }).props.accessibilityState.checked,
    ).toBe(true);
  });
});

describe('selecting an option', () => {
  it('calls onChange with the tapped option value', () => {
    const onChange = jest.fn();
    render(<RadioOptionGroup {...makeRadioOptionGroupProps({ value: 'replace', onChange })} />);

    fireEvent.press(screen.getByRole('radio', { name: 'Keep both' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('keep_both');
  });

  it('calls onChange with no other option’s value when a different row is tapped', () => {
    const onChange = jest.fn();
    render(<RadioOptionGroup {...makeRadioOptionGroupProps({ value: 'replace', onChange })} />);

    fireEvent.press(screen.getByRole('radio', { name: 'A third option' }));

    expect(onChange).toHaveBeenCalledWith('extra');
    expect(onChange).not.toHaveBeenCalledWith('replace');
    expect(onChange).not.toHaveBeenCalledWith('keep_both');
  });

  it('never calls onChange merely from rendering, before any tap', () => {
    const onChange = jest.fn();
    render(<RadioOptionGroup {...makeRadioOptionGroupProps({ onChange })} />);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('testID passthrough', () => {
  it('applies the given testID to the radiogroup container', () => {
    render(<RadioOptionGroup {...makeRadioOptionGroupProps({ testID: 'scope-picker' })} />);

    expect(screen.getByTestId('scope-picker')).toBeTruthy();
  });

  it('renders without a testID when none is given', () => {
    // Must not throw / must not require testID — it is optional per the
    // tech design §2 prop shape.
    expect(() => render(<RadioOptionGroup {...makeRadioOptionGroupProps()} />)).not.toThrow();
  });
});
