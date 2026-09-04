import type { Product, RoutineStep } from '@/types';
import type { PlaceholderSlot } from '@/utils/routineEngine/planTypes';
import {
  attachPlaceholderGaps,
  groupStepsIntoActions,
  isGroupAllCompleted,
  resolveTransition,
} from '@/utils/routineGrouping';

function makePlaceholder(overrides: Partial<PlaceholderSlot> = {}): PlaceholderSlot {
  return {
    period: 'am',
    productTypes: ['spf'],
    reasonCode: 'spf_required_goal',
    nonSkippable: false,
    severity: 'caution',
    ...overrides,
  };
}

let idCounter = 0;
function makeProduct(overrides: Partial<Product> = {}): Product {
  idCounter += 1;
  return {
    id: `p${idCounter}`,
    name: `Product ${idCounter}`,
    brand: null,
    productType: 'serum',
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
    ...overrides,
  };
}

function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
  idCounter += 1;
  return {
    id: `s${idCounter}`,
    productType: 'serum',
    productId: null,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

beforeEach(() => {
  idCounter = 0;
});

describe('groupStepsIntoActions: bucket, not walk', () => {
  it('does not split Moisturize around Mask — eye cream (9), mask (10), cream (11) group to Moisturize, Mask', () => {
    const eyeCream = makeProduct({ id: 'eye', productType: 'eye_cream' });
    const mask = makeProduct({ id: 'mask', productType: 'mask' });
    const faceCream = makeProduct({ id: 'face', productType: 'cream' });
    const steps = [
      makeStep({ productType: 'eye_cream', productId: 'eye' }),
      makeStep({ productType: 'mask', productId: 'mask' }),
      makeStep({ productType: 'cream', productId: 'face' }),
    ];

    const groups = groupStepsIntoActions(steps, [eyeCream, mask, faceCream]);

    expect(groups.map((g) => g.action)).toEqual(['moisturize', 'mask']);
    expect(groups[0].members.map((m) => m.product?.id)).toEqual(['eye', 'face']);
    expect(groups[1].members.map((m) => m.product?.id)).toEqual(['mask']);
  });

  it('orders groups by the array index of the first member, not LAYERING_ORDER', () => {
    const cream = makeProduct({ id: 'cream', productType: 'cream' });
    const serum = makeProduct({ id: 'serum', productType: 'serum' });
    // Moisturize (LAYERING_ORDER 11) placed before Treat (LAYERING_ORDER 6).
    const steps = [
      makeStep({ productType: 'cream', productId: 'cream' }),
      makeStep({ productType: 'serum', productId: 'serum' }),
    ];

    const groups = groupStepsIntoActions(steps, [cream, serum]);

    expect(groups.map((g) => g.action)).toEqual(['moisturize', 'treat']);
  });

  it('a freshly generated routine (already LAYERING_ORDER-sorted array) groups to the full 8-action sequence', () => {
    const products = [
      makeProduct({ id: 'remover', productType: 'makeup_remover' }),
      makeProduct({ id: 'cleanser', productType: 'cleanser' }),
      makeProduct({ id: 'peel', productType: 'peeling' }),
      makeProduct({ id: 'toner', productType: 'toner' }),
      makeProduct({ id: 'serum', productType: 'serum' }),
      makeProduct({ id: 'eye', productType: 'eye_cream' }),
      makeProduct({ id: 'mask', productType: 'mask' }),
      makeProduct({ id: 'oil', productType: 'oil' }),
      makeProduct({ id: 'spf', productType: 'spf' }),
    ];
    const steps = products.map((p) => makeStep({ productType: p.productType, productId: p.id }));

    const groups = groupStepsIntoActions(steps, products);

    expect(groups.map((g) => g.action)).toEqual([
      'cleanse',
      'exfoliate',
      'tone',
      'treat',
      'moisturize',
      'mask',
      'seal',
      'protect',
    ]);
  });

  it('merges a makeup remover and a cleanser into one Cleanse group, remover first', () => {
    const remover = makeProduct({ id: 'remover', productType: 'makeup_remover' });
    const cleanser = makeProduct({ id: 'cleanser', productType: 'cleanser' });
    const steps = [
      makeStep({ productType: 'makeup_remover', productId: 'remover' }),
      makeStep({ productType: 'cleanser', productId: 'cleanser' }),
    ];

    const groups = groupStepsIntoActions(steps, [remover, cleanser]);

    expect(groups).toHaveLength(1);
    expect(groups[0].action).toBe('cleanse');
    expect(groups[0].members.map((m) => m.product?.id)).toEqual(['remover', 'cleanser']);
  });

  it('groups a mistyped micellar water (persisted as cleanser) under Cleanse via reclassification', () => {
    const micellar = makeProduct({ id: 'micellar', name: 'Micellar Cleansing Water', productType: 'cleanser' });
    const cleanser = makeProduct({ id: 'cleanser', name: 'Foam Cleanser', productType: 'cleanser' });
    const steps = [
      makeStep({ productType: 'cleanser', productId: 'micellar' }),
      makeStep({ productType: 'cleanser', productId: 'cleanser' }),
    ];

    const groups = groupStepsIntoActions(steps, [micellar, cleanser]);

    expect(groups).toHaveLength(1);
    expect(groups[0].action).toBe('cleanse');
  });

  it('sorts a reapply product last within its group regardless of LAYERING_ORDER', () => {
    const spfCream = makeProduct({ id: 'spf-cream', productType: 'spf' });
    const spfStick = makeProduct({ id: 'spf-stick', productType: 'spf', timing: 'reapply', reapplyAfterHours: 2 });
    // Stick listed first in the array — must still render last.
    const steps = [
      makeStep({ productType: 'spf', productId: 'spf-stick' }),
      makeStep({ productType: 'spf', productId: 'spf-cream' }),
    ];

    const groups = groupStepsIntoActions(steps, [spfCream, spfStick]);

    expect(groups[0].members.map((m) => m.product?.id)).toEqual(['spf-cream', 'spf-stick']);
  });

  it('renders an orphaned step (productId: null) as a member with a null product, bucketed on its own productType', () => {
    const steps = [makeStep({ productType: 'cream', productId: null })];

    const groups = groupStepsIntoActions(steps, []);

    expect(groups).toHaveLength(1);
    expect(groups[0].action).toBe('moisturize');
    expect(groups[0].members[0].product).toBeNull();
  });

  it('keeps Routine.steps and RoutineStep untouched — grouping is a pure read', () => {
    const cream = makeProduct({ id: 'cream', productType: 'cream' });
    const steps = [makeStep({ productType: 'cream', productId: 'cream' })];
    const snapshot = JSON.stringify(steps);

    groupStepsIntoActions(steps, [cream]);

    expect(JSON.stringify(steps)).toBe(snapshot);
  });
});

describe('resolveTransition: the cross-cutting matrix', () => {
  function groupOf(product: Product): ReturnType<typeof groupStepsIntoActions>[number] {
    const step = makeStep({ productType: product.productType, productId: product.id });
    return groupStepsIntoActions([step], [product])[0];
  }

  it('renders none when neither group carries a rule', () => {
    const cleanser = groupOf(makeProduct({ productType: 'cleanser' }));
    const cream = groupOf(makeProduct({ productType: 'cream' }));
    expect(resolveTransition(cleanser, cream)).toEqual({ kind: 'none' });
  });

  it('resolves dry_skin before a retinoid-carrying step', () => {
    const cleanser = groupOf(makeProduct({ productType: 'cleanser' }));
    const retinoidCream = groupOf(makeProduct({ productType: 'cream', activeTags: ['retinoid'] }));
    expect(resolveTransition(cleanser, retinoidCream)).toEqual({ kind: 'note', text: 'dry_skin' });
  });

  it('renders no divider after a retinoid step — the rule fires before it, not after', () => {
    const retinoidCream = groupOf(makeProduct({ productType: 'cream', activeTags: ['retinoid'] }));
    const moisturizer = groupOf(makeProduct({ id: 'plain', productType: 'moisturizer' }));
    // retinoidCream + moisturizer share the same 'moisturize' action in real
    // rendering; here we only assert the after-side is silent regardless.
    expect(resolveTransition(retinoidCream, moisturizer)).toEqual({ kind: 'none' });
  });

  it('resolves until_dry after a benzoyl peroxide step', () => {
    const bpo = groupOf(makeProduct({ productType: 'gel', activeTags: ['benzoyl_peroxide'] }));
    const cream = groupOf(makeProduct({ productType: 'cream' }));
    expect(resolveTransition(bpo, cream)).toEqual({ kind: 'note', text: 'until_dry' });
  });

  it('resolves immediate after a hyaluronic acid step into a plain moisturizer', () => {
    const hyaluronic = groupOf(makeProduct({ productType: 'serum', activeTags: ['hyaluronic_acid'] }));
    const moisturizer = groupOf(makeProduct({ productType: 'moisturizer' }));
    expect(resolveTransition(hyaluronic, moisturizer)).toEqual({ kind: 'note', text: 'immediate' });
  });

  it('precedence: dry_skin beats immediate when a hyaluronic step precedes a retinoid step', () => {
    const hyaluronic = groupOf(makeProduct({ productType: 'serum', activeTags: ['hyaluronic_acid'] }));
    const retinoidCream = groupOf(makeProduct({ productType: 'cream', activeTags: ['retinoid'] }));
    expect(resolveTransition(hyaluronic, retinoidCream)).toEqual({ kind: 'note', text: 'dry_skin' });
  });

  it('acids carry no transition — an acid toner into a serum resolves none', () => {
    const acidToner = groupOf(makeProduct({ productType: 'toner', activeTags: ['aha'] }));
    const serum = groupOf(makeProduct({ productType: 'serum' }));
    expect(resolveTransition(acidToner, serum)).toEqual({ kind: 'none' });
  });

  it('pure vitamin C carries no transition', () => {
    const vitC = groupOf(makeProduct({ productType: 'serum', activeTags: ['vitamin_c_pure'] }));
    const moisturizer = groupOf(makeProduct({ productType: 'moisturizer' }));
    expect(resolveTransition(vitC, moisturizer)).toEqual({ kind: 'none' });
  });

  it('resolves before_sun on the final gap (to === null) for an inline SPF, chemical or mineral alike', () => {
    const spf = groupOf(makeProduct({ productType: 'spf', activeTags: ['spf_filters'] }));
    expect(resolveTransition(spf, null)).toEqual({ kind: 'note', text: 'before_sun' });
  });

  it('a reapply-only SPF product contributes no transition rule in either direction', () => {
    const spfStick = groupOf(
      makeProduct({ productType: 'spf', activeTags: ['spf_filters'], timing: 'reapply', reapplyAfterHours: 2 }),
    );
    expect(resolveTransition(spfStick, null)).toEqual({ kind: 'none' });

    const cream = groupOf(makeProduct({ productType: 'cream' }));
    expect(resolveTransition(cream, spfStick)).toEqual({ kind: 'none' });
  });

  it('an orphaned member (null product) contributes no rule', () => {
    const orphanStep = makeStep({ productType: 'cream', productId: null });
    const orphanGroup = groupStepsIntoActions([orphanStep], [])[0];
    const retinoidCream = groupOf(makeProduct({ productType: 'cream', activeTags: ['retinoid'] }));
    expect(resolveTransition(orphanGroup, retinoidCream)).toEqual({ kind: 'note', text: 'dry_skin' });
    expect(resolveTransition(retinoidCream, orphanGroup)).toEqual({ kind: 'none' });
  });
});

describe('attachPlaceholderGaps', () => {
  it('attaches a placeholder onto an existing group sharing its action', () => {
    const cream = makeProduct({ id: 'cream', productType: 'cream' });
    const groups = groupStepsIntoActions([makeStep({ productType: 'cream', productId: 'cream' })], [cream]);
    const placeholder = makePlaceholder({ productTypes: ['moisturizer'] });

    const { groups: withGaps, extraGroups } = attachPlaceholderGaps(groups, [placeholder]);

    expect(withGaps).toHaveLength(1);
    expect(withGaps[0].gaps).toEqual([placeholder]);
    expect(extraGroups).toEqual([]);
  });

  it('creates a synthetic gap-only group when no existing group matches the placeholder action', () => {
    const cleanser = makeProduct({ id: 'cleanser', productType: 'cleanser' });
    const groups = groupStepsIntoActions([makeStep({ productType: 'cleanser', productId: 'cleanser' })], [cleanser]);
    const placeholder = makePlaceholder({ productTypes: ['spf'] });

    const { groups: withGaps, extraGroups } = attachPlaceholderGaps(groups, [placeholder]);

    expect(withGaps[0].gaps).toEqual([]);
    expect(extraGroups).toEqual([{ action: 'protect', members: [], gaps: [placeholder] }]);
  });

  it('produces no gaps anywhere when there are no placeholders', () => {
    const cleanser = makeProduct({ id: 'cleanser', productType: 'cleanser' });
    const groups = groupStepsIntoActions([makeStep({ productType: 'cleanser', productId: 'cleanser' })], [cleanser]);

    const { groups: withGaps, extraGroups } = attachPlaceholderGaps(groups, []);

    expect(withGaps[0].gaps).toEqual([]);
    expect(extraGroups).toEqual([]);
  });

  it('merges two unmatched placeholders sharing the same action into one synthetic group', () => {
    const a = makePlaceholder({ productTypes: ['spf'] });
    const b = makePlaceholder({ productTypes: ['spf'], reasonCode: 'summer_photosensitizer_spf' });

    const { extraGroups } = attachPlaceholderGaps([], [a, b]);

    expect(extraGroups).toEqual([{ action: 'protect', members: [], gaps: [a, b] }]);
  });
});

describe('isGroupAllCompleted', () => {
  it('is true only when every member is completed', () => {
    const cream = makeProduct({ id: 'cream', productType: 'cream' });
    const eye = makeProduct({ id: 'eye', productType: 'eye_cream' });
    const group = groupStepsIntoActions(
      [makeStep({ productType: 'cream', productId: 'cream' }), makeStep({ productType: 'eye_cream', productId: 'eye' })],
      [cream, eye],
    )[0];

    expect(isGroupAllCompleted(group, () => true)).toBe(true);
    expect(isGroupAllCompleted(group, (m) => m.product?.id === 'cream')).toBe(false);
  });
});
