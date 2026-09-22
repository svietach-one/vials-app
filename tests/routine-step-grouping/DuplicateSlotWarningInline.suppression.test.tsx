/**
 * Component tests — duplicate-slot suppression by zones/timing (US-35, Phase 6).
 * Spec: docs/specs/routine-step-grouping/SCREENS.md §6.5,
 *       docs/specs/routine-step-grouping/USER_STORIES.md US-35
 *
 * DuplicateSlotWarningInline already exists (routine-similar-product-priority)
 * with props { routines, products, onPressGroup } — this suite reuses that
 * exact shape and does not change it. What's new here is behavioural: today
 * `findSlotDuplicateGroups` groups purely by LAYERING_ORDER slot index and
 * ignores `products` (`void products;` in the component). Phase 6 requires
 * the warning to be SUPPRESSED for a same-slot pair that differs by `zones`
 * or by `timing`, and still SHOWN for a same-slot, same-zone, same-timing,
 * both-`inline` pair. These tests are red against the current shipped
 * component and green once Phase 6 lands — expected (tests-first).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Routine } from '@/types';

import { makeProduct, makeRoutine, makeStep } from './fixtures';
import { DuplicateSlotWarningInline } from '@/components/routine/DuplicateSlotWarningInline';

// Both `cream`, LAYERING_ORDER slot 11 — differ by zones only.
const FACE_CREAM_PLAIN = makeProduct({ id: 'p-face-cream', name: 'Face Cream', productType: 'cream' });
const NECK_CREAM_ZONED = makeProduct({ id: 'p-neck-cream', name: 'Neck Cream', productType: 'cream', zones: ['neck'] });

// Both `spf`, LAYERING_ORDER slot 13 — differ by timing only.
const SPF_INLINE = makeProduct({ id: 'p-spf-inline', name: 'SPF Cream', productType: 'spf' });
const SPF_REAPPLY = makeProduct({
  id: 'p-spf-reapply',
  name: 'SPF Stick',
  productType: 'spf',
  timing: 'reapply',
  reapplyAfterHours: 2,
});

// Both `serum`, LAYERING_ORDER slot 6 — same zone (default), same timing (inline).
// Both carry an active tag (routine-step-grouping polish round 3, Change 1
// addendum: the banner now also requires every group member to have one) so
// this suite keeps testing what it's named for — zone/timing suppression —
// without tripping the unrelated active-ingredient gate.
const SERUM_ONE = makeProduct({ id: 'p-serum-one', name: 'Serum One', productType: 'serum', activeTags: ['niacinamide'] });
const SERUM_TWO = makeProduct({ id: 'p-serum-two', name: 'Serum Two', productType: 'serum', activeTags: ['niacinamide'] });

function renderWarning(routine: Routine, products: ReturnType<typeof makeProduct>[]) {
  return render(
    <DuplicateSlotWarningInline routines={[routine]} products={products} onPressGroup={() => {}} />,
  );
}

describe('US-35: suppressed when the pair differs by zones', () => {
  it('renders nothing for a face cream + a neck cream sharing the cream slot', () => {
    const routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'cream', productId: FACE_CREAM_PLAIN.id }),
        makeStep({ productType: 'cream', productId: NECK_CREAM_ZONED.id }),
      ],
    });
    const { toJSON } = renderWarning(routine, [FACE_CREAM_PLAIN, NECK_CREAM_ZONED]);
    expect(toJSON()).toBeNull();
  });
});

describe('US-35: suppressed when the pair differs by timing', () => {
  it('renders nothing for an SPF cream + an SPF reapply stick sharing the spf slot', () => {
    const routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'spf', productId: SPF_INLINE.id }),
        makeStep({ productType: 'spf', productId: SPF_REAPPLY.id }),
      ],
    });
    const { toJSON } = renderWarning(routine, [SPF_INLINE, SPF_REAPPLY]);
    expect(toJSON()).toBeNull();
  });
});

describe('US-35: still shown for two same-zone, same-timing, inline products in one slot', () => {
  it('renders the warning for two plain serums sharing the serum slot', () => {
    const routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'serum', productId: SERUM_ONE.id }),
        makeStep({ productType: 'serum', productId: SERUM_TWO.id }),
      ],
    });
    renderWarning(routine, [SERUM_ONE, SERUM_TWO]);
    expect(screen.getByText(/2 similar products \(serums\) in this routine/i)).toBeTruthy();
  });
});

describe('US-35 negative: DuplicateSlotResolutionSheet must never open for a suppressed pair', () => {
  it('renders no pressable duplicate-warning row when the only same-slot pair is suppressed', () => {
    const routine = makeRoutine({
      id: 'routine-am',
      timeOfDay: 'morning',
      steps: [
        makeStep({ productType: 'cream', productId: FACE_CREAM_PLAIN.id }),
        makeStep({ productType: 'cream', productId: NECK_CREAM_ZONED.id }),
      ],
    });
    renderWarning(routine, [FACE_CREAM_PLAIN, NECK_CREAM_ZONED]);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
