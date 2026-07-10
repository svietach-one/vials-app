/**
 * Integration tests — Story 3 UI ACs: symptom preset tiles and the
 * mandatory-recovery-window inline validation.
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 3
 *
 * FE-9 shipped AddProcedureModal's symptom presets (progress/routine-engine.md,
 * 2026-07-05 "SURROUNDING UX" entry).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null })),
}));

import { AddProcedureModal } from '@/components/clinic/AddProcedureModal';

function renderModal() {
  return render(
    <AddProcedureModal visible procedures={[]} onClose={jest.fn()} onSave={jest.fn()} />,
  );
}

function selectCustomProcedure() {
  fireEvent.press(screen.getByText('Custom Procedure'));
}

/**
 * Presses the footer submit button. The modal's header title is also
 * literally "Log Procedure", and this project's installed
 * @testing-library/react-native + react-test-renderer combination only
 * surfaces ONE of the two identical-text nodes via getByText/getAllByText
 * (verified independently: screen.toJSON() contains both, UNSAFE_getAllByProps
 * finds both, but the accessibility-tree-based getByText query does not) — an
 * environment quirk, not a component bug. UNSAFE_getAllByProps bypasses that
 * query layer entirely and reliably returns both Text nodes in document
 * order, so the last one is the footer submit button.
 */
function pressLogProcedure() {
  const nodes = screen.UNSAFE_getAllByProps({ children: 'Log Procedure' });
  fireEvent.press(nodes[nodes.length - 1]);
}

describe('Story 3 AC: exactly four recovery-window presets render for a custom procedure', () => {
  it('renders Light Care / Redness-Peeling / Trauma-Laser / Custom, and only for the custom procedure type', () => {
    renderModal();
    // Not visible before "Custom Procedure" is selected (botox is default).
    expect(screen.queryByText('Light Care')).toBeNull();

    selectCustomProcedure();

    expect(screen.getByText('Light Care')).toBeTruthy();
    expect(screen.getByText('Redness / Peeling')).toBeTruthy();
    expect(screen.getByText('Trauma / Laser')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
  });
});

describe('Story 3 AC: saving a custom procedure with no recovery window given is blocked', () => {
  it('shows an inline validation message when neither a preset nor an estimated return date is set', () => {
    const onSave = jest.fn();
    render(<AddProcedureModal visible procedures={[]} onClose={jest.fn()} onSave={onSave} />);

    selectCustomProcedure();
    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'e.g. Laser Resurfacing' }),
      'Microneedling',
    );
    pressLogProcedure();

    expect(
      screen.getByText('Choose a recovery preset or set the estimated return date'),
    ).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves successfully once a preset resolves the recovery window', () => {
    const onSave = jest.fn();
    render(<AddProcedureModal visible procedures={[]} onClose={jest.fn()} onSave={onSave} />);

    selectCustomProcedure();
    fireEvent.changeText(
      screen.UNSAFE_getByProps({ placeholder: 'e.g. Laser Resurfacing' }),
      'Microneedling',
    );
    fireEvent.press(screen.getByText('Redness / Peeling'));
    pressLogProcedure();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ procedureKey: 'custom', customRehabDays: 3, status: 'rehab' }),
    );
  });
});
