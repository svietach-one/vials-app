/**
 * Component test — SkinTypeCautionNotice (explore-insights-v2 task 05).
 * Four branches: caution x skinType, cross-product.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SkinTypeCautionNotice } from '@/components/catalog/SkinTypeCautionNotice';
import type { SkinTypeCautionResult } from '@/utils/productProfile/skinTypeCaution';

const CAUTION: SkinTypeCautionResult = { triggeringKeys: ['aha'] };

function renderNotice(props: {
  caution: SkinTypeCautionResult | null;
  skinType: 'oily' | 'dry' | 'combination' | 'normal' | null;
  onSetSkinType?: () => void;
}) {
  const onSetSkinType = props.onSetSkinType ?? jest.fn();
  render(
    <SkinTypeCautionNotice caution={props.caution} skinType={props.skinType} onSetSkinType={onSetSkinType} />,
  );
  return { onSetSkinType };
}

describe('SkinTypeCautionNotice — four caution x skinType branches', () => {
  it('caution present + skin type null -> renders the nudge, with a working navigation action', () => {
    const { onSetSkinType } = renderNotice({ caution: CAUTION, skinType: null });

    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
    expect(
      screen.getByText('Set your skin type to see how these ingredients suit you'),
    ).toBeTruthy();
    const link = screen.getByText('Set skin type');
    expect(onSetSkinType).not.toHaveBeenCalled();
    fireEvent.press(link);
    expect(onSetSkinType).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('skin-type-caution')).toBeNull();
  });

  it('caution present + skin type set -> renders the existing caution sentence, unchanged', () => {
    renderNotice({ caution: CAUTION, skinType: 'oily' });

    const caution = screen.getByTestId('skin-type-caution');
    expect(caution).toBeTruthy();
    expect(screen.getByText(/aha acids/i)).toBeTruthy();
    expect(screen.getByText(/oily/i)).toBeTruthy();

    expect(screen.queryByTestId('skin-type-nudge')).toBeNull();
  });

  it('no caution + skin type set -> renders nothing', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice caution={null} skinType="dry" onSetSkinType={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it('no caution + no skin type -> renders nothing (no promised insight with nothing to say)', () => {
    const { toJSON } = render(
      <SkinTypeCautionNotice caution={null} skinType={null} onSetSkinType={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });
});
