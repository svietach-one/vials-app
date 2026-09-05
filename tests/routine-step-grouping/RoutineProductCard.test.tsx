/**
 * Component tests — RoutineProductCard (US-34, US-36, US-38, US-40, US-42).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md
 *
 * RoutineProductCard does not exist yet — this file fails to resolve until
 * the engineer creates src/components/routine/RoutineProductCard.tsx per the
 * contract in fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import {
  FACE_CREAM,
  NECK_CREAM,
  SPF_STICK,
  makeProduct,
  makeRoutineProductCardProps,
  withZones,
} from './fixtures';
import { RoutineProductCard } from '@/components/routine/RoutineProductCard';
import { radius } from '@/constants/tokens';
import { EU_ALLERGEN_LIST_VERSION } from '@/utils/allergenDetector';

// ─── US-36: zone tags ──────────────────────────────────────────────────────────

describe('US-36: zone tags on the meta line', () => {
  it('renders no zone tag and no meta line when zones is absent', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product: FACE_CREAM })} />);
    expect(screen.queryByTestId('meta-line')).toBeNull();
  });

  it('renders no zone tag when zones is exactly ["face"]', () => {
    const product = withZones(FACE_CREAM, ['face']);
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product })} />);
    expect(screen.queryByText('Face')).toBeNull();
    expect(screen.queryByTestId('meta-line')).toBeNull();
  });

  it('renders no zone tag when zones is an empty array', () => {
    const product = withZones(FACE_CREAM, []);
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product })} />);
    expect(screen.queryByTestId('meta-line')).toBeNull();
  });

  it('renders "Eyes · Neck" for a product tagged with two non-default zones (US-36 negative: one card, not three)', () => {
    const product = withZones(FACE_CREAM, ['eyes', 'neck']);
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product })} />);
    expect(screen.getByText('Eyes · Neck')).toBeTruthy();
    // Exactly one card is rendered for the one product passed in.
    expect(screen.getAllByTestId('routine-product-card')).toHaveLength(1);
  });

  it('renders a single-zone tag for a product tagged with one non-default zone', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product: NECK_CREAM })} />);
    expect(screen.getByText('Neck')).toBeTruthy();
  });
});

// ─── US-38: reapply annotation ─────────────────────────────────────────────────

describe('US-38: reapply annotation', () => {
  it('renders "reapply after ~2 h" for a product with timing reapply and reapplyAfterHours 2', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product: SPF_STICK })} />);
    expect(screen.getByText('reapply after ~2 h')).toBeTruthy();
  });

  it('renders no reapply annotation for an inline product', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product: FACE_CREAM })} />);
    expect(screen.queryByText(/reapply after/)).toBeNull();
  });

  it('is independently tappable and takes normal completed styling when completed', () => {
    const onToggleComplete = jest.fn();
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ product: SPF_STICK, completed: true, tappable: true, onToggleComplete })}
      />,
    );
    expect(screen.getByTestId('completed-badge')).toBeTruthy();
    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
  });
});

// ─── US-40: completion state ───────────────────────────────────────────────────

describe('US-40: completed state', () => {
  it('shows the "Completed" badge and hides the active-ingredient status badge', () => {
    const product = makeProduct({ id: 'p-active', name: 'Retinal Serum', activeTags: ['retinoid'] });
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product, completed: true })} />);
    expect(screen.getByTestId('completed-badge')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.queryByTestId('active-badge-retinoid')).toBeNull();
  });

  it('shows the status badge again and hides the "Completed" badge once un-completed', () => {
    const product = makeProduct({ id: 'p-active', name: 'Retinal Serum', activeTags: ['retinoid'] });
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product, completed: false })} />);
    expect(screen.queryByTestId('completed-badge')).toBeNull();
    expect(screen.getByTestId('active-badge-retinoid')).toBeTruthy();
  });

  it('exposes accessibilityState checked matching the completed prop', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ completed: true })} />);
    const card = screen.getByTestId('routine-product-card');
    expect(card.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  });

  it('is a single accessible control with role button', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps()} />);
    const card = screen.getByTestId('routine-product-card');
    expect(card.props.accessibilityRole).toBe('button');
  });
});

// ─── Similar-slot tip (routine-step-grouping polish round 3, Change 1) ──────────

describe('per-card similar-slot tip', () => {
  it('renders "Similar to {name}" when similarProductName is set', () => {
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ similarProductName: 'Hydrating Toner' })}
      />,
    );
    expect(screen.getByText('Similar to Hydrating Toner')).toBeTruthy();
  });

  it('renders no similar-slot row when similarProductName is null', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ similarProductName: null })} />);
    expect(screen.queryByText(/^Similar to/)).toBeNull();
  });

  it('renders both the conflict row and the similar-slot row when both are set', () => {
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({
          conflictingProductName: 'Retinal Serum',
          similarProductName: 'Hydrating Toner',
        })}
      />,
    );
    expect(screen.getByText('Conflicts with Retinal Serum')).toBeTruthy();
    expect(screen.getByText('Similar to Hydrating Toner')).toBeTruthy();
  });
});

// ─── Badge reduction (routine-step-grouping polish round 3, Change 2) ───────────

describe('product-type badge removal', () => {
  it('renders no product-type badge text in the non-completed, non-edit-mode right cluster', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product: FACE_CREAM })} />);
    // FACE_CREAM's productType ('cream') would previously have rendered "Cream".
    expect(screen.queryByText('Cream')).toBeNull();
  });

  it('still renders the allergen badge when the product has a detected allergen match', () => {
    const product = makeProduct({
      allergenListVersion: EU_ALLERGEN_LIST_VERSION,
      detectedAllergens: [{ canonical: 'Limonene', restricted: false }],
    });
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product })} />);
    expect(screen.getByTestId('allergen-badge')).toBeTruthy();
  });
});

// ─── Edge-to-edge photo (routine-step-grouping polish round 3, Change 3) ────────

describe('edge-to-edge thumbnail', () => {
  it('renders the thumbnail in fill mode (no fixed pixel size)', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps()} />);
    const flat = StyleSheet.flatten(screen.getByTestId('product-thumbnail').props.style);
    expect(flat.aspectRatio).toBeDefined();
    expect(flat.width).toBeUndefined();
  });

  it('keeps the bottom-left corner rounded when nothing renders below mainRow', () => {
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ conflictingProductName: null, similarProductName: null, adaptationWeek: null })}
      />,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('product-thumbnail').props.style);
    expect(flat.borderBottomLeftRadius).toBe(radius.sm);
  });

  it('squares off the bottom-left corner when a conflict row renders below mainRow', () => {
    render(
      <RoutineProductCard {...makeRoutineProductCardProps({ conflictingProductName: 'Retinal Serum' })} />,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('product-thumbnail').props.style);
    expect(flat.borderBottomLeftRadius).toBe(0);
  });

  it('squares off the bottom-left corner when the similar-slot tip renders below mainRow', () => {
    render(
      <RoutineProductCard {...makeRoutineProductCardProps({ similarProductName: 'Hydrating Toner' })} />,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('product-thumbnail').props.style);
    expect(flat.borderBottomLeftRadius).toBe(0);
  });
});

describe('card shadow wrapper (routine-step-grouping polish round 3, Change 3 addendum)', () => {
  it('renders a visible shadow on the outer wrapper (not clipped by the card overflow:hidden) when not completed', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ completed: false })} />);
    // Pressable composes to its own host View before the outer cardShadow
    // wrapper's host View is reached — walk up through both layers.
    const wrapper = screen.getByTestId('routine-product-card').parent?.parent?.parent;
    const flat = StyleSheet.flatten(wrapper!.props.style);
    expect(flat.shadowOpacity).toBeGreaterThan(0);
  });

  it('carries no shadow on the outer wrapper when completed', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ completed: true })} />);
    const wrapper = screen.getByTestId('routine-product-card').parent?.parent?.parent;
    const flat = StyleSheet.flatten(wrapper!.props.style);
    expect(flat.shadowOpacity).toBeUndefined();
  });
});

// ─── Tap behaviour ──────────────────────────────────────────────────────────────

describe('Tap behaviour outside edit mode', () => {
  it('toggles completion when tappable', () => {
    const onToggleComplete = jest.fn();
    const onOpenActionSheet = jest.fn();
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ editMode: false, tappable: true, onToggleComplete, onOpenActionSheet })}
      />,
    );
    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
    expect(onOpenActionSheet).not.toHaveBeenCalled();
  });

  it('does nothing when not tappable (future day / gamification off)', () => {
    const onToggleComplete = jest.fn();
    const onOpenActionSheet = jest.fn();
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ editMode: false, tappable: false, onToggleComplete, onOpenActionSheet })}
      />,
    );
    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(onToggleComplete).not.toHaveBeenCalled();
    expect(onOpenActionSheet).not.toHaveBeenCalled();
  });
});

describe('US-42: edit mode', () => {
  it('opens the action sheet on body tap instead of toggling completion, even when tappable is true', () => {
    const onToggleComplete = jest.fn();
    const onOpenActionSheet = jest.fn();
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ editMode: true, tappable: true, onToggleComplete, onOpenActionSheet })}
      />,
    );
    fireEvent.press(screen.getByTestId('routine-product-card'));
    expect(onOpenActionSheet).toHaveBeenCalledTimes(1);
    expect(onToggleComplete).not.toHaveBeenCalled();
  });

  it('shows exactly the Pause and Schedule icons, and hides the completed badge and status badges', () => {
    const product = makeProduct({ id: 'p-active', name: 'Retinal Serum', activeTags: ['retinoid'] });
    render(<RoutineProductCard {...makeRoutineProductCardProps({ product, editMode: true, completed: true })} />);
    expect(screen.getByTestId('pause-icon')).toBeTruthy();
    expect(screen.getByTestId('schedule-icon')).toBeTruthy();
    expect(screen.queryByTestId('completed-badge')).toBeNull();
    expect(screen.queryByTestId('active-badge-retinoid')).toBeNull();
  });

  it('calls onPausePress and onSchedulePress from their respective icons, independent of the body tap', () => {
    const onPausePress = jest.fn();
    const onSchedulePress = jest.fn();
    const onOpenActionSheet = jest.fn();
    render(
      <RoutineProductCard
        {...makeRoutineProductCardProps({ editMode: true, onPausePress, onSchedulePress, onOpenActionSheet })}
      />,
    );
    fireEvent.press(screen.getByTestId('pause-icon'));
    fireEvent.press(screen.getByTestId('schedule-icon'));
    expect(onPausePress).toHaveBeenCalledTimes(1);
    expect(onSchedulePress).toHaveBeenCalledTimes(1);
    // Neither icon should also fall through to the body's action-sheet handler.
    expect(onOpenActionSheet).not.toHaveBeenCalled();
  });

  it('renders no trash / remove icon directly on the card', () => {
    render(<RoutineProductCard {...makeRoutineProductCardProps({ editMode: true })} />);
    expect(screen.queryByLabelText(/remove/i)).toBeNull();
    expect(screen.queryByTestId('remove-icon')).toBeNull();
  });
});
