/**
 * Component tests — CatalogFilterTrigger (FE-13-4, not yet implemented).
 * Spec: docs/specs/my-shelf-filter-bottomsheet.md — Story 1
 * Tech design: docs/tech-design/my-shelf-filter-bottomsheet.md §2 (CatalogFilterTriggerProps)
 *
 * Contract asserted here (binding on the FE-13-4 implementation, since the
 * tech design specifies the props shape but not exact accessibility copy):
 *   - Root element has accessibilityRole="button".
 *   - accessibilityLabel is "Open filters" when activeFilterCount === 0, and
 *     "Open filters, {n} active" when activeFilterCount > 0 — this makes the
 *     active-filter count discoverable to screen readers, not just sighted
 *     users via the visual badge dot.
 *   - A visual badge dot renders with testID="filter-trigger-badge" only when
 *     activeFilterCount > 0 (Story 1 AC1/AC2).
 *   - onPress fires the onPress prop exactly once per tap (Story 1 AC3 — the
 *     tap that opens the sheet).
 *
 * Until FE-13-4 lands, the import below fails with "Cannot find module" —
 * expected TDD red state, see progress/my-shelf-filter-bottomsheet.md.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CatalogFilterTrigger } from '@/components/catalog/CatalogFilterTrigger';
import { makeCatalogFilterTriggerProps } from './fixtures';

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Story 1 AC1: no badge when no filters are active ─────────────────────────

describe('FE13-CFT-1: renders with no badge when activeFilterCount is 0', () => {
  it('should expose accessibilityLabel "Open filters" with no active-count suffix', () => {
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ activeFilterCount: 0 })} />);
    expect(screen.getByLabelText('Open filters')).toBeTruthy();
  });

  it('should NOT render the badge dot', () => {
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ activeFilterCount: 0 })} />);
    expect(screen.queryByTestId('filter-trigger-badge')).toBeNull();
  });
});

// ── Story 1 AC2: badge shown once at least one filter is active ──────────────

describe('FE13-CFT-2: renders a badge indicator when activeFilterCount is greater than 0', () => {
  it('should render the badge dot when activeFilterCount is 1', () => {
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ activeFilterCount: 1 })} />);
    expect(screen.getByTestId('filter-trigger-badge')).toBeTruthy();
  });

  it('should render the badge dot when activeFilterCount is greater than 1', () => {
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ activeFilterCount: 3 })} />);
    expect(screen.getByTestId('filter-trigger-badge')).toBeTruthy();
  });

  it('should expose the active count via accessibilityLabel for screen readers', () => {
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ activeFilterCount: 2 })} />);
    expect(screen.getByLabelText('Open filters, 2 active')).toBeTruthy();
  });
});

// ── Story 1 AC3: tapping the trigger notifies the parent ─────────────────────

describe('FE13-CFT-3: tapping the trigger invokes onPress exactly once', () => {
  it('should call onPress when the trigger is tapped', () => {
    const onPress = jest.fn();
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ onPress })} />);
    fireEvent.press(screen.getByLabelText('Open filters'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should still be pressable (and call onPress) when a badge is showing', () => {
    const onPress = jest.fn();
    render(<CatalogFilterTrigger {...makeCatalogFilterTriggerProps({ onPress, activeFilterCount: 1 })} />);
    fireEvent.press(screen.getByLabelText('Open filters, 1 active'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
