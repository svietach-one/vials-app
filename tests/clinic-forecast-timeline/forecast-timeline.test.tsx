/**
 * Component tests — ForecastTimeline (clinic-forecast-timeline)
 *
 * Spec:        docs/specs/clinic-forecast-timeline.md
 * Tech design: docs/tech-design/clinic-forecast-timeline.md
 *
 * These tests import the real `ForecastTimeline` component, which does not
 * exist yet (src/components/clinic/ForecastTimeline.tsx). They will fail to
 * resolve the import until the engineer creates it — that is expected,
 * tests-first. See progress/clinic-forecast-timeline.md for the log entry.
 *
 * See fixtures.ts for the full testID/accessibility contract this suite
 * asserts against.
 *
 * Story -> AC coverage:
 *   Story 1 (12-month window, current marked)      -> describe block 1
 *   Story 2 (Cobalt+Amber track, custom procedure,
 *            clip vs. drop at window edges)          -> describe block 2
 *   Story 3 (tap fires onSelectProcedure,
 *            accessibility role/label)                -> describe block 3
 *   Story 4 (archived excluded, defensive)            -> describe block 4
 *   Story 5 (overlap stacking)                        -> describe block 5
 *   Story 6 (English text, no conflict-warning copy)  -> describe block 6
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';

import { ForecastTimeline } from '@/components/clinic/ForecastTimeline';
import { getProcedureDisplayName } from '@/utils/procedureLifespanHelpers';
import {
  NOW,
  BOTOX_ACTIVE,
  FILLERS_OVERLAP,
  SMAS_OVERLAP,
  MECHANICAL_EARLY,
  FILLERS_LATE,
  OUTSIDE_WINDOW,
  CLIPPED_AT_START,
  CLIPPED_AT_END,
  ARCHIVED_PROC,
  CUSTOM_PROC,
  makeForecastTimelineProps,
} from './fixtures';

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Story 1: centered 12-month window, current month marked ──────────────────

describe('Story 1: 12-month window centered on `now`', () => {
  it('renders exactly 12 month columns for a fixed injected `now`', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ now: NOW })} />);

    for (let i = 0; i < 12; i += 1) {
      expect(screen.getByTestId(`forecast-month-${i}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('forecast-month-12')).toBeNull();
  });

  it('marks only the current month (index 6: Jul 2026) as selected', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ now: NOW })} />);

    const current = screen.getByTestId('forecast-month-6');
    expect(current.props.accessibilityState?.selected).toBe(true);
    expect(current.props.accessibilityLabel).toContain('2026');

    for (const i of [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
      const column = screen.getByTestId(`forecast-month-${i}`);
      expect(column.props.accessibilityState?.selected).not.toBe(true);
    }
  });

  it('labels the 6 preceding columns Jan through Jun 2026', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ now: NOW })} />);

    const expectedLabels = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026'];
    expectedLabels.forEach((label, i) => {
      expect(screen.getByTestId(`forecast-month-${i}`).props.accessibilityLabel).toBe(label);
    });
  });

  it('labels the 5 following columns Aug through Dec 2026', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ now: NOW })} />);

    const expectedLabels = ['Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026'];
    expectedLabels.forEach((label, i) => {
      expect(screen.getByTestId(`forecast-month-${i + 7}`).props.accessibilityLabel).toBe(label);
    });
  });
});

// ── Story 2: full-lifecycle track, reusing existing phase math ───────────────

describe('Story 2: full-lifecycle track per procedure', () => {
  it('renders a Cobalt segment and an Amber segment for an in-window procedure', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE], now: NOW })} />);

    expect(screen.getByTestId(`forecast-segment-${BOTOX_ACTIVE.id}-cobalt`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-segment-${BOTOX_ACTIVE.id}-amber`)).toBeTruthy();
  });

  it('renders the same 2-segment semantics for a custom procedure', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [CUSTOM_PROC], now: NOW })} />);

    expect(screen.getByTestId(`forecast-track-${CUSTOM_PROC.id}`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-segment-${CUSTOM_PROC.id}-cobalt`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-segment-${CUSTOM_PROC.id}-amber`)).toBeTruthy();
  });

  it('renders no track for a procedure entirely outside the 12-month window', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [OUTSIDE_WINDOW], now: NOW })} />);

    expect(screen.queryByTestId(`forecast-track-${OUTSIDE_WINDOW.id}`)).toBeNull();
  });

  it('still renders a clipped track for a procedure that starts before the window', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [CLIPPED_AT_START], now: NOW })} />);

    expect(screen.getByTestId(`forecast-track-${CLIPPED_AT_START.id}`)).toBeTruthy();
  });

  it('still renders a clipped track for a procedure that ends after the window', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [CLIPPED_AT_END], now: NOW })} />);

    expect(screen.getByTestId(`forecast-track-${CLIPPED_AT_END.id}`)).toBeTruthy();
  });
});

// ── Story 3: tap a track to jump to its card ──────────────────────────────────

describe('Story 3: tap a track fires onSelectProcedure', () => {
  it('calls onSelectProcedure with the procedure id when its track is tapped', () => {
    const onSelectProcedure = jest.fn();
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE], onSelectProcedure, now: NOW })}
      />,
    );

    fireEvent.press(screen.getByTestId(`forecast-track-${BOTOX_ACTIVE.id}`));

    expect(onSelectProcedure).toHaveBeenCalledTimes(1);
    expect(onSelectProcedure).toHaveBeenCalledWith(BOTOX_ACTIVE.id);
  });

  it('exposes accessibilityRole="button" and a label naming the procedure and its phase', () => {
    render(<ForecastTimeline {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE], now: NOW })} />);

    const track = screen.getByTestId(`forecast-track-${BOTOX_ACTIVE.id}`);
    expect(track.props.accessibilityRole).toBe('button');
    expect(track.props.accessibilityLabel).toContain(getProcedureDisplayName(BOTOX_ACTIVE));
    expect(track.props.accessibilityLabel).toMatch(/active|fading|rehab|completed/i);
  });
});

// ── Story 4 (defensive/component half): archived procedures excluded ─────────

describe('Story 4: archived procedures never produce a track', () => {
  it('renders no track for an archived procedure even when passed directly', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [ARCHIVED_PROC, BOTOX_ACTIVE], now: NOW })}
      />,
    );

    expect(screen.queryByTestId(`forecast-track-${ARCHIVED_PROC.id}`)).toBeNull();
    expect(screen.getByTestId(`forecast-track-${BOTOX_ACTIVE.id}`)).toBeTruthy();
  });
});

// ── Story 5: overlapping procedures stack onto separate rows ─────────────────

describe('Story 5: overlap handling', () => {
  it('places two time-overlapping procedures in two different rows', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE, FILLERS_OVERLAP], now: NOW })}
      />,
    );

    const rows = screen.getAllByTestId(/^forecast-row-\d+$/);
    const rowsContainingBotox = rows.filter(
      (row) => within(row).queryByTestId(`forecast-track-${BOTOX_ACTIVE.id}`) !== null,
    );
    const rowsContainingFillers = rows.filter(
      (row) => within(row).queryByTestId(`forecast-track-${FILLERS_OVERLAP.id}`) !== null,
    );

    expect(rowsContainingBotox).toHaveLength(1);
    expect(rowsContainingFillers).toHaveLength(1);
    expect(rowsContainingBotox[0].props.testID).not.toBe(rowsContainingFillers[0].props.testID);
  });

  it('gives three mutually-overlapping procedures three distinct rows, none hidden', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({
          procedures: [BOTOX_ACTIVE, FILLERS_OVERLAP, SMAS_OVERLAP],
          now: NOW,
        })}
      />,
    );

    expect(screen.getByTestId(`forecast-track-${BOTOX_ACTIVE.id}`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-track-${FILLERS_OVERLAP.id}`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-track-${SMAS_OVERLAP.id}`)).toBeTruthy();

    const rows = screen.getAllByTestId(/^forecast-row-\d+$/);
    const rowIdsUsed = new Set(
      [BOTOX_ACTIVE, FILLERS_OVERLAP, SMAS_OVERLAP].map((proc) => {
        const owningRow = rows.find((row) => within(row).queryByTestId(`forecast-track-${proc.id}`) !== null);
        return owningRow?.props.testID;
      }),
    );
    expect(rowIdsUsed.size).toBe(3);
  });

  it('still renders both tracks for two non-overlapping procedures', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [MECHANICAL_EARLY, FILLERS_LATE], now: NOW })}
      />,
    );

    expect(screen.getByTestId(`forecast-track-${MECHANICAL_EARLY.id}`)).toBeTruthy();
    expect(screen.getByTestId(`forecast-track-${FILLERS_LATE.id}`)).toBeTruthy();
  });
});

// ── Story 6: design-system and copy constraints ───────────────────────────────

describe('Story 6: design-system and copy constraints', () => {
  it('renders month labels and track accessibility labels as English text', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE], now: NOW })}
      />,
    );

    expect(screen.getByTestId('forecast-month-6').props.accessibilityLabel).toMatch(/^[A-Za-z0-9\s]+$/);
    expect(screen.getByTestId(`forecast-track-${BOTOX_ACTIVE.id}`).props.accessibilityLabel).toMatch(
      /^[A-Za-z0-9\s/,.\-?]+$/,
    );
  });

  it('renders no ingredient-conflict warning copy on the ribbon', () => {
    render(
      <ForecastTimeline
        {...makeForecastTimelineProps({ procedures: [BOTOX_ACTIVE], now: NOW })}
      />,
    );

    expect(screen.queryByText(/conflict/i)).toBeNull();
  });
});
