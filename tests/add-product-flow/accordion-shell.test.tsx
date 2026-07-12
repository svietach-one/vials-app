/**
 * Component tests — SectionAccordion + SaveBar (task 06 / QA task 10).
 * All-states coverage: the four status indicator variants, prop-driven
 * expand/collapse, and SaveBar's always-tappable contract (identical render
 * and onPress firing regardless of `enabled`).
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text: RNText } = require('react-native');
  return {
    Feather: ({ name }: { name: string }) => <RNText>{`icon-${name}`}</RNText>,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { SectionAccordion } from '@/components/addProduct/SectionAccordion';
import { SaveBar } from '@/components/addProduct/SaveBar';

import { makeSaveBarProps, makeSectionAccordionProps } from './fixtures';

describe('SectionAccordion status indicator', () => {
  it('shows the section number for an empty section', () => {
    render(
      <SectionAccordion {...makeSectionAccordionProps({ index: 2, status: 'empty' })} />,
    );

    expect(screen.getByText('2')).toBeTruthy();
  });

  it('still shows the section number while in-progress (same visual as empty)', () => {
    render(
      <SectionAccordion {...makeSectionAccordionProps({ index: 1, status: 'in-progress' })} />,
    );

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows a checkmark instead of the number once complete', () => {
    render(
      <SectionAccordion {...makeSectionAccordionProps({ index: 1, status: 'complete' })} />,
    );

    expect(screen.queryByText('1')).toBeNull();
    expect(screen.getByText('icon-check')).toBeTruthy();
  });

  it('shows a minus icon when skipped', () => {
    render(
      <SectionAccordion {...makeSectionAccordionProps({ index: 2, status: 'skipped' })} />,
    );

    expect(screen.getByText('icon-minus')).toBeTruthy();
  });
});

describe('SectionAccordion collapse/expand behaviour', () => {
  it('renders children only while expanded', () => {
    const props = makeSectionAccordionProps({
      children: <Text>section body</Text>,
    });
    const { rerender } = render(<SectionAccordion {...props} isExpanded={false} />);
    expect(screen.queryByText('section body')).toBeNull();

    rerender(<SectionAccordion {...props} isExpanded />);
    expect(screen.getByText('section body')).toBeTruthy();
  });

  it('replaces the title with the summary once complete and collapsed', () => {
    render(
      <SectionAccordion
        {...makeSectionAccordionProps({
          title: 'Barcode',
          status: 'complete',
          isExpanded: false,
          summary: <Text>3337875597197</Text>,
        })}
      />,
    );

    expect(screen.getByText('3337875597197')).toBeTruthy();
    expect(screen.queryByText('Barcode')).toBeNull();
    // Complete-and-collapsed rows advertise re-edit with the pencil icon.
    expect(screen.getByText('icon-edit-2')).toBeTruthy();
  });

  it('calls onToggle when the header row is tapped, including on a completed section', () => {
    const onToggle = jest.fn();
    render(
      <SectionAccordion
        {...makeSectionAccordionProps({
          status: 'complete',
          summary: <Text>CeraVe · Cleanser</Text>,
          onToggle,
        })}
      />,
    );

    fireEvent.press(screen.getByLabelText('Section 1: Brand, name, and category'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('SaveBar always-tappable contract', () => {
  it('fires onPress even when enabled is false', () => {
    const onPress = jest.fn();
    render(<SaveBar {...makeSaveBarProps({ enabled: false, onPress })} />);

    fireEvent.press(screen.getByText('Save and put on shelf'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the same primary label whether enabled or not', () => {
    const { rerender } = render(<SaveBar {...makeSaveBarProps({ enabled: true })} />);
    expect(screen.getByText('Save and put on shelf')).toBeTruthy();

    rerender(<SaveBar {...makeSaveBarProps({ enabled: false })} />);
    expect(screen.getByText('Save and put on shelf')).toBeTruthy();
  });

  it('shows the default privacy note and suppresses it when passed an empty string', () => {
    const { rerender } = render(<SaveBar {...makeSaveBarProps()} />);
    expect(
      screen.getByText('Only brand, name, category, and ingredients are shared. Dates stay private.'),
    ).toBeTruthy();

    rerender(<SaveBar {...makeSaveBarProps({ privacyNote: '' })} />);
    expect(
      screen.queryByText('Only brand, name, category, and ingredients are shared. Dates stay private.'),
    ).toBeNull();
  });
});
