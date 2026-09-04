/**
 * Component tests — ProductInsightsPanel (Product Profile Milestone 1).
 * docs/specs/2026-08-05-product-profile-m1.md, docs/tech-design/product-profile-m1.md FE-8.
 *
 * The component and its prop contract (`ProductInsightsPanelProps`) do not
 * exist yet. This suite defines the expected contract for the engineer to
 * implement against: a presentational component that receives an
 * already-built `profile: ProductProfile` (built upstream by
 * `ProductDetailScreen` via `buildProductProfileFromProduct`, per
 * tech-design FE-8's `useMemo` note) plus an optional `isLoading` flag for
 * the skeleton state (spec §5).
 *
 * Deliberately renders the panel directly from hand-built `ProductProfile`
 * fixtures (see `./fixtures.ts`) rather than through the builder pipeline —
 * that pipeline is covered end-to-end by
 * `productProfileBuilder.integration.test.ts`. This file is only concerned
 * with "given this profile shape, does the panel render the right thing."
 *
 * Covers:
 *   AC-1 (Story 1 AC1)  Populated profile renders capability badges for
 *                        Barrier Repair when its score is present/positive.
 *   AC-2 (Story 1 AC2)  Insufficient-data profile (zero resolved active
 *                        classes) renders the explicit "not enough
 *                        ingredient data" state — never a blank panel.
 *   AC-3 (Story 1 AC3)  A capability scored a real deterministic `0` never
 *                        renders as a badge (badges are a positive claim,
 *                        not a "we checked and it's true" indicator).
 *   AC-4              No badge renders for any of the 8 not-yet-modeled
 *                        capabilities (`score: null`, `confidence:
 *                        'insufficient_data'`) in Milestone 1, regardless of
 *                        how populated the rest of the profile is.
 *   Note: `overallConfidence` is `'insufficient_data'` on BOTH the populated
 *   and the empty fixture this milestone (see fixtures.ts comment on
 *   `makeProductProfile` / the integration suite's AC-9) — these tests
 *   therefore deliberately do NOT assume the component branches on
 *   `profile.overallConfidence` to pick its empty-state vs. populated-state
 *   rendering; only end-to-end rendered output is asserted.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ProductInsightsPanel } from '@/components/product/ProductInsightsPanel';
import {
  makeEmptyCapabilities,
  makeInsufficientCapability,
  makePopulatedProfile,
  makeProductProfile,
} from './fixtures';

// ── AC-1 — populated state ──────────────────────────────────────────────────

describe('ProductInsightsPanel — populated profile', () => {
  it('renders a Barrier Repair badge when the capability score is present and positive', () => {
    render(<ProductInsightsPanel profile={makePopulatedProfile()} />);

    expect(screen.getByText(/barrier repair/i)).toBeTruthy();
  });

  it('does not render an Exfoliation badge when the score is a real deterministic 0 (AC-3)', () => {
    render(<ProductInsightsPanel profile={makePopulatedProfile()} />);

    expect(screen.queryByText(/exfoliation/i)).toBeNull();
  });

  it('does not render the insufficient-data empty state for a populated profile', () => {
    render(<ProductInsightsPanel profile={makePopulatedProfile()} />);

    expect(screen.queryByText(/not enough ingredient data/i)).toBeNull();
  });

  it('renders an eligible-period indicator for the resolved routine position', () => {
    render(<ProductInsightsPanel profile={makePopulatedProfile()} />);

    // eligiblePeriods: ['AM', 'PM'] on the populated fixture.
    expect(screen.getByText(/\bam\b/i)).toBeTruthy();
  });
});

// ── AC-2 — insufficient-data empty state ────────────────────────────────────

describe('ProductInsightsPanel — insufficient-data state (zero resolved active classes)', () => {
  const emptyProfile = makeProductProfile({
    resolvedActiveKeys: [],
    unresolvedIngredientTokens: [],
    capabilities: makeEmptyCapabilities(),
  });

  it('shows the explicit "not enough ingredient data" state, never a blank panel', () => {
    render(<ProductInsightsPanel profile={emptyProfile} />);

    expect(screen.getByText(/not enough ingredient data/i)).toBeTruthy();
  });

  it('renders no Barrier Repair or Exfoliation badge when both are null/insufficient_data', () => {
    render(<ProductInsightsPanel profile={emptyProfile} />);

    expect(screen.queryByText(/barrier repair/i)).toBeNull();
    expect(screen.queryByText(/exfoliation/i)).toBeNull();
  });
});

// ── AC-4 — no badge for null/insufficient_data capabilities ─────────────────

describe('ProductInsightsPanel — capabilities not modeled in Milestone 1', () => {
  it('never renders a badge for any of the 8 not-yet-modeled capability keys, even on a populated profile', () => {
    render(<ProductInsightsPanel profile={makePopulatedProfile()} />);

    const notModeledLabels = [
      /hydration/i,
      /brightening/i,
      /pigmentation/i,
      /acne control/i,
      /sebum regulation/i,
      /antioxidant/i,
      /soothing/i,
      /anti-?aging/i,
    ];
    for (const label of notModeledLabels) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('renders no badge for a capability explicitly scored null within an otherwise-populated profile', () => {
    const profile = makePopulatedProfile({
      capabilities: {
        ...makePopulatedProfile().capabilities,
        barrierRepair: makeInsufficientCapability(),
      },
    });

    render(<ProductInsightsPanel profile={profile} />);

    expect(screen.queryByText(/barrier repair/i)).toBeNull();
  });
});

// ── Loading state (spec §5 — must exist for consistency, even though the ──
// ── build is synchronous/near-instant) ──────────────────────────────────────

describe('ProductInsightsPanel — loading state', () => {
  it('does not render the insufficient-data copy while isLoading is true', () => {
    render(<ProductInsightsPanel profile={makeProductProfile()} isLoading />);

    // Whatever skeleton markup is used, the panel must not simultaneously
    // claim "not enough data" while still loading — that message is reserved
    // for a settled, empty profile.
    expect(screen.queryByText(/not enough ingredient data/i)).toBeNull();
  });
});
