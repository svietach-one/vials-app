import { detectCategory } from './categoryDetector';

describe('detectCategory', () => {
  it('detects serum', () => {
    expect(detectCategory('Niacinamide 10% Serum')).toBe('serum');
  });

  it('detects moisturizer from cream and moisturising wording', () => {
    expect(detectCategory('Daily Moisturising Lotion')).toBe('moisturizer');
    expect(detectCategory('Rich Night Cream')).toBe('moisturizer');
  });

  it('detects cleanser including wash and cleanzer spellings', () => {
    expect(detectCategory('Foaming Facial Cleanser')).toBe('cleanser');
    expect(detectCategory('Gentle Face Wash')).toBe('cleanser');
    expect(detectCategory('Gentle Foaming Cleanzer')).toBe('cleanser');
  });

  it('detects makeup removers (micellar / oil / balm) ahead of the cleanser rule', () => {
    // Pre-cleanse products — surfactant-based makeup/SPF removers that do not
    // rinse clean. Must classify apart from a gentle rinse-off cleanser.
    expect(detectCategory('Micellar Cleansing Water')).toBe('makeup_remover');
    expect(detectCategory('Deep Cleansing Oil')).toBe('makeup_remover');
    expect(detectCategory('Melting Cleansing Balm')).toBe('makeup_remover');
    expect(detectCategory('Bi-Phase Makeup Remover')).toBe('makeup_remover');
  });

  it('detects toner including tonic wording', () => {
    expect(detectCategory('Exfoliating Glow Toner')).toBe('toner');
    expect(detectCategory('Hydrating Facial Tonic')).toBe('toner');
  });

  it('detects spf from SPF rating and sunscreen wording', () => {
    expect(detectCategory('UV Fluid SPF 50+')).toBe('spf');
    expect(detectCategory('Mineral Sunscreen Fluid')).toBe('spf');
    expect(detectCategory('Invisible Sun Screen Stick')).toBe('spf');
  });

  it('detects mask', () => {
    expect(detectCategory('Overnight Sleeping Mask')).toBe('mask');
  });

  it('detects oil', () => {
    expect(detectCategory('Rosehip Facial Oil')).toBe('oil');
  });

  it('detects peeling from exfoliant, peeling and scrub wording', () => {
    expect(detectCategory('AHA 30% Exfoliant Solution')).toBe('peeling');
    expect(detectCategory('Enzyme Peeling Gel')).toBe('peeling');
    expect(detectCategory('Walnut Face Scrub')).toBe('peeling');
  });

  it('returns null when no pattern matches', () => {
    expect(detectCategory('Aqua Essence Booster')).toBeNull();
  });

  it('resolves ambiguous labels by first match wins', () => {
    // 'serum' pattern precedes 'spf' in CATEGORY_PATTERNS.
    expect(detectCategory('Sunscreen Serum SPF 30')).toBe('serum');
  });

  it('detects French category terms', () => {
    expect(detectCategory('Sérum Éclat')).toBe('serum');
    expect(detectCategory('Crème Hydratante Visage')).toBe('moisturizer');
    expect(detectCategory('Gel Nettoyant Doux')).toBe('cleanser');
    expect(detectCategory('Eau Tonique Apaisante')).toBe('toner');
    expect(detectCategory('Écran Solaire Invisible')).toBe('spf');
    expect(detectCategory('Masque Purifiant')).toBe('mask');
    expect(detectCategory('Huile Démaquillante')).toBe('makeup_remover');
    expect(detectCategory('Gommage Corps')).toBe('peeling');
  });

  it('detects Polish category terms', () => {
    expect(detectCategory('Krem na dzień')).toBe('moisturizer');
    expect(detectCategory('Balsam nawilżający do ciała')).toBe('moisturizer');
    expect(detectCategory('Żel myjący do twarzy')).toBe('cleanser');
    expect(detectCategory('Tonik łagodzący')).toBe('toner');
    expect(detectCategory('Emulsja przeciwsłoneczna SPF 50')).toBe('spf');
    expect(detectCategory('Maska glinkowa')).toBe('mask');
    expect(detectCategory('Olejek do demakijażu')).toBe('oil');
    expect(detectCategory('Płatki złuszczające')).toBe('peeling');
  });

  it('matches Polish diacritics case-insensitively', () => {
    expect(detectCategory('KREM NAWILŻAJĄCY')).toBe('moisturizer');
  });
});

import type { Product } from '../../types';
import { normalizeProductType, reclassifyEnzymeExfoliant, reclassifyGelCream } from './categoryDetector';

/** Annotated with the real domain type so field drift fails tsc, not just the run. */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Product',
    brand: null,
    productType: 'gel',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    source: 'user_local',
    ...overrides,
  };
}

