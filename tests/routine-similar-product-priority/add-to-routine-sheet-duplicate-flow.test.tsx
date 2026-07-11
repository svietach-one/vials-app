/**
 * Integration tests — Story 1 ACs 1-5: AddToRoutineSheet's handleSave() wiring
 * to the same-slot conflict check + DuplicateSlotChoiceSheet.
 * Spec: docs/specs/2026-07-11-routine-similar-product-priority.md §4 Story 1
 * Tech design: docs/tech-design/routine-similar-product-priority.md (FE-5, FE-7)
 *
 * routinesStore.findSameSlotConflict / replaceProductStep and
 * DuplicateSlotChoiceSheet do not exist yet — this file fails until FE-5/FE-6/FE-7
 * land (expected, tests-first). Heavy native modules mocked at the boundary per
 * .claude/rules/testing.md and the established playbook in
 * tests/routine-engine/draft-preview-sheet.test.tsx.
 *
 * ProductPickerCard and WeeklySchedulePicker are mocked/simplified because they
 * are unrelated existing UI, not the subject of this suite (see fixtures.ts
 * header for the exact AddToRoutineSheet wiring contract this file verifies).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-icon-${name}`} />
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactActual = require('react');
  const { View, FlatList } = require('react-native');
  const BottomSheetModal = ReactActual.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      ReactActual.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
      return <View>{children}</View>;
    },
  );
  const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const BottomSheetFlatList = (props: any) => <FlatList {...props} />;
  const BottomSheetBackdrop = () => null;
  return { BottomSheetModal, BottomSheetScrollView, BottomSheetFlatList, BottomSheetBackdrop };
});

// ProductPickerCard is not the subject here — reduce it to a deterministic button.
jest.mock('@/components/routine/ProductPickerCard', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ProductPickerCard: ({ product, onAdd }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name}`}
        onPress={() => onAdd(product)}
      >
        <Text>{product.name}</Text>
      </Pressable>
    ),
  };
});

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
const mockUpsertProductStep = jest.fn();
const mockReplaceProductStep = jest.fn();
const mockFindSameSlotConflict = jest.fn();

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => {
  const stateGetter = () => ({
    routines: mockRoutines,
    upsertProductStep: mockUpsertProductStep,
    replaceProductStep: mockReplaceProductStep,
    findSameSlotConflict: mockFindSameSlotConflict,
  });
  const useRoutinesStore: any = jest.fn((selector: any) => selector(stateGetter()));
  useRoutinesStore.getState = stateGetter;
  return { useRoutinesStore };
});

import { AddToRoutineSheet } from '@/components/routine/AddToRoutineSheet';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p-default',
    name: 'Default Product',
    brand: null,
    productType: 'moisturizer',
    imageUrl: null,
    activeIngredients: [],
    activeTags: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    isHidden: false,
    ...overrides,
  };
}

const EXISTING_AM = makeProduct({ id: 'p-existing-am', name: 'Barrier Repair Cream', productType: 'moisturizer' });
const EXISTING_PM = makeProduct({ id: 'p-existing-pm', name: 'Night Repair Cream', productType: 'moisturizer' });
const INCOMING = makeProduct({ id: 'p-incoming', name: 'Ceramide Moisturizer', productType: 'moisturizer' });

function selectIncomingAndOpenSchedule() {
  fireEvent.press(screen.getByLabelText(`Add ${INCOMING.name}`));
}

function checkEveningToo() {
  // Morning is already checked by default (activePeriod='morning' + the
  // product has no existing schedule) — only Evening needs a tap.
  fireEvent.press(screen.getByLabelText('Evening'));
}

beforeEach(() => {
  mockUpsertProductStep.mockClear();
  mockReplaceProductStep.mockClear();
  mockFindSameSlotConflict.mockReset();
  mockProducts = [EXISTING_AM, EXISTING_PM, INCOMING];
  mockRoutines = [
    {
      id: 'routine-am',
      name: 'Morning',
      timeOfDay: 'morning',
      steps: [{ id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] }],
    },
    {
      id: 'routine-pm',
      name: 'Evening',
      timeOfDay: 'evening',
      steps: [{ id: 'step-pm', productType: 'moisturizer', productId: EXISTING_PM.id, hidden: false, scheduledDays: [] }],
    },
  ];
});

describe('Story 1 AC1: adding a same-slot product opens the choice sheet before committing', () => {
  it('checks findSameSlotConflict for the Morning routine and opens DuplicateSlotChoiceSheet naming both products', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) =>
      routineId === 'routine-am'
        ? { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] }
        : null,
    );

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    fireEvent.press(screen.getByText('Add to routine'));

    expect(mockFindSameSlotConflict).toHaveBeenCalledWith('routine-am', 'moisturizer', INCOMING.id);
    expect(screen.getByText('You already have a moisturizer in this routine')).toBeTruthy();
    expect(screen.getByText(EXISTING_AM.name)).toBeTruthy();
    // INCOMING.name also appears in the still-mounted Step 2 header behind
    // the choice sheet, so assert presence rather than a single unique match.
    expect(screen.getAllByText(INCOMING.name).length).toBeGreaterThan(0);

    // Zero silent writes before a decision is made.
    expect(mockUpsertProductStep).not.toHaveBeenCalled();
    expect(mockReplaceProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC2: "Replace [existing]" removes the existing step and inserts the incoming product', () => {
  it('calls replaceProductStep with the existing productId, the incoming product, and scheduledDays; never upsertProductStep for that period', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) =>
      routineId === 'routine-am'
        ? { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] }
        : null,
    );

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    fireEvent.press(screen.getByText('Add to routine'));

    fireEvent.press(screen.getByLabelText(`Replace ${EXISTING_AM.name}`));

    expect(mockReplaceProductStep).toHaveBeenCalledWith(
      'routine-am',
      EXISTING_AM.id,
      { id: INCOMING.id, productType: INCOMING.productType },
      [],
    );
    expect(mockUpsertProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC3: "Keep both" preserves the existing step and adds the incoming product alongside it', () => {
  it('calls upsertProductStep as usual; never replaceProductStep', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) =>
      routineId === 'routine-am'
        ? { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] }
        : null,
    );

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    fireEvent.press(screen.getByText('Add to routine'));

    fireEvent.press(screen.getByLabelText('Keep both'));

    expect(mockUpsertProductStep).toHaveBeenCalledWith('routine-am', INCOMING.id, INCOMING.productType, []);
    expect(mockReplaceProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 1 AC4: "Cancel" leaves the routine unchanged', () => {
  it('makes no store writes and keeps the schedule step (Save button) on screen for a retry', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) =>
      routineId === 'routine-am'
        ? { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] }
        : null,
    );

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    fireEvent.press(screen.getByText('Add to routine'));

    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(mockUpsertProductStep).not.toHaveBeenCalled();
    expect(mockReplaceProductStep).not.toHaveBeenCalled();
    // The choice sheet is gone, but Step 2 (schedule) remains reachable.
    expect(screen.queryByText('You already have a moisturizer in this routine')).toBeNull();
    expect(screen.getByText('Add to routine')).toBeTruthy();
  });
});

describe('Story 1 AC5: re-adding the exact same product applies today\'s upsert behavior, no sheet', () => {
  it('excludes the incoming product\'s own id from the conflict check and never opens the choice sheet', () => {
    // The only same-slot step in Morning IS the incoming product itself.
    mockRoutines = [
      {
        id: 'routine-am',
        name: 'Morning',
        timeOfDay: 'morning',
        steps: [{ id: 'step-am', productType: 'moisturizer', productId: INCOMING.id, hidden: false, scheduledDays: [] }],
      },
      { id: 'routine-pm', name: 'Evening', timeOfDay: 'evening', steps: [] },
    ];
    mockFindSameSlotConflict.mockReturnValue(null);

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    fireEvent.press(screen.getByText('Add to routine'));

    expect(mockFindSameSlotConflict).toHaveBeenCalledWith('routine-am', 'moisturizer', INCOMING.id);
    expect(screen.queryByText(/You already have a/)).toBeNull();
    expect(mockUpsertProductStep).toHaveBeenCalledWith('routine-am', INCOMING.id, INCOMING.productType, []);
    expect(mockReplaceProductStep).not.toHaveBeenCalled();
  });
});

describe('Story 1 assumption: both AM and PM conflicts resolve one period at a time (AM first)', () => {
  it('shows the AM sheet first; the PM sheet only appears after the AM decision, naming the PM product', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) => {
      if (routineId === 'routine-am') {
        return { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] };
      }
      if (routineId === 'routine-pm') {
        return { id: 'step-pm', productType: 'moisturizer', productId: EXISTING_PM.id, hidden: false, scheduledDays: [] };
      }
      return null;
    });

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    checkEveningToo();
    fireEvent.press(screen.getByText('Add to routine'));

    // AM sheet first — PM's product must not be mentioned yet.
    expect(screen.getByText(EXISTING_AM.name)).toBeTruthy();
    expect(screen.queryByText(EXISTING_PM.name)).toBeNull();

    fireEvent.press(screen.getByLabelText('Keep both'));

    // Now the PM sheet appears.
    expect(screen.getByText(EXISTING_PM.name)).toBeTruthy();
    expect(mockUpsertProductStep).toHaveBeenCalledWith('routine-am', INCOMING.id, INCOMING.productType, []);

    fireEvent.press(screen.getByLabelText(`Replace ${EXISTING_PM.name}`));

    expect(mockReplaceProductStep).toHaveBeenCalledWith(
      'routine-pm',
      EXISTING_PM.id,
      { id: INCOMING.id, productType: INCOMING.productType },
      [],
    );
  });

  it('cancelling the AM sheet aborts the whole save — the PM sheet never appears and nothing is written', () => {
    mockFindSameSlotConflict.mockImplementation((routineId: string) => {
      if (routineId === 'routine-am') {
        return { id: 'step-am', productType: 'moisturizer', productId: EXISTING_AM.id, hidden: false, scheduledDays: [] };
      }
      if (routineId === 'routine-pm') {
        return { id: 'step-pm', productType: 'moisturizer', productId: EXISTING_PM.id, hidden: false, scheduledDays: [] };
      }
      return null;
    });

    render(<AddToRoutineSheet visible onClose={jest.fn()} activePeriod="morning" />);
    selectIncomingAndOpenSchedule();
    checkEveningToo();
    fireEvent.press(screen.getByText('Add to routine'));

    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(screen.queryByText(EXISTING_PM.name)).toBeNull();
    expect(mockUpsertProductStep).not.toHaveBeenCalled();
    expect(mockReplaceProductStep).not.toHaveBeenCalled();
  });
});
