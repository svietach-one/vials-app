/**
 * Component test — InfoTooltip (`src/components/ui/InfoTooltip.tsx`, new
 * shared atom introduced by explore-actives-order-info FE-1).
 * Spec: docs/specs/explore-actives-order-info.md — Story 1 AC2/AC3.
 * Tech design: docs/tech-design/explore-actives-order-info.md FE-1 — visual
 * shell reused verbatim from `src/components/routine/AttributionTooltip.tsx`
 * (backdrop `Pressable` + slide-up card + header row + close `IconButton`),
 * dropping the per-match `matches`/`getAliasMicroCopy` logic for a single
 * static `title`/`body` pair. Interaction-test pattern mirrors
 * `tests/inci-attribution-highlighting/AttributionTooltip.test.tsx`
 * (Dismiss behaviour block) — same close/backdrop contract.
 *
 * `src/components/ui/InfoTooltip.tsx` does not exist yet — every test below
 * is EXPECTED to fail to resolve/compile until FE-1 lands, same test-first
 * convention as the rest of this task's suite.
 *
 * Deliberately generic fixture title/body — this file must NOT encode
 * explore-actives-order-info's own copy (spec §5's placeholder wording);
 * that assertion belongs in DetectedActivesCard.test.tsx, the only current
 * caller. This file only proves the component itself is a faithful,
 * content-agnostic shell that renders whatever title/body it's given.
 *
 * testID contract asserted here (component doesn't exist yet — judgment
 * call, flagged for engineer/tech-lead to confirm or override, same
 * convention as this task's other new-component tests): `info-tooltip` root,
 * `info-tooltip-close` close button, `info-tooltip-backdrop` backdrop —
 * mirrors AttributionTooltip's own `attribution-tooltip` /
 * `attribution-tooltip-close` / `attribution-tooltip-backdrop` naming
 * exactly, per tech design FE-1's "reuses the shell verbatim" instruction.
 *
 * IconButton/Icon are NOT mocked here (real components used) — same
 * convention as AttributionTooltip.test.tsx, since neither is a heavy
 * native module and testID passes through IconButton's own `{...rest}`
 * spread untouched.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { InfoTooltip } from '@/components/ui/InfoTooltip';

const FIXTURE_TITLE = 'Some generic tooltip title';
const FIXTURE_BODY = 'Some generic explanatory body text, unrelated to any specific feature copy.';

function renderTooltip(overrides: Partial<React.ComponentProps<typeof InfoTooltip>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    title: FIXTURE_TITLE,
    body: FIXTURE_BODY,
    ...overrides,
  };
  render(<InfoTooltip {...props} />);
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Visibility', () => {
  it('renders nothing at all when visible is false', () => {
    renderTooltip({ visible: false });

    expect(screen.queryByTestId('info-tooltip')).toBeNull();
    expect(screen.queryByText(FIXTURE_TITLE)).toBeNull();
  });

  it('renders the root testID and the given title/body when visible is true', () => {
    renderTooltip();

    expect(screen.getByTestId('info-tooltip')).toBeTruthy();
    expect(screen.getByText(FIXTURE_TITLE)).toBeTruthy();
    expect(screen.getByText(FIXTURE_BODY)).toBeTruthy();
  });
});

describe('Arbitrary title/body props — no copy hardcoded into the component', () => {
  it('renders a completely different title/body pair unchanged, proving no static copy is baked in', () => {
    renderTooltip({
      title: 'A totally different title',
      body: 'A totally different body sentence about something else entirely.',
    });

    expect(screen.getByText('A totally different title')).toBeTruthy();
    expect(
      screen.getByText('A totally different body sentence about something else entirely.'),
    ).toBeTruthy();
    expect(screen.queryByText(FIXTURE_TITLE)).toBeNull();
  });
});

describe('Dismiss behaviour — same contract as AttributionTooltip', () => {
  it('calls onClose exactly once when the close control is pressed', () => {
    const props = renderTooltip();

    fireEvent.press(screen.getByTestId('info-tooltip-close'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once when the backdrop is pressed', () => {
    const props = renderTooltip();

    fireEvent.press(screen.getByTestId('info-tooltip-backdrop'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose merely from rendering', () => {
    const props = renderTooltip();

    expect(props.onClose).not.toHaveBeenCalled();
  });
});
