/**
 * Routines screen integration: gap cards, "Not for me", the ABSENCE of the
 * "Not in your routine" block (owner decision 2026-10-16: it lives only on the
 * generation page), and edit-mode gating of Remove/Hide in the list and the
 * calendar. Spec Stories 2, 4, 5, 6, 7. The proposed plan comes from the REAL engine
 * (validateRoutines -> generatePlan); only stores, navigation and heavy native
 * modules sit behind mocks. Mock boundary follows
 * tests/routine-engine/routines-screen-paused-rows.test.tsx.
 *
 * ASSUMED: RoutinesScreen applies visibleGaps(placeholders, dismissedGapCards) before
 * rendering GapCards, passes onDismiss only for dismissible cards, and passes
 * allowRemoval={editMode} to RoutineStepActionSheet and editMode to RoutineCalendarView.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { CALENDAR_HINT_COPY, GAP_DISMISS_COPY } from '@/constants/routineScreenCopy';
import type { Product, Routine } from '@/types';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { toPersistedAccordionState } from '@/utils/routineAccordion';
import { makeEngineInput, makeRoutine, makeRoutineStep, makeS3, S3, shelfProduct } from './fixtures';

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

const mockSheetProps = jest.fn();
jest.mock('@/components/routine/RoutineStepActionSheet', () => ({
  RoutineStepActionSheet: (props: unknown) => { mockSheetProps(props); return null; },
}));
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
let mockDismissed: string[] = [];
const mockDismissGapCard = jest.fn();
let mockAccordion: unknown = null;
const mockApplyRoutinePlan = jest.fn();
const mockAddOverride = jest.fn();
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
      dismissedGapCards: mockDismissed,
      dismissGapCard: (...a: unknown[]) => mockDismissGapCard(...a),
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
  mockDismissed = [];
  mockDismissGapCard.mockClear();
  mockSheetProps.mockClear();
  mockAccordion = toPersistedAccordionState({ morning: true, evening: false });
  // The real engine behind the mocked domain boundary: validate = validateRoutines over the live mock stores.
  mockValidateSpy.mockImplementation(() =>
    validateRoutines(mockRoutines, makeEngineInput(mockProducts)),
  );
  mockProducts = makeS3();
  mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
});

function lastSheetProps(): { product: Product | null; allowRemoval?: boolean } {
  return mockSheetProps.mock.calls[mockSheetProps.mock.calls.length - 1][0];
}

describe('gap cards (Story 2)', () => {
  it('places the Toner gap card before the SPF step, in application order, not after it', () => {
    mockProducts = makeS3().filter((p) => p.id === S3.spf);
    mockRoutines = savedFrom(mockProducts, [S3.spf]);

    renderScreen();

    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('No Toner in your morning routine')).toBeGreaterThan(-1);
    expect(tree.indexOf('No Toner in your morning routine')).toBeLessThan(tree.indexOf('Plain SPF'));
  });

  it('places the Eye Cream gap card before the SPF step when there is no moisturizer step', () => {
    mockProducts = makeS3().filter((p) => p.id === S3.spf);
    mockRoutines = savedFrom(mockProducts, [S3.spf]);

    renderScreen();

    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('No Eye Cream in your morning routine')).toBeGreaterThan(-1);
    expect(tree.indexOf('No Eye Cream in your morning routine')).toBeLessThan(tree.indexOf('Plain SPF'));
  });

  it('harness sanity: an existing required-slot gap (no SPF) still shows its card', () => {
    mockProducts = makeS3().filter((p) => p.id !== S3.spf);
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream]);

    renderScreen();

    expect(screen.getByText('No SPF in your morning routine')).toBeTruthy();
  });

  it('shows the Toner and Eye Cream gap cards for the morning on S3', () => {
    renderScreen();

    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();
    expect(screen.getByText('No Eye Cream in your morning routine')).toBeTruthy();
  });

  it('shows the evening equivalents when Evening is the active period', () => {
    mockAccordion = toPersistedAccordionState({ morning: false, evening: true });

    renderScreen();

    expect(screen.getByText('No Toner in your evening routine')).toBeTruthy();
    expect(screen.getByText('No Eye Cream in your evening routine')).toBeTruthy();
  });

  it('still shows the toner cards for a wishlist toner, which is not in the list either', () => {
    mockProducts = [...makeS3(), shelfProduct('wish', 'Wishlist Toner', 'toner', { status: 'wishlist' })];
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
    // The live plan is built from owned products only (what buildEngineInputFromStores does).
    mockValidateSpy.mockImplementation(() =>
      validateRoutines(mockRoutines, makeEngineInput(mockProducts.filter((p) => p.status !== 'wishlist'))),
    );

    renderScreen();

    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();
    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });

  it('shows the Generate card and no gap card when nothing is saved', () => {
    mockRoutines = [makeRoutine('morning', []), makeRoutine('evening', [])];

    renderScreen();

    expect(screen.queryByText(/No Toner in your/)).toBeNull();
    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });
});

describe('"Not in your routine" is NOT shown on the Routines screen (owner decision 2026-10-16)', () => {
  function withShelf(extra: Product[]) {
    mockProducts = [...makeS3(), ...extra];
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
  }

  it('renders no left-out header even when the shelf holds a ready toner and a reserved oil', () => {
    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner'), shelfProduct('oil', 'Face Oil', 'oil')]);

    renderScreen();

    expect(screen.queryByText(/Not in your routine/)).toBeNull();
    expect(screen.queryByText('Face Oil')).toBeNull();
    expect(screen.queryByText('Ready to add')).toBeNull();
  });

  it('still turns the toner gap card off when the user adds a toner to the shelf, without listing it', () => {
    const before = renderScreen();
    expect(screen.getByText('No Toner in your morning routine')).toBeTruthy();
    before.unmount();

    withShelf([shelfProduct('toner', 'Hydrating Toner', 'toner')]);
    renderScreen();

    expect(screen.queryByText('No Toner in your morning routine')).toBeNull();
    expect(screen.queryByText(/Not in your routine/)).toBeNull();
  });
});

describe('"Not for me" on optional cards (Story 6)', () => {
  const dismissButtons = () => screen.queryAllByText(GAP_DISMISS_COPY.action);
  // DOM order is NOT build order: a card whose group exists (eye cream under "Moisturize") renders before a
  // card in the trailing block (toner). So pick a card's own button by climbing from its text to the
  // nearest ancestor that contains exactly one dismiss button.
  const dismissButtonOf = (cardText: string) => {
    let node = screen.getByText(cardText).parent;
    while (node) {
      const buttons = within(node).queryAllByText(GAP_DISMISS_COPY.action);
      if (buttons.length === 1) return buttons[0];
      if (buttons.length > 1) break;
      node = node.parent;
    }
    throw new Error(`no dismiss button belongs to the card "${cardText}"`);
  };

  it('is offered on the toner and eye-cream cards only, not on the SPF card', () => {
    mockProducts = makeS3().filter((p) => p.id !== S3.spf);
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream]);

    renderScreen();

    expect(screen.getByText('No SPF in your morning routine')).toBeTruthy();
    expect(dismissButtons()).toHaveLength(2); // toner + eye cream; none for SPF
  });

  it('is offered with edit mode on as well as off', () => {
    renderScreen();
    expect(dismissButtons()).toHaveLength(2);

    fireEvent.press(screen.getByLabelText('Edit routine'));

    expect(dismissButtons()).toHaveLength(2);
  });

  it('records the morning toner key when its card is dismissed', () => {
    renderScreen();

    fireEvent.press(dismissButtonOf('No Toner in your morning routine'));

    expect(mockDismissGapCard).toHaveBeenCalledTimes(1);
    expect(mockDismissGapCard).toHaveBeenCalledWith('am:toner');
    expect(screen.getByText('No Eye Cream in your morning routine')).toBeTruthy();
  });

  it('hides only the dismissed card; the other morning card and the evening cards stay', () => {
    mockDismissed = ['am:toner'];
    const view = renderScreen();

    expect(screen.queryByText('No Toner in your morning routine')).toBeNull();
    expect(screen.getByText('No Eye Cream in your morning routine')).toBeTruthy();

    mockAccordion = toPersistedAccordionState({ morning: false, evening: true });
    view.unmount();
    renderScreen();
    expect(screen.getByText('No Toner in your evening routine')).toBeTruthy();
    expect(screen.getByText('No Eye Cream in your evening routine')).toBeTruthy();
  });

  it('does not change the draft because of a dismissal', () => {
    mockProducts = [...makeS3(), shelfProduct('oil', 'Face Oil', 'oil')];
    mockRoutines = savedFrom(mockProducts, [S3.cleanser, S3.cream, S3.spf]);
    mockDismissed = ['am:toner', 'pm:toner', 'am:eye_cream', 'pm:eye_cream'];

    renderScreen();

    expect(lastDraftProps().visible).toBe(false);
  });
});

describe('Remove and Hide exist only in edit mode (Story 5)', () => {
  it('opens no action sheet when a list card is tapped with edit mode off', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Plain Cream'));

    expect(lastSheetProps().product).toBeNull();
  });

  it('opens the sheet with removal allowed when a list card is tapped in edit mode', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Edit routine'));

    fireEvent.press(screen.getByText('Plain Cream'));

    expect(lastSheetProps().product?.id).toBe(S3.cream);
    expect(lastSheetProps().allowRemoval).toBe(true);
  });

  it('passes allowRemoval=false from the calendar with edit mode off, and true once the pencil is on', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Calendar view'));

    fireEvent.press(screen.getByLabelText('Plain Cream, open actions'));
    expect(lastSheetProps().product?.id).toBe(S3.cream);
    expect(lastSheetProps().allowRemoval).toBe(false);

    fireEvent.press(screen.getByLabelText('Edit routine'));
    fireEvent.press(screen.getByLabelText('Plain Cream, open actions'));
    expect(lastSheetProps().allowRemoval).toBe(true);
  });
});

describe('calendar discoverability follows the pencil (Story 7)', () => {
  it('shows the view caption, then the edit caption after the pencil is toggled, without leaving the calendar', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Calendar view'));
    expect(screen.getByText(CALENDAR_HINT_COPY.view)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Edit routine'));

    expect(screen.getByText(CALENDAR_HINT_COPY.edit)).toBeTruthy();
    expect(screen.queryByText(CALENDAR_HINT_COPY.view)).toBeNull();
  });
});
