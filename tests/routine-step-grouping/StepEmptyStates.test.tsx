/**
 * Component tests — GapCard and OrphanedSlotCard (US-44).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md §7.5/§6
 *
 * Neither component exists yet — this file fails to resolve until the
 * engineer creates src/components/routine/GapCard.tsx and
 * src/components/routine/OrphanedSlotCard.tsx per the contract in
 * fixtures.ts. Expected (tests-first).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { makeGapCardProps, makeOrphanedSlotCardProps } from './fixtures';
import { GapCard } from '@/components/routine/GapCard';
import { OrphanedSlotCard } from '@/components/routine/OrphanedSlotCard';

describe('US-44: gap card — "you never had one"', () => {
  it('names the missing thing: "No SPF in your shelf"', () => {
    render(<GapCard {...makeGapCardProps({ label: 'SPF' })} />);
    expect(screen.getByText('No SPF in your shelf')).toBeTruthy();
  });

  it('has a single action, "Find in catalog", which calls onFindInCatalog', () => {
    const onFindInCatalog = jest.fn();
    render(<GapCard {...makeGapCardProps({ onFindInCatalog })} />);
    fireEvent.press(screen.getByText('Find in catalog'));
    expect(onFindInCatalog).toHaveBeenCalledTimes(1);
  });

  it('offers no "Pause" or "Add from catalog" action (that copy belongs to OrphanedSlotCard only)', () => {
    render(<GapCard {...makeGapCardProps()} />);
    expect(screen.queryByText('Pause')).toBeNull();
    expect(screen.queryByText('Add from catalog')).toBeNull();
    expect(screen.queryByText('Product removed')).toBeNull();
  });
});

describe('US-44: orphaned slot — "you had one and it is gone"', () => {
  it('shows the copy "Product removed"', () => {
    render(<OrphanedSlotCard {...makeOrphanedSlotCardProps()} />);
    expect(screen.getByText('Product removed')).toBeTruthy();
  });

  it('offers "Add from catalog", which calls onAddFromCatalog', () => {
    const onAddFromCatalog = jest.fn();
    render(<OrphanedSlotCard {...makeOrphanedSlotCardProps({ onAddFromCatalog })} />);
    fireEvent.press(screen.getByText('Add from catalog'));
    expect(onAddFromCatalog).toHaveBeenCalledTimes(1);
  });

  it('offers "Pause", which calls onPause — same vocabulary as the card control, never "hide"', () => {
    const onPause = jest.fn();
    render(<OrphanedSlotCard {...makeOrphanedSlotCardProps({ onPause })} />);
    fireEvent.press(screen.getByText('Pause'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Hide')).toBeNull();
  });

  it('never shows gap-card copy ("No ... in your shelf" or "Find in catalog")', () => {
    render(<OrphanedSlotCard {...makeOrphanedSlotCardProps()} />);
    expect(screen.queryByText(/No .* in your shelf/)).toBeNull();
    expect(screen.queryByText('Find in catalog')).toBeNull();
  });
});
