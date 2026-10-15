/**
 * Routines screen integration: gap cards follow the style, and the
 * "Not in your routine" footer section. Spec Stories 3 and 5, §5.
 * Mock boundary follows tests/routine-engine/routines-screen-paused-rows.test.tsx;
 * the proposed plan comes from the REAL engine (validateRoutines -> generatePlan) so the screen is
 * exercised against what the engine actually emits, not a hand-written plan.
 *
 * ASSUMED: RoutinesScreen reads `routineDepth` via useSettingsStore((s) => s.routineDepth)
 * and renders <LeftOutSection> between PausedSteps and the "Add product" button.
 * Written against a DRAFT spec.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ROUTINE_DEPTH_COPY } from '@/constants/routineDepth';
import type { Product, Routine } from '@/types';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { toPersistedAccordionState } from '@/utils/routineAccordion';
import { makeDepthInput, makeRoutine, makeRoutineStep, makeS3, S3, shelfProduct } from './fixtures';

jest.mock('@react-navigation/native', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Feather: ({ name, testID }: { name: string; testID?: string }) => <View testID={testID ?? `feather-icon-${name}`} /> };
});
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  const DraggableFlatList = ({ data, renderItem, keyExtractor, ListEmptyComponent, ListHeaderComponent, ListFooterComponent }: any) => (
    <View testID="draggable-flat-list">
      {ListHeaderComponent}
      {data.length === 0 ? ListEmptyComponent : data.map((item: any, index: number) => (
        <View key={keyExtractor ? keyExtractor(item, index) : index}>{renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}</View>
      ))}
      {ListFooterComponent}
    </View>
  );
  const NestableDraggableFlatList = ({ data, renderItem, keyExtractor }: any) => (
    <View>{data.map((item: any, index: number) => (
      <View key={keyExtractor ? keyExtractor(item, index) : index}>{renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}</View>
    ))}</View>
  );
  return { __esModule: true, default: DraggableFlatList, ScaleDecorator: ({ children }: any) => children, NestableScrollContainer: ({ children }: any) => <View>{children}</View>, NestableDraggableFlatList };
});

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));

const mockDraftProps = jest.fn();
jest.mock('@/components/routine/DraftPreviewScreen', () => ({
  DraftPreviewScreen: (props: unknown) => { mockDraftProps(props); return null; },
}));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));
jest.mock('@/components/routine/RoutineStepCard', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RoutineStepCard: ({ product, onCardPress }: any) => (
      <Pressable onPress={onCardPress} accessibilityRole="button" accessibilityLabel={product.name}><Text>{product.name}</Text></Pressable>
    ),
  };
});

// ─── Boundary state, mutated per test ────────────────────────────────────────
let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
let mockDepth: 'essential' | 'balanced' = 'balanced';
let mockAccordion: unknown = null;
const mockApplyRoutinePlan = jest.fn();
const mockAddOverride = jest.fn();
const mockSetRoutineDepth = jest.fn();
const mockValidateSpy = jest.fn();

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: (...args: unknown[]) => mockValidateSpy(...args),
  applyRoutinePlan: (...args: unknown[]) => mockApplyRoutinePlan(...args),
  resetAllRoutines: jest.fn(),
  currentOverrideHash: () => 'hash-1',
}));
jest.mock('@/domain/seasonActions', () => ({ getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })) }));
jest.mock('@/store/profileStore', () => ({ useProfileStore: jest.fn((selector: any) => selector({ profile: null })) }));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({
      routineCycleType: 'fixed',
      routineDepth: mockDepth,
      setRoutineDepth: mockSetRoutineDepth,
      gamificationEnabled: false,
      routineAccordion: mockAccordion,
      setRoutineAccordion: jest.fn(),
      rehabNoticeCollapsed: {},
      setRehabNoticeCollapsed: jest.fn(),
      routineNoticeCollapsed: {},
      setRoutineNoticeCollapsed: jest.fn(),
    }),
  ),
}));
jest.mock('@/store/trackingStore', () => {
  const useTrackingStore: any = jest.fn((selector: any) => selector({ applicationStats: [] }));
  useTrackingStore.getState = () => ({ addOverride: (...a: unknown[]) => mockAddOverride(...a) });
  return { useTrackingStore };
});
jest.mock('@/store/productsStore', () => ({ useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })) }));
jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({ routines: mockRoutines, reorderSteps: jest.fn(), removeStepFromDay: jest.fn(), removeProductStep: jest.fn(), setStepHidden: jest.fn() }),
  ),
}));
jest.mock('@/store/proceduresStore', () => ({ useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })) }));

import RoutinesScreen from '@/screens/RoutinesScreen';

function savedFrom(products: Product[], ids: string[]): Routine[] {
  const pick = (period: 'morning' | 'evening') =>
    ids.map((id) => products.find((p) => p.id === id)!).map((p) => makeRoutineStep(p));
  return [makeRoutine('morning', pick('morning')), makeRoutine('evening', pick('evening'))];
}

function renderScreen() {
  const ui = <RoutinesScreen navigation={{ navigate: jest.fn(), setOptions: jest.fn() } as any} route={{} as any} />;
  const utils = render(ui);
  return { ...utils, again: () => utils.rerender(ui) };
}

function lastDraftProps(): { visible: boolean; plan: { periods: { morning: { productId: string }[] } } | null } {
  return mockDraftProps.mock.calls[mockDraftProps.mock.calls.length - 1][0];
}

beforeEach(() => {
  mockDraftProps.mockClear();
  mockApplyRoutinePlan.mockClear();
  mockAddOverride.mockClear();
  mockDepth = 'balanced';
  mockAccordion = toPersistedAccordionState({ morning: true, evening: false });
  // The real engine behind the mocked domain boundary: validate = validateRoutines over the live mock stores.
  mockValidateSpy.mockImplementation(() =>
    validateRoutines(mockRoutines, makeDepthInput(mockProducts, mockDepth)),
  );
  mockProducts = makeS3();
  mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
});

describe('gap cards follow the routine style (Story 3, Story 1 AC5)', () => {
  it('harness sanity: an existing required-slot gap (no SPF) still shows its card', () => {
    mockProducts = makeS3().filter((p) => p.id !== S3.spf);
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream]);
    mockDepth = 'essential';

    renderScreen();

    expect(screen.getByText('No SPF in your morning routine')).toBeTruthy();
  });

  it('Balanced: shows the Toner and Eye Cream gap cards for the morning', () => {
    renderScreen();

    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();
    expect(screen.getByText('No Eye Cream in your morning routine')).toBeTruthy();
  });

  it('Balanced: shows the evening equivalents when Evening is the active period', () => {
    mockAccordion = toPersistedAccordionState({ morning: false, evening: true });

    renderScreen();

    expect(screen.getByText('No Toner in your evening routine')).toBeTruthy();
    expect(screen.getByText('No Eye Cream in your evening routine')).toBeTruthy();
  });

  it('Essential: shows none of the four', () => {
    mockDepth = 'essential';

    renderScreen();

    expect(screen.queryByText(/No Toner in your/)).toBeNull();
    expect(screen.queryByText(/No Eye Cream in your/)).toBeNull();
  });

  it('re-derives the cards when the persisted style changes, without opening the Draft Preview', () => {
    const view = renderScreen();
    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();

    mockDepth = 'essential';
    view.again();

    expect(screen.queryByText('No Toner in your morning routine')).toBeNull();
    expect(lastDraftProps().visible).toBe(false);
  });

  it('shows the Generate card and no gap card when nothing is saved', () => {
    mockRoutines = [makeRoutine('morning', []), makeRoutine('evening', [])];

    renderScreen();

    expect(screen.queryByText(/No Toner in your/)).toBeNull();
    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });
});

describe('"Not in your routine" section (Story 5)', () => {
  const header = (n: number) => ROUTINE_DEPTH_COPY.leftOutHeader(n);

  function withShelf(extra: Product[]) {
    mockProducts = [...makeS3(), ...extra];
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
  }

  it('shows a collapsed header counting the products with no saved step, above the Add product button', () => {
    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner'), shelfProduct('oil', 'Face Oil', 'oil')]);

    renderScreen();

    expect(screen.getByText(header(2))).toBeTruthy();
    expect(screen.queryByText('Face Oil')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf(header(2))).toBeGreaterThan(-1);
    expect(tree.indexOf(header(2))).toBeLessThan(tree.indexOf('Add product to routine'));
  });

  it('lists each product with its reason once expanded: ready for the toner, the reserve reason for the oil', () => {
    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner'), shelfProduct('oil', 'Face Oil', 'oil')]);
    renderScreen();

    fireEvent.press(screen.getByText(header(2)));

    expect(screen.getByText('Hydrating Toner')).toBeTruthy();
    expect(screen.getByText(ROUTINE_DEPTH_COPY.readyToAdd)).toBeTruthy();
    expect(screen.getByText('Face Oil')).toBeTruthy();
    expect(screen.getByText('Your current goals don’t call for this product — kept in reserve.')).toBeTruthy();
  });

  it('opens the Draft Preview with the product included, records the override, and saves nothing, when "Add" is tapped on a reserve row', () => {
    withShelf([shelfProduct('oil', 'Face Oil', 'oil')]);
    renderScreen();
    fireEvent.press(screen.getByText(header(1)));

    fireEvent.press(screen.getByLabelText(`${ROUTINE_DEPTH_COPY.addAction} Face Oil`));

    expect(mockAddOverride).toHaveBeenCalledWith('oil', 'hash-1');
    expect(lastDraftProps().visible).toBe(true);
    expect(mockApplyRoutinePlan).not.toHaveBeenCalled();
  });

  it('opens the Draft Preview, without recording an override, when "Review" is tapped on a ready row', () => {
    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner')]);
    renderScreen();
    fireEvent.press(screen.getByText(header(1)));

    fireEvent.press(screen.getByLabelText(`${ROUTINE_DEPTH_COPY.reviewAction} Hydrating Toner`));

    expect(lastDraftProps().visible).toBe(true);
    expect(mockAddOverride).not.toHaveBeenCalled();
    expect(mockApplyRoutinePlan).not.toHaveBeenCalled();
  });

  it('does not list a hidden product', () => {
    withShelf([shelfProduct('hid', 'Hidden Oil', 'oil', { isHidden: true })]);

    renderScreen();

    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });

  it('renders no section when every shelf product is already a saved step', () => {
    renderScreen();

    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });

  it('turns the toner from a gap card into a "ready" row when the user adds one to the shelf', () => {
    const before = renderScreen();
    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();
    before.unmount();

    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner')]);
    renderScreen();

    expect(screen.queryByText('No Toner in your morning routine')).toBeNull();
    fireEvent.press(screen.getByText(header(1)));
    expect(screen.getByText(ROUTINE_DEPTH_COPY.readyToAdd)).toBeTruthy();
  });
});

describe('copy contract (spec-literal strings that are NOT placeholders)', () => {
  it('writes the header as "Not in your routine · N"', () => {
    expect(ROUTINE_DEPTH_COPY.leftOutHeader(3)).toBe('Not in your routine · 3');
  });
});
