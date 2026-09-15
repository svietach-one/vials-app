/**
 * GrowDatabasePromptModal (tech design FE-3, spec Story 3 / §5) —
 * presentational contract only. Copy is identical to today's
 * ContributionConsentScreen (spec §5: "same 3-paragraph copy and 2-button
 * layout as today's screen"); props are `{ visible, onAgree, onNotNow }`
 * (tech design §3 FE-3), mirroring the sibling `ContributionConsentModal`.
 *
 * Not yet implemented — the module doesn't exist yet, so this file is
 * expected to fail to resolve at both tsc and runtime until FE-3 lands (see
 * .claude/rules/testing.md: red before green).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  GROW_DATABASE_PROMPT_BODY_PARAGRAPHS,
  GROW_DATABASE_PROMPT_TITLE,
  makeGrowDatabasePromptModalProps,
} from './fixtures';

import { GrowDatabasePromptModal } from '@/components/product/GrowDatabasePromptModal';

describe('GrowDatabasePromptModal — verbatim copy (spec §5)', () => {
  it('renders the exact title', () => {
    render(<GrowDatabasePromptModal {...makeGrowDatabasePromptModalProps()} />);

    expect(screen.getByText(GROW_DATABASE_PROMPT_TITLE)).toBeTruthy();
  });

  it.each(GROW_DATABASE_PROMPT_BODY_PARAGRAPHS)('renders the exact body paragraph: %s', (paragraph) => {
    render(<GrowDatabasePromptModal {...makeGrowDatabasePromptModalProps()} />);

    expect(screen.getByText(paragraph)).toBeTruthy();
  });

  it('renders both action labels exactly', () => {
    render(<GrowDatabasePromptModal {...makeGrowDatabasePromptModalProps()} />);

    expect(screen.getByText('Agree and share')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();
  });
});

describe('GrowDatabasePromptModal — action callbacks (spec Story 3 AC2)', () => {
  it('calls onAgree, and only onAgree, when "Agree and share" is pressed', () => {
    const onAgree = jest.fn();
    const onNotNow = jest.fn();
    render(<GrowDatabasePromptModal {...makeGrowDatabasePromptModalProps({ onAgree, onNotNow })} />);

    fireEvent.press(screen.getByText('Agree and share'));

    expect(onAgree).toHaveBeenCalledTimes(1);
    expect(onNotNow).not.toHaveBeenCalled();
  });

  it('calls onNotNow, and only onNotNow, when "Not now" is pressed', () => {
    const onAgree = jest.fn();
    const onNotNow = jest.fn();
    render(<GrowDatabasePromptModal {...makeGrowDatabasePromptModalProps({ onAgree, onNotNow })} />);

    fireEvent.press(screen.getByText('Not now'));

    expect(onNotNow).toHaveBeenCalledTimes(1);
    expect(onAgree).not.toHaveBeenCalled();
  });
});
