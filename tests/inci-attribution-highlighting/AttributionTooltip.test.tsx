/**
 * Component tests — AttributionTooltip (FE-3).
 * Spec: docs/specs/inci-attribution-highlighting.md — Story 1 (all 4 ACs).
 * Tech design: docs/tech-design/inci-attribution-highlighting.md §2 (AttributionTooltipProps).
 *
 * This component does not exist yet — src/components/routine/AttributionTooltip.tsx
 * is created by the engineer (FE-3). This file is written test-first; it is
 * EXPECTED to fail to resolve/compile until FE-3 lands. See fixtures.ts for the
 * binding testID contract the engineer must implement against.
 *
 * Out of scope (do not add assertions here): Story 2 "View on label" button,
 * any image/bounding-box rendering — those are BLOCKED per the spec's open
 * question and have no implementation tasks in this task's tech design.
 *
 * Note: this repo has no jest-native (`toHaveTextContent`/`toHaveProp`)
 * dependency — content is asserted via `screen.getByText`/`.props.*` per
 * `.claude/rules/testing.md` conventions (see product-shelf-card tests).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { AttributionTooltip } from '@/components/routine/AttributionTooltip';
import {
  makeAttributionTooltipProps,
  BHA_SALICYLIC_ACID_MATCH,
  BHA_BETAINE_SALICYLATE_MATCH,
  BHA_WILLOW_BARK_MATCH,
} from './fixtures';

function renderTooltip(overrides: Partial<ReturnType<typeof makeAttributionTooltipProps>> = {}) {
  const props = { ...makeAttributionTooltipProps(), ...overrides };
  render(<AttributionTooltip {...props} />);
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Story 1 AC1: literal matched text + canonical label ──────────────────────

describe('Story 1 AC1 — literal matched text shown alongside the canonical label', () => {
  it('renders the canonical displayName in the header', () => {
    renderTooltip({ displayName: 'BHA (Salicylic Acid)', matches: [BHA_BETAINE_SALICYLATE_MATCH] });
    expect(screen.getByTestId('attribution-tooltip-header')).toBeTruthy();
    expect(screen.getByText('BHA (Salicylic Acid)')).toBeTruthy();
  });

  it('renders the literal matched substring in quotes for a single match', () => {
    renderTooltip({ matches: [BHA_BETAINE_SALICYLATE_MATCH] });
    expect(screen.getByTestId('attribution-match-text-0')).toBeTruthy();
    expect(screen.getByText(/"Betaine Salicylate"/)).toBeTruthy();
  });

  it('does not render the tooltip at all when visible is false', () => {
    renderTooltip({ visible: false });
    expect(screen.queryByTestId('attribution-tooltip')).toBeNull();
  });
});

// ── Story 1 AC2: alias override micro-copy ────────────────────────────────────

describe('Story 1 AC2 — registered alias override shows its own micro-copy', () => {
  it('shows the override micro-copy instead of generic class copy for betaine salicylate', () => {
    renderTooltip({ matches: [BHA_BETAINE_SALICYLATE_MATCH] });
    expect(screen.getByText(/gentle Korean form of BHA/i)).toBeTruthy();
  });

  it('shows the override micro-copy for the willow bark / salix alba alias', () => {
    renderTooltip({ matches: [BHA_WILLOW_BARK_MATCH] });
    expect(screen.getByText(/natural, plant-derived source/i)).toBeTruthy();
  });
});

// ── Story 1 AC3: fallback to generic class copy when no override exists ──────

describe('Story 1 AC3 — no override registered falls back silently to generic copy', () => {
  it('renders non-empty generic copy for a matcher with no alias override', () => {
    renderTooltip({ matches: [BHA_SALICYLIC_ACID_MATCH] });
    const copy = screen.getByTestId('attribution-match-copy-0');
    expect(copy.props.children).toBeTruthy();
  });

  it('never shows the override-specific micro-copy for a non-aliased matcher', () => {
    renderTooltip({ matches: [BHA_SALICYLIC_ACID_MATCH] });
    expect(screen.queryByText(/gentle Korean form of BHA/i)).toBeNull();
    expect(screen.queryByText(/natural, plant-derived source/i)).toBeNull();
  });

  it('never renders a raw error or blank body when matches is empty', () => {
    renderTooltip({ matches: [] });
    expect(screen.getByTestId('attribution-no-matches')).toBeTruthy();
    expect(screen.queryByText(/error/i)).toBeNull();
  });

  it('still shows the class displayName when matches is empty', () => {
    renderTooltip({ displayName: 'BHA (Salicylic Acid)', matches: [] });
    expect(screen.getByText('BHA (Salicylic Acid)')).toBeTruthy();
  });
});

// ── Story 1 AC4: multiple matchers of the same class all listed ──────────────

describe('Story 1 AC4 — multiple matched substrings for one class are all listed', () => {
  it('renders one row per match, not just the strongest-potency one', () => {
    renderTooltip({ matches: [BHA_SALICYLIC_ACID_MATCH, BHA_WILLOW_BARK_MATCH] });
    expect(screen.getByText(/"Salicylic Acid"/)).toBeTruthy();
    expect(screen.getByText(/"Willow Bark"/)).toBeTruthy();
  });

  it('applies override copy only to the aliased row when mixed with a canonical-term row', () => {
    renderTooltip({ matches: [BHA_SALICYLIC_ACID_MATCH, BHA_BETAINE_SALICYLATE_MATCH] });
    expect(screen.getByTestId('attribution-match-copy-1')).toBeTruthy();
    expect(screen.getByText(/gentle Korean form of BHA/i)).toBeTruthy();
    expect(screen.queryByTestId('attribution-no-matches')).toBeNull();
  });
});

// ── Dismiss behaviour (spec §5, "same pattern as existing sheets") ───────────

describe('Dismiss behaviour', () => {
  it('calls onClose when the close button is pressed', () => {
    const props = renderTooltip();
    fireEvent.press(screen.getByLabelText('Close'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is pressed', () => {
    const props = renderTooltip();
    fireEvent.press(screen.getByTestId('attribution-tooltip-backdrop'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
