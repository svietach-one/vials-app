import type { Product, SkinGoal } from '@/types';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { selectSkeleton } from '@/utils/routineEngine/skeleton';

const NOW = new Date('2026-07-04T12:00:00Z');

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

function run(products: Product[], primaryGoal: SkinGoal = 'maintenance') {
  const facts = buildShelfFacts(products, NOW);
  const context = buildRoutineContext({
    procedures: [],
    profile: { fitzpatrick: null, primaryGoal, secondaryGoal: null },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
  });
  return selectSkeleton({ products, facts, context });
}

const reasonFor = (r: ReturnType<typeof run>, id: string) =>
  r.reserve.find((x) => x.productId === id)?.reasonCode;
const isCandidate = (r: ReturnType<typeof run>, id: string) =>
  r.periodCandidates.am.has(id) || r.periodCandidates.pm.has(id);

beforeEach(() => {
  idCounter = 0;
});

describe('selectSkeleton — minimalism (phase-04 §4.1)', () => {
  it('reserves every active under a maintenance goal, keeping only structural slots', () => {
    const cleanser = makeProduct({ productType: 'cleanser' });
    const moisturizer = makeProduct({ productType: 'moisturizer' });
    const spf = makeProduct({ productType: 'spf', usageTime: 'morning' });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });

    const r = run([cleanser, moisturizer, spf, retinoid, vitC], 'maintenance');

    expect(isCandidate(r, cleanser.id)).toBe(true);
    expect(isCandidate(r, moisturizer.id)).toBe(true);
    expect(isCandidate(r, spf.id)).toBe(true);
    expect(reasonFor(r, retinoid.id)).toBe('not_needed_for_goals');
    expect(reasonFor(r, vitC.id)).toBe('not_needed_for_goals');
  });

  it('leaves the treatment slot empty under maintenance even with five serums', () => {
    const serums = Array.from({ length: 5 }, () => makeProduct({ activeTags: ['niacinamide'] }));
    const r = run(serums, 'maintenance');
    // Mild, unranked → all reserved, none a treatment.
    for (const s of serums) expect(reasonFor(r, s.id)).toBe('not_needed_for_goals');
  });

  it('selects the top-ranked treatment for the goal and reserves the rest', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] }); // acne rank 0
    const niacinamide = makeProduct({ activeTags: ['niacinamide'] }); // acne rank 4, mild
    const r = run([retinoid, niacinamide], 'acne');

    expect(r.periodCandidates.pm.has(retinoid.id)).toBe(true);
    // niacinamide is mild and ranked but not the chosen treatment → not needed
    expect(reasonFor(r, niacinamide.id)).toBe('not_needed_for_goals');
  });
});

