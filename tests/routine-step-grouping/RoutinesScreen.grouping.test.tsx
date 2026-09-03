/**
 * Integration tests — RoutinesScreen renders grouped steps, transitions, and
 * the two distinct empty states (US-34, US-35 note, US-37, US-38 negative,
 * US-39, US-44, US-45 display-only clause).
 * Spec: docs/specs/routine-step-grouping/{PRD_Spec,SCREENS,USER_STORIES}.md
 *
 * Mocking follows the established playbook in
 * tests/routines/routines-screen-hidden-filter.test.tsx and
 * tests/routine-similar-product-priority/routines-screen-duplicate-wiring.test.tsx.
 * Unlike those files, StepGroupHeader / RoutineProductCard /
 * StepTransitionDivider / GapCard / OrphanedSlotCard are NOT mocked here —
 * they are the real, composed subject under test, driven by the real
 * (not-yet-existing) grouping/transition logic inside RoutinesScreen. This
 * file fails to import until the engineer lands Phases 1-6. Expected
 * (tests-first).
 *
 * groupStepsIntoActions/resolveTransition themselves are never called
 * directly from this file — only their RENDERED effect is asserted, per the
 * qa-lead/engineer test-ownership split (testing.md).
 *
 * The accordion Period-card chrome (PlannerBlock, Morning/Evening sections)
 * is unchanged by this package and is mocked away here as noise, matching
 * the existing precedent files — see the progress log for why SCREENS.md's
 * "segmented control" description is stale against shipped code.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Product, Routine } from '@/types';

import {
  CLEANSER,
  EYE_CREAM,
  FACE_CREAM,
  HYALURONIC_SERUM,
  MAKEUP_REMOVER,
  MASK,
  BPO_TREATMENT,
  SPF_CREAM,
  SPF_STICK,
  makeProduct,
  makeRoutine,
  makeStep,
} from './fixtures';

// ── Navigation / focus mocks ──────────────────────────────────────────────────

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

// ── Draggable flat list — renders `data` synchronously via renderItem ────────

jest.mock('react-native-draggable-flatlist', () => {
  const { View } = require('react-native');
  const ScaleDecorator = ({ children }: any) => children;
  const NestableScrollContainer = ({ children }: any) => <View>{children}</View>;
  const NestableDraggableFlatList = ({ data, renderItem, keyExtractor }: any) => (
    <View>
      {data.map((item: any, index: number) => (
        <View key={keyExtractor ? keyExtractor(item, index) : index}>
          {renderItem({ item, drag: () => {}, isActive: false, getIndex: () => index })}
        </View>
      ))}
    </View>
  );
  return { __esModule: true, ScaleDecorator, NestableScrollContainer, NestableDraggableFlatList };
});

// ── Heavy / irrelevant siblings ───────────────────────────────────────────────

jest.mock('@/components/routine/AddToRoutineSheet', () => ({ AddToRoutineSheet: () => null }));
jest.mock('@/components/routine/DraftPreviewScreen', () => ({ DraftPreviewScreen: () => null }));
jest.mock('@/components/routine/RemoveStepModal', () => ({ RemoveStepModal: () => null }));
jest.mock('@/components/routine/SeasonalNoticeBanner', () => ({ SeasonalNoticeBanner: () => null }));
jest.mock('@/components/routine/RehabNoticeCard', () => ({ RehabNoticeCard: () => null }));
jest.mock('@/components/routine/PlannerBlock', () => ({ PlannerBlock: () => null }));

// Deterministic accordion: Morning expanded, Evening collapsed — every
// assertion in this file targets the Morning routine.
jest.mock('@/utils/routineAccordion', () => ({
  ...jest.requireActual('@/utils/routineAccordion'),
  resolveAccordionState: () => ({ morning: true, evening: false }),
}));

// ── Store mocks ────────────────────────────────────────────────────────────────

let mockProducts: Product[] = [];
let mockRoutines: Routine[] = [];
const mockReorderSteps = jest.fn();
const mockRemoveStepFromDay = jest.fn();
const mockRemoveProductStep = jest.fn();
const mockSetStepHidden = jest.fn();
const mockValidateCurrentRoutines = jest.fn(() => ({
  findings: [],
  hasBlockingFindings: false,
  proposedPlan: {
    rulesetVersion: 'test',
    generatedFor: '2026-01-01',
    periods: { morning: [], evening: [] },
    frozen: [],
    reserve: [],
    placeholders: [] as unknown[],
    decisions: [],
  },
  diff: [],
}));

jest.mock('@/store/productsStore', () => ({
  useProductsStore: jest.fn((selector: any) => selector({ products: mockProducts })),
}));

jest.mock('@/store/routinesStore', () => ({
  useRoutinesStore: jest.fn((selector: any) =>
    selector({
      routines: mockRoutines,
      reorderSteps: mockReorderSteps,
      removeStepFromDay: mockRemoveStepFromDay,
      removeProductStep: mockRemoveProductStep,
      setStepHidden: mockSetStepHidden,
    }),
  ),
}));

jest.mock('@/store/proceduresStore', () => ({
  useProceduresStore: jest.fn((selector: any) => selector({ procedures: [] })),
}));

jest.mock('@/store/profileStore', () => ({
  useProfileStore: jest.fn((selector: any) => selector({ profile: null, updateProfile: jest.fn() })),
}));

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) =>
    selector({
      routineCycleType: 'fixed',
      routineAccordion: null,
      setRoutineAccordion: jest.fn(),
      rehabNoticeCollapsed: {},
      setRehabNoticeCollapsed: jest.fn(),
      routineNoticeCollapsed: {},
      setRoutineNoticeCollapsed: jest.fn(),
      gamificationEnabled: true,
    }),
  ),
}));

jest.mock('@/store/trackingStore', () => ({
  useTrackingStore: jest.fn((selector: any) => selector({ applicationStats: [] })),
}));

jest.mock('@/domain/seasonActions', () => ({
  getActiveSeasonMask: jest.fn(() => ({ season: 'spring', source: 'calendar' })),
}));

jest.mock('@/domain/routinePlanActions', () => ({
  validateCurrentRoutines: (...args: unknown[]) => mockValidateCurrentRoutines(...(args as [])),
  applyRoutinePlan: jest.fn(),
  currentOverrideHash: jest.fn(() => 'hash'),
}));

import RoutinesScreen from '@/screens/RoutinesScreen';

function renderScreen() {
  const navigate = jest.fn();
  const utils = render(
    <RoutinesScreen navigation={{ navigate, setOptions: jest.fn() } as any} route={{} as any} />,
  );
  return { ...utils, navigate };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProducts = [];
  mockRoutines = [];
  mockValidateCurrentRoutines.mockReturnValue({
    findings: [],
    hasBlockingFindings: false,
    proposedPlan: {
      rulesetVersion: 'test',
      generatedFor: '2026-01-01',
      periods: { morning: [], evening: [] },
      frozen: [],
      reserve: [],
      placeholders: [],
      decisions: [],
    },
    diff: [],
  });
});

// ─── US-34: bucket, not walk ────────────────────────────────────────────────────

describe('US-34 negative: the mask case — Moisturize must not split around Mask', () => {
  it('renders one Moisturize header (eye cream + face cream) followed by one Mask header', () => {
    mockProducts = [EYE_CREAM, MASK, FACE_CREAM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'eye_cream', productId: EYE_CREAM.id }),
          makeStep({ id: 's2', productType: 'mask', productId: MASK.id }),
          makeStep({ id: 's3', productType: 'cream', productId: FACE_CREAM.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.queryAllByText(/^\d+\.\s*Moisturize$/)).toHaveLength(1);
    expect(screen.queryAllByText(/^\d+\.\s*Mask$/)).toHaveLength(1);
    expect(screen.getByText(EYE_CREAM.name)).toBeTruthy();
    expect(screen.getByText(FACE_CREAM.name)).toBeTruthy();
    expect(screen.getByText(MASK.name)).toBeTruthy();
  });
});

describe('US-34: a makeup remover and a cleanser merge into one Cleanse step', () => {
  it('renders exactly one Cleanse header holding both product names', () => {
    mockProducts = [MAKEUP_REMOVER, CLEANSER];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'makeup_remover', productId: MAKEUP_REMOVER.id }),
          makeStep({ id: 's2', productType: 'cleanser', productId: CLEANSER.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.queryAllByText(/^\d+\.\s*Cleanse$/)).toHaveLength(1);
    expect(screen.getByText(MAKEUP_REMOVER.name)).toBeTruthy();
    expect(screen.getByText(CLEANSER.name)).toBeTruthy();
  });
});

// ─── US-34 negative: group order follows the array, not LAYERING_ORDER ────────

describe('US-34 negative: group order is read from the persisted array, not from LAYERING_ORDER', () => {
  it('renders Moisturize before Treat when the array places the moisturizer step first', () => {
    mockProducts = [FACE_CREAM, HYALURONIC_SERUM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          // Moisturize (LAYERING_ORDER 11) placed BEFORE Treat (LAYERING_ORDER 6)
          // — the reverse of what LAYERING_ORDER-derived ordering would give.
          makeStep({ id: 's1', productType: 'cream', productId: FACE_CREAM.id }),
          makeStep({ id: 's2', productType: 'serum', productId: HYALURONIC_SERUM.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.getByText('1. Moisturize')).toBeTruthy();
    expect(screen.getByText('2. Treat')).toBeTruthy();
  });
});

// ─── Ordinal renumbering with no gaps ──────────────────────────────────────────

describe('US-37/SCREENS.md §3.1: ordinals renumber with no gaps when a step is unscheduled today', () => {
  it('skips the middle group entirely rather than leaving a numbering gap', () => {
    const todayDow = new Date().getDay();
    const notToday = (todayDow + 1) % 7;
    const treatmentProduct = makeProduct({ id: 'p-unscheduled-treat', name: 'Unscheduled Treatment', productType: 'serum' });

    mockProducts = [CLEANSER, treatmentProduct, FACE_CREAM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cleanser', productId: CLEANSER.id, scheduledDays: [] }),
          makeStep({ id: 's2', productType: 'serum', productId: treatmentProduct.id, scheduledDays: [notToday] }),
          makeStep({ id: 's3', productType: 'cream', productId: FACE_CREAM.id, scheduledDays: [] }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.getByText('1. Cleanse')).toBeTruthy();
    expect(screen.getByText('2. Moisturize')).toBeTruthy();
    expect(screen.queryByText(/Treat$/)).toBeNull();
    expect(screen.queryByText(/^3\./)).toBeNull();
  });
});

// ─── US-37/US-39: transition matrix ────────────────────────────────────────────

describe('US-37/US-39: layering-note transitions', () => {
  it('renders "on dry skin" on the gap before a retinoid-carrying step', () => {
    const retinoidCream = makeProduct({ id: 'p-retinoid-cream', name: 'Retinol Night Cream', productType: 'cream', activeTags: ['retinoid'] });
    mockProducts = [CLEANSER, retinoidCream];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cleanser', productId: CLEANSER.id }),
          makeStep({ id: 's2', productType: 'cream', productId: retinoidCream.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.getByText('on dry skin')).toBeTruthy();
  });

  it('renders "until fully dry" on the gap after a benzoyl-peroxide step', () => {
    mockProducts = [BPO_TREATMENT, FACE_CREAM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'gel', productId: BPO_TREATMENT.id }),
          makeStep({ id: 's2', productType: 'cream', productId: FACE_CREAM.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.getByText('until fully dry')).toBeTruthy();
  });

  it('renders "apply next right away" for a hyaluronic serum followed by a plain moisturizer', () => {
    const plainMoisturizer = makeProduct({ id: 'p-plain-moist', name: 'Plain Moisturizer', productType: 'moisturizer' });
    mockProducts = [HYALURONIC_SERUM, plainMoisturizer];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'serum', productId: HYALURONIC_SERUM.id }),
          makeStep({ id: 's2', productType: 'moisturizer', productId: plainMoisturizer.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.getByText('apply next right away')).toBeTruthy();
  });

  it('resolves to "on dry skin" (not "apply next right away") when a hyaluronic serum is followed by a retinoid-carrying moisturize step — dry_skin precedence', () => {
    const retinoidCream = makeProduct({ id: 'p-retinoid-cream-2', name: 'Retinol Night Cream', productType: 'cream', activeTags: ['retinoid'] });
    mockProducts = [HYALURONIC_SERUM, retinoidCream];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'serum', productId: HYALURONIC_SERUM.id }),
          makeStep({ id: 's2', productType: 'cream', productId: retinoidCream.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.getByText('on dry skin')).toBeTruthy();
    expect(screen.queryByText('apply next right away')).toBeNull();
  });

  it('renders "~15 min before sun exposure" only after the final AM step, for an inline SPF', () => {
    mockProducts = [FACE_CREAM, SPF_CREAM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cream', productId: FACE_CREAM.id }),
          makeStep({ id: 's2', productType: 'spf', productId: SPF_CREAM.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.getByText('~15 min before sun exposure')).toBeTruthy();
  });

  it('US-38 negative: a reapply-only SPF product contributes no transition rule', () => {
    mockProducts = [FACE_CREAM, SPF_STICK];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cream', productId: FACE_CREAM.id }),
          makeStep({ id: 's2', productType: 'spf', productId: SPF_STICK.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    expect(screen.queryByText('~15 min before sun exposure')).toBeNull();
  });

  it('renders zero transition dividers for a routine with no layering-rule products', () => {
    mockProducts = [CLEANSER, FACE_CREAM];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [
          makeStep({ id: 's1', productType: 'cleanser', productId: CLEANSER.id }),
          makeStep({ id: 's2', productType: 'cream', productId: FACE_CREAM.id }),
        ],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();
    for (const copy of ['on dry skin', 'apply next right away', 'until fully dry', '~15 min before sun exposure']) {
      expect(screen.queryByText(copy)).toBeNull();
    }
  });
});

// ─── US-44: two distinct empty states ──────────────────────────────────────────

describe('US-44: gap card — a generator placeholder renders instead of being dropped', () => {
  it('renders "No SPF in your shelf" with a Find in catalog action when the plan has an unfilled SPF mandate', () => {
    mockProducts = [CLEANSER];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [makeStep({ id: 's1', productType: 'cleanser', productId: CLEANSER.id })],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];
    mockValidateCurrentRoutines.mockReturnValue({
      findings: [],
      hasBlockingFindings: false,
      proposedPlan: {
        rulesetVersion: 'test',
        generatedFor: '2026-01-01',
        periods: { morning: [], evening: [] },
        frozen: [],
        reserve: [],
        placeholders: [
          { period: 'am', productTypes: ['spf'], reasonCode: 'spf_mandate_unmet', nonSkippable: false, severity: 'caution' },
        ],
        decisions: [],
      },
      diff: [],
    });

    const { navigate } = renderScreen();

    expect(screen.getByText('No SPF in your shelf')).toBeTruthy();
    fireEvent.press(screen.getByText('Find in catalog'));
    expect(navigate).toHaveBeenCalled();
  });
});

describe('US-44: orphaned slot — a step whose product was deleted renders instead of being silently dropped', () => {
  it('renders "Product removed" and calls setStepHidden when Pause is pressed', () => {
    mockProducts = [];
    mockRoutines = [
      makeRoutine({
        id: 'routine-am',
        timeOfDay: 'morning',
        steps: [makeStep({ id: 's-orphan', productType: 'cream', productId: null })],
      }),
      makeRoutine({ id: 'routine-pm', timeOfDay: 'evening', steps: [] }),
    ];

    renderScreen();

    expect(screen.getByText('Product removed')).toBeTruthy();
    fireEvent.press(screen.getByText('Pause'));
    expect(mockSetStepHidden).toHaveBeenCalledWith('routine-am', 's-orphan', true);
  });
});