describe('reclassifyGelCream — a gel-textured moisturiser reaches the cream slot', () => {
  const gel = (name: string): Product => makeProduct({ name, productType: 'gel' });

  it.each([
    'Water Bank Blue Hyaluronic Gel Cream',
    'Hydro Boost Cream-Gel',
    'Crème-gel hydratante',
    'Nawilżający krem-żel',
  ])('reclassifies %s to moisturizer', (name) => {
    expect(reclassifyGelCream(gel(name)).productType).toBe('moisturizer');
  });

  it('leaves a bare gel alone — a gel serum and a gel moisturiser are not the same product', () => {
    const serumish = gel('Hydrating Gel');
    expect(reclassifyGelCream(serumish)).toBe(serumish); // same reference, no copy
  });

  it('never touches a product that is not typed gel', () => {
    const cream = makeProduct({ name: 'Gel Cream', productType: 'cream' });
    expect(reclassifyGelCream(cream)).toBe(cream);
  });

  it('normalizeProductType applies both guards', () => {
    expect(normalizeProductType(gel('Aqua Gel Cream')).productType).toBe('moisturizer');
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'cleanser' });
    expect(normalizeProductType(micellar).productType).toBe('makeup_remover');
  });
});

/**
 * `balm` fills the moisturiser slot since 2026-10-14. The bundled corpus holds
 * 53 balm-typed products, of which only ~6 are face balms: 38 are hair balms
 * and 3 are cleansing balms (tech-lead re-review 2026-10-14, W3). Names below
 * are taken from that corpus.
 */
describe('only face balms reach the moisturiser slot', () => {
  const balm = (name: string) => makeProduct({ name, productType: 'balm' });

  it.each(['Lip Balm', 'Nourishing Lip Treatment Balm', 'Baume à lèvres'])(
    'keeps lip product %s out of the routine',
    (name) => {
      expect(normalizeProductType(balm(name)).productType).toBe('other');
    },
  );

  it.each([
    'Бальзам для волос Belita',
    'Repairing Hair Balm',
    'Baume cheveux',
    'Balsam do włosów',
    'Бальзам для кожи головы',
  ])('keeps hair/scalp product %s out of the routine', (name) => {
    expect(normalizeProductType(balm(name)).productType).toBe('other');
  });

  it.each(['Pyunkang Yul Cleansing Balm', 'Mizon Cleansing Balm'])(
    'routes %s to the pre-cleanse slot, not the moisturiser slot',
    (name) => {
      expect(normalizeProductType(balm(name)).productType).toBe('makeup_remover');
    },
  );

  it('leaves a genuine face balm as a balm so it can still hydrate', () => {
    expect(normalizeProductType(balm('Missha Rich Repair Balm')).productType).toBe('balm');
  });
});

describe('reclassifyEnzymeExfoliant — an enzyme powder is not the daily cleanse step', () => {
  const make = (overrides: Partial<Product>): Product => makeProduct({ productType: 'cleanser', ...overrides });

  it('reads a cleanser tagged as an enzyme exfoliant as a peeling', () => {
    const powder = make({ name: 'Papaya Enzyme Powder', activeTags: ['enzyme_exfoliant'] });

    expect(reclassifyEnzymeExfoliant(powder).productType).toBe('peeling');
  });

  it('reads a cleanser listing papain inside the first 12 ingredients as a peeling, with no tag', () => {
    const inci = ['Aqua', 'Glycerin', 'Papain', 'Parfum'].join(', ');

    expect(reclassifyEnzymeExfoliant(make({ fullIngredientText: inci })).productType).toBe('peeling');
  });

  it('leaves a cleanser alone when papain is listed beyond the 12th ingredient', () => {
    const inci = [...Array.from({ length: 12 }, (_, i) => `Filler${i + 1}`), 'Papain'].join(', ');
    const cleanser = make({ fullIngredientText: inci });

    expect(reclassifyEnzymeExfoliant(cleanser)).toBe(cleanser);
  });

  it('reclassifies an untyped "other" enzyme product too', () => {
    const other = make({ productType: 'other', activeTags: ['enzyme_exfoliant'] });

    expect(reclassifyEnzymeExfoliant(other).productType).toBe('peeling');
  });

  it.each(['serum', 'toner', 'moisturizer', 'mask', 'peeling'] as const)(
    'never changes the type of a %s (format slots are decided in the skeleton, not here)',
    (productType) => {
      const p = make({ productType, activeTags: ['enzyme_exfoliant'] });

      expect(reclassifyEnzymeExfoliant(p)).toBe(p);
    },
  );

  it('skips hair and lip products', () => {
    const hair = make({ name: 'Scalp Enzyme Wash', activeTags: ['enzyme_exfoliant'] });
    const lip = make({ name: 'Lip Enzyme Scrub', productType: 'other', activeTags: ['enzyme_exfoliant'] });

    expect(reclassifyEnzymeExfoliant(hair)).toBe(hair);
    expect(reclassifyEnzymeExfoliant(lip)).toBe(lip);
  });

  it('leaves a plain cleanser untouched (same reference)', () => {
    const plain = make({ name: 'Gentle Cleanser' });

    expect(reclassifyEnzymeExfoliant(plain)).toBe(plain);
  });

  it('is part of normalizeProductType', () => {
    const powder = make({ name: 'Pineapple Enzyme Powder', activeTags: ['enzyme_exfoliant'] });

    expect(normalizeProductType(powder).productType).toBe('peeling');
  });

  it('keeps a cleansing balm that lists an enzyme as a pre-cleanse step, not an exfoliant', () => {
    const balm = make({ name: 'Enzyme Cleansing Balm', productType: 'balm', activeTags: ['enzyme_exfoliant'] });

    expect(normalizeProductType(balm).productType).toBe('makeup_remover');
  });
});
