import { buildCapabilities } from '@/utils/productProfile/capabilities';
import { joinActiveKeys } from '@/utils/productProfile/join';

describe('buildCapabilities — zero resolved active classes', () => {
  it('returns null/insufficient_data for Barrier Repair and Exfoliation', () => {
    const capabilities = buildCapabilities([], joinActiveKeys([]));

    expect(capabilities.barrierRepair.score).toBeNull();
    expect(capabilities.barrierRepair.confidence).toBe('insufficient_data');
    expect(capabilities.exfoliation.score).toBeNull();
    expect(capabilities.exfoliation.confidence).toBe('insufficient_data');
  });

  it('returns null/insufficient_data for every one of the 4 still-not-modeled capabilities', () => {
    const capabilities = buildCapabilities([], joinActiveKeys([]));
    const notModeled = [
      'acneControl',
      'sebumRegulation',
      'antioxidantProtection',
      'antiAging',
    ] as const;

    for (const key of notModeled) {
      expect(capabilities[key].score).toBeNull();
      expect(capabilities[key].confidence).toBe('insufficient_data');
      expect(capabilities[key].caveat).toBe('Not modeled in Milestone 1');
    }
  });

  it('returns null/insufficient_data (not the "not modeled" caveat) for the 4 reconciled Milestone 2 capabilities when zero classes resolve', () => {
    const capabilities = buildCapabilities([], joinActiveKeys([]));
    const reconciled = ['hydration', 'brightening', 'pigmentation', 'soothing'] as const;

    for (const key of reconciled) {
      expect(capabilities[key].score).toBeNull();
      expect(capabilities[key].confidence).toBe('insufficient_data');
      expect(capabilities[key].caveat).toBe('No resolved active classes to assess this capability from.');
    }
  });
});

describe('buildCapabilities — Milestone 2 reconciled capabilities (docs/tasks/product_profile/03-capabilities.md §3/§4/§5/§9)', () => {
  it('scores Hydration above zero and lists the contributing class for panthenol (concerns:dryness, not in goals.dehydration)', () => {
    const capabilities = buildCapabilities(['panthenol'], joinActiveKeys(['panthenol']));

    expect(capabilities.hydration.score).toBeCloseTo(1 / 3);
    expect(capabilities.hydration.confidence).toBe('heuristic');
    expect(capabilities.hydration.contributingClasses).toEqual(['panthenol']);
    expect(capabilities.hydration.sourceRefs).toEqual(['actives.json:concerns.dryness']);
  });

  it('saturates Hydration at score 1 with 3+ contributing classes', () => {
    const keys = ['hyaluronic_acid', 'glycerin_class', 'ceramides', 'panthenol'] as const;
    const capabilities = buildCapabilities([...keys], joinActiveKeys([...keys]));

    expect(capabilities.hydration.score).toBe(1);
  });

  it('scores Hydration a real heuristic 0 for a resolved product with no contributing class', () => {
    const capabilities = buildCapabilities(['aha'], joinActiveKeys(['aha']));

    expect(capabilities.hydration.score).toBe(0);
    expect(capabilities.hydration.confidence).toBe('heuristic');
    expect(capabilities.hydration.contributingClasses).toEqual([]);
  });

  it('excludes retinoid from Brightening (§0a double-counting exclusion) even though it is present', () => {
    const capabilities = buildCapabilities(['retinoid'], joinActiveKeys(['retinoid']));

    expect(capabilities.brightening.score).toBe(0);
    expect(capabilities.brightening.contributingClasses).toEqual([]);
  });

  it('scores Brightening for aha, which actives.json includes but labels.ts excludes', () => {
    const capabilities = buildCapabilities(['aha'], joinActiveKeys(['aha']));

    expect(capabilities.brightening.score).toBeCloseTo(1 / 3);
    expect(capabilities.brightening.confidence).toBe('heuristic');
    expect(capabilities.brightening.contributingClasses).toEqual(['aha']);
  });

  it('scores Pigmentation identically to Brightening for the same product (option (a) — byte-identical source)', () => {
    const keys = ['vitamin_c_pure', 'retinoid'] as const;
    const capabilities = buildCapabilities([...keys], joinActiveKeys([...keys]));

    expect(capabilities.pigmentation.score).toBe(capabilities.brightening.score);
    expect(capabilities.pigmentation.contributingClasses).toEqual(capabilities.brightening.contributingClasses);
  });

  it('scores Soothing for cica, panthenol, niacinamide, and azelaic_acid (concerns:redness)', () => {
    const keys = ['cica', 'panthenol', 'niacinamide', 'azelaic_acid'] as const;
    const capabilities = buildCapabilities([...keys], joinActiveKeys([...keys]));

    expect(capabilities.soothing.score).toBe(1);
    expect(capabilities.soothing.contributingClasses).toEqual([...keys]);
  });

  it('excludes copper_peptides from Soothing (activeBadges.ts outlier, rejected per §9)', () => {
    const capabilities = buildCapabilities(['copper_peptides'], joinActiveKeys(['copper_peptides']));

    expect(capabilities.soothing.score).toBe(0);
    expect(capabilities.soothing.contributingClasses).toEqual([]);
  });
});

describe('buildCapabilities — resolved classes present', () => {
  it('scores Barrier Repair a real deterministic 0 for a resolved product with no contributing class', () => {
    const resolvedActiveKeys = ['aha'] as const;
    const capabilities = buildCapabilities([...resolvedActiveKeys], joinActiveKeys([...resolvedActiveKeys]));

    expect(capabilities.barrierRepair.score).toBe(0);
    expect(capabilities.barrierRepair.confidence).toBe('deterministic');
    expect(capabilities.barrierRepair.contributingClasses).toEqual([]);
  });

  it('scores Barrier Repair above zero and lists the contributing class for ceramides', () => {
    const capabilities = buildCapabilities(['ceramides'], joinActiveKeys(['ceramides']));

    expect(capabilities.barrierRepair.score).toBeCloseTo(1 / 3);
    expect(capabilities.barrierRepair.confidence).toBe('deterministic');
    expect(capabilities.barrierRepair.contributingClasses).toEqual(['ceramides']);
    expect(capabilities.barrierRepair.sourceRefs).toEqual(['actives.json:properties.barrierRepair']);
  });

  it('scores Exfoliation a real deterministic 1 for a single exfoliating class', () => {
    const capabilities = buildCapabilities(['aha'], joinActiveKeys(['aha']));

    expect(capabilities.exfoliation.score).toBeCloseTo(1 / 3);
    expect(capabilities.exfoliation.confidence).toBe('deterministic');
    expect(capabilities.exfoliation.contributingClasses).toEqual(['aha']);
  });

  it('saturates Barrier Repair at score 1 with 3+ contributing classes', () => {
    const keys = ['ceramides', 'niacinamide', 'copper_peptides', 'panthenol'] as const;
    const capabilities = buildCapabilities([...keys], joinActiveKeys([...keys]));

    expect(capabilities.barrierRepair.score).toBe(1);
  });

  it('never marks a not-yet-modeled capability as deterministic or heuristic even with resolved classes present', () => {
    const capabilities = buildCapabilities(['ceramides'], joinActiveKeys(['ceramides']));

    expect(capabilities.acneControl.score).toBeNull();
    expect(capabilities.acneControl.confidence).toBe('insufficient_data');
  });
});
