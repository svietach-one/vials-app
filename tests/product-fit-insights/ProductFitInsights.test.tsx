/**
 * Component tests — ProductFitInsights (Explore-derived insights on the
 * saved-product page): INCI positions, skin-type caution, goal fit, disclaimer.
 * Real pure logic (resolve / caution / goal-fit); only the profile store is mocked.
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { makeProduct, makeProfileLike, type ProfileGoalConditionLike } from '../explore-composition/fixtures';

let mockProfile: ProfileGoalConditionLike | null = makeProfileLike();
jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: mockProfile })),
}));

import { ProductFitInsights } from '@/components/product/ProductFitInsights';

const RETINOL_TEXT = 'Aqua, Glycerin, Retinol, Tocopherol';

function renderInsights(overrides = {}, onSetSkinType = jest.fn(), onActivePress = jest.fn()) {
  const product = makeProduct({
    activeTags: ['retinol'],
    fullIngredientText: RETINOL_TEXT,
    ...overrides,
  });
  render(<ProductFitInsights product={product} onSetSkinType={onSetSkinType} onActivePress={onActivePress} />);
  return onSetSkinType;
}

beforeEach(() => {
  mockProfile = makeProfileLike();
});

describe('ProductFitInsights', () => {
  it('renders nothing when the product has no resolvable actives', () => {
    renderInsights({ activeTags: [], fullIngredientText: 'Aqua, Dimethicone' });

    expect(screen.queryByTestId('detected-actives')).toBeNull();
    expect(screen.queryByTestId('product-fit-disclaimer')).toBeNull();
  });

  it('shows the INCI position of an active parsed from the ingredient text', () => {
    renderInsights();

    expect(screen.getByTestId('detected-actives')).toBeTruthy();
    expect(screen.getByText('3rd of 4')).toBeTruthy();
  });

  it('lists a tag-only active without an INCI position when there is no ingredient text', () => {
    renderInsights({ fullIngredientText: null });

    expect(screen.getByTestId('active-row-retinoid')).toBeTruthy();
    expect(screen.queryByText(/of \d+$/)).toBeNull();
  });

  it('calls onActivePress with the key when an active row is tapped', () => {
    const onActivePress = jest.fn();
    renderInsights({}, jest.fn(), onActivePress);

    fireEvent.press(screen.getByTestId('active-badge-retinoid'));

    expect(onActivePress).toHaveBeenCalledWith('retinoid');
  });

  it('nudges to set a skin type when a cautionary active is present and skin type is unset', () => {
    mockProfile = makeProfileLike({ skinType: null });
    const onSetSkinType = renderInsights();

    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
    fireEvent.press(screen.getByRole('link'));
    expect(onSetSkinType).toHaveBeenCalledTimes(1);
  });

  it('shows the skin-type caution when the profile has a skin type', () => {
    mockProfile = makeProfileLike({ skinType: 'dry' });
    renderInsights();

    expect(screen.getByTestId('skin-type-caution')).toBeTruthy();
    expect(screen.queryByTestId('skin-type-nudge')).toBeNull();
  });

  it('shows the goal-fit card when a real care goal is set', () => {
    mockProfile = makeProfileLike({ primaryGoal: 'aging' });
    renderInsights();

    expect(screen.getByTestId('goal-fit-card')).toBeTruthy();
  });

  it('hides the goal-fit card when the goal is maintenance', () => {
    mockProfile = makeProfileLike({ primaryGoal: 'maintenance' });
    renderInsights();

    expect(screen.queryByTestId('goal-fit-card')).toBeNull();
  });

  it('renders the disclaimer when actives are present', () => {
    renderInsights();

    expect(screen.getByTestId('product-fit-disclaimer')).toBeTruthy();
    expect(screen.getByText(/not a personalized recommendation/)).toBeTruthy();
  });

  it('does not render shelf overlap or routine placement cards', () => {
    renderInsights();

    expect(screen.queryByTestId('composition-comparison-matrix')).toBeNull();
    expect(screen.queryByTestId('routine-placement')).toBeNull();
  });

  it('still renders insights when no profile exists yet', () => {
    mockProfile = null;
    renderInsights();

    expect(screen.getByTestId('detected-actives')).toBeTruthy();
    expect(screen.getByTestId('skin-type-nudge')).toBeTruthy();
  });

  it('renders afterActives directly under the actives card and before the caution', () => {
    const product = makeProduct({ activeTags: ['retinol'], fullIngredientText: RETINOL_TEXT });
    const { toJSON } = render(
      <ProductFitInsights
        product={product}
        onSetSkinType={jest.fn()}
        onActivePress={jest.fn()}
        afterActives={<Text>AFTER_ACTIVES</Text>}
      />,
    );

    const tree = JSON.stringify(toJSON());
    const idx = (needle: string) => tree.indexOf(needle);
    expect(idx('detected-actives')).toBeLessThan(idx('AFTER_ACTIVES'));
    expect(idx('AFTER_ACTIVES')).toBeLessThan(idx('skin-type-nudge'));
  });

  it('still renders afterActives when the product has no actives', () => {
    const product = makeProduct({ activeTags: [], fullIngredientText: 'Aqua, Dimethicone' });
    render(
      <ProductFitInsights
        product={product}
        onSetSkinType={jest.fn()}
        onActivePress={jest.fn()}
        afterActives={<Text>AFTER_ACTIVES</Text>}
      />,
    );

    expect(screen.getByText('AFTER_ACTIVES')).toBeTruthy();
  });
});
