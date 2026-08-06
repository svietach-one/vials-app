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

  it('returns null/insufficient_data for every one of the 8 not-yet-modeled capabilities', () => {
    const capabilities = buildCapabilities([], joinActiveKeys([]));
    const notModeled = [
      'hydration',
      'brightening',
      'pigmentation',
      'acneControl',
      'sebumRegulation',
      'antioxidantProtection',
      'soothing',
      'antiAging',
    ] as const;

    for (const key of notModeled) {
      expect(capabilities[key].score).toBeNull();
      expect(capabilities[key].confidence).toBe('insufficient_data');
      expect(capabilities[key].caveat).toBe('Not modeled in Milestone 1');
    }
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

  it('never marks a not-yet-modeled capability as deterministic even with resolved classes present', () => {
    const capabilities = buildCapabilities(['ceramides'], joinActiveKeys(['ceramides']));

    expect(capabilities.hydration.score).toBeNull();
    expect(capabilities.hydration.confidence).toBe('insufficient_data');
  });
});