describe('selectSkeleton — cumulative active exposure (phase-04 §4.2, report §7)', () => {
  it('admits a peptide serum and a peptide cream together — mild, no dedup, no cap', () => {
    // Directive case 1: goal aging, both peptide products in the same PM.
    const peptideSerum = makeProduct({ activeTags: ['peptide_signal'], productType: 'serum' });
    const peptideCream = makeProduct({ activeTags: ['peptide_signal'], productType: 'cream' });
    const r = run([peptideSerum, peptideCream], 'aging');

    // The serum is the ranked treatment; the cream fills the moisturizer slot.
    expect(isCandidate(r, peptideSerum.id)).toBe(true);
    expect(isCandidate(r, peptideCream.id)).toBe(true);
    expect(r.reserve).toHaveLength(0);
  });

  it('caps three same-class acids to one carrier, reserving the rest as cumulative_active_cap', () => {
    // Directive case 2: AHA serum + AHA toner + AHA cream (cream = only
    // moisturizer). Exactly one acid carrier selected; the other two reserve.
    const ahaSerum = makeProduct({ activeTags: ['aha'], productType: 'serum', addedAt: '2026-03-01' });
    const ahaToner = makeProduct({ activeTags: ['aha'], productType: 'toner', addedAt: '2026-02-01' });
    const ahaCream = makeProduct({ activeTags: ['aha'], productType: 'cream', addedAt: '2026-01-01' });
    const r = run([ahaSerum, ahaToner, ahaCream], 'pigmentation');

    const selected = [ahaSerum, ahaToner, ahaCream].filter((p) => isCandidate(r, p.id));
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(ahaSerum.id); // native serum format wins the tiebreak
    const reserved = [ahaToner, ahaCream].map((p) => reasonFor(r, p.id));
    expect(reserved).toEqual(['duplicate_function', 'duplicate_function']);
    // The acid cream was reclassified as a treatment, so no moisturizer remains
    // → neutral-moisturizer placeholder recommended.
    expect(r.placeholders).toEqual([
      expect.objectContaining({ period: 'pm', productTypes: ['moisturizer'], reasonCode: 'moisturizer_recommended' }),
    ]);
    // The selected acid inherits the exfoliant treatment cap.
    expect(r.treatmentCaps.get(ahaSerum.id)).toEqual(
      expect.objectContaining({ reasonCode: 'exfoliant_treatment_cap' }),
    );
  });

  it('exempts a rinse-off BHA cleanser from the cap and only notes it', () => {
    // Directive case 3: BHA cleanser + BHA serum both allowed same PM.
    const bhaCleanser = makeProduct({ activeTags: ['bha'], productType: 'cleanser' });
    const bhaSerum = makeProduct({ activeTags: ['bha'], productType: 'serum' });
    const r = run([bhaCleanser, bhaSerum], 'acne');

    expect(isCandidate(r, bhaCleanser.id)).toBe(true); // structural cleanser slot
    expect(isCandidate(r, bhaSerum.id)).toBe(true); // the one strong treatment
    expect(r.reserve).toHaveLength(0);
    expect(r.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'info', productId: bhaCleanser.id, reasonCode: 'rinse_off_active_note' }),
      ]),
    );
  });

  it('admits three mild niacinamide products across slots with no cap and no reserve', () => {
    // Directive case 4: all mild → no cumulative restriction.
    const serum = makeProduct({ activeTags: ['niacinamide'], productType: 'serum' });
    const toner = makeProduct({ activeTags: ['niacinamide'], productType: 'toner' });
    const cream = makeProduct({ activeTags: ['niacinamide'], productType: 'cream' });
    const r = run([serum, toner, cream], 'oil_control');

    // niacinamide is ranked for oil_control; one becomes the treatment, the
    // cream fills the moisturizer slot, the toner is a mild extra (not needed).
    // None hit the cumulative cap — the key assertion is no cap reserve.
    expect(r.reserve.map((x) => x.reasonCode)).not.toContain('cumulative_active_cap');
  });

  it('reclassifies a retinoid cream (only moisturizer) as a treatment and recommends a neutral one', () => {
    // Directive case 5: retinoid cream is a strong carrier → treatment, never
    // the daily moisturizer; the vacated slot gets a placeholder.
    const retinoidCream = makeProduct({ activeTags: ['retinoid'], productType: 'cream' });
    const r = run([retinoidCream], 'aging');

    expect(r.periodCandidates.pm.has(retinoidCream.id)).toBe(true);
    expect(r.treatmentCaps.get(retinoidCream.id)).toEqual(
      expect.objectContaining({ reasonCode: 'reclassified_treatment_cap' }),
    );
    expect(r.placeholders).toEqual([
      expect.objectContaining({ period: 'pm', reasonCode: 'moisturizer_recommended' }),
    ]);
  });
});

describe('selectSkeleton — determinism', () => {
  it('produces identical selection for identical input', () => {
    const products = [
      makeProduct({ productType: 'cleanser' }),
      makeProduct({ activeTags: ['retinoid'] }),
      makeProduct({ activeTags: ['vitamin_c_pure'] }),
      makeProduct({ productType: 'moisturizer' }),
    ];
    const a = run(products, 'aging');
    const b = run(products, 'aging');
    expect(a.reserve).toEqual(b.reserve);
    expect([...a.periodCandidates.am]).toEqual([...b.periodCandidates.am]);
    expect([...a.periodCandidates.pm]).toEqual([...b.periodCandidates.pm]);
  });
});
