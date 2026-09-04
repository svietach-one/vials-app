/**
 * Component tests — Story 1 ACs 1-3: the shared `BottomSheet` DS component's
 * backdrop/hardware-back dismissal and safe-area-insets-driven bottom
 * padding.
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 1
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md (FE-1)
 *
 * `BottomSheet` already exists (plain RN Modal, static bottom padding
 * token) — FE-1 replaces the static padding with `useSafeAreaInsets()`.
 * AC1/AC2 (dismiss behavior) already hold against today's implementation;
 * AC3 (insets-driven padding) is expected to FAIL until FE-1 lands. Two
 * test-only testIDs (bottomsheet-backdrop, bottomsheet-surface) are required
 * per fixtures.ts's binding contract — see that file's header for why.
 *
 * Mock strategy: only the native/heavy boundary is mocked
 * (react-native-safe-area-context) per .claude/rules/testing.md. Nothing
 * else — BottomSheet's only other dependencies (Icon, IconButton) are plain
 * DS components, not native modules.
 */
import React from 'react';
import { Modal, StyleSheet, Text } from 'react-native';
import { render, screen, fireEvent, cleanup } from '@testing-library/react-native';

import { BottomSheet } from '@/components/ui/core/BottomSheet';
import { BOTTOMSHEET_CONTENT_MARKER, makeBottomSheetProps } from './fixtures';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

afterEach(cleanup);

function renderSheet(overrides: Parameters<typeof makeBottomSheetProps>[0] = {}) {
  return render(
    <BottomSheet {...makeBottomSheetProps(overrides)}>
      <Text>{BOTTOMSHEET_CONTENT_MARKER}</Text>
    </BottomSheet>,
  );
}

describe('Story 1 AC1: dismissOnBackdrop omitted/true — backdrop tap and Android back close the sheet', () => {
  it('fires onClose when the backdrop is tapped and dismissOnBackdrop is omitted', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when the backdrop is tapped and dismissOnBackdrop is explicitly true', () => {
    const onClose = jest.fn();
    renderSheet({ onClose, dismissOnBackdrop: true });

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when the Android hardware back button (Modal onRequestClose) is pressed', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });

    const modal = screen.UNSAFE_getByType(Modal);
    modal.props.onRequestClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Story 1 AC2: dismissOnBackdrop=false — backdrop tap and Android back are no-ops', () => {
  it('does not call onClose when the backdrop is tapped', () => {
    const onClose = jest.fn();
    renderSheet({ onClose, dismissOnBackdrop: false });

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when the Android hardware back button is pressed', () => {
    const onClose = jest.fn();
    renderSheet({ onClose, dismissOnBackdrop: false });

    const modal = screen.UNSAFE_getByType(Modal);
    // onRequestClose must still be a callable no-op, not undefined —
    // Android invokes it unconditionally on back-press regardless of props.
    expect(() => modal.props.onRequestClose()).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the sheet only closes via an explicit consumer action — content stays mounted after a no-op backdrop tap', () => {
    renderSheet({ dismissOnBackdrop: false });

    fireEvent.press(screen.getByTestId('bottomsheet-backdrop'));

    expect(screen.getByText(BOTTOMSHEET_CONTENT_MARKER)).toBeTruthy();
  });
});

describe('Story 1 AC3: bottom padding reflects the device\'s actual safe-area inset, not a fixed token', () => {
  it('increases the sheet surface\'s paddingBottom by exactly the inset delta between two different bottom insets', () => {
    const { SafeAreaProvider } = require('react-native-safe-area-context');

    const FRAME = { width: 320, height: 640, x: 0, y: 0 };

    const { unmount: unmountZero } = render(
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <BottomSheet {...makeBottomSheetProps()}>
          <Text>{BOTTOMSHEET_CONTENT_MARKER}</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
    const surfaceZeroInset = screen.getByTestId('bottomsheet-surface');
    const paddingBottomZeroInset = StyleSheet.flatten(surfaceZeroInset.props.style).paddingBottom;
    unmountZero();

    render(
      <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}>
        <BottomSheet {...makeBottomSheetProps()}>
          <Text>{BOTTOMSHEET_CONTENT_MARKER}</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
    const surfaceWithInset = screen.getByTestId('bottomsheet-surface');
    const paddingBottomWithInset = StyleSheet.flatten(surfaceWithInset.props.style).paddingBottom;

    expect(typeof paddingBottomZeroInset).toBe('number');
    expect(paddingBottomWithInset - paddingBottomZeroInset).toBe(34);
  });

  it('applies safe-area padding with no per-consumer inset prop — the sheet reads insets itself', () => {
    // makeBottomSheetProps() carries no inset-related prop at all; if the
    // component required one, this render would be missing required data.
    // Assert it renders successfully and the surface still carries a
    // numeric paddingBottom sourced from the (mocked, zero-by-default)
    // safe-area context with zero consumer-supplied configuration.
    renderSheet();

    const surface = screen.getByTestId('bottomsheet-surface');
    const paddingBottom = StyleSheet.flatten(surface.props.style).paddingBottom;

    expect(typeof paddingBottom).toBe('number');
  });
});
