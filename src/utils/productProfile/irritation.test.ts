import {
  buildIrritationProfile,
  buildSensitivityCompatibility,
} from '@/utils/productProfile/irritation';
import { joinActiveKeys } from '@/utils/productProfile/join';

describe('buildIrritationProfile — zero resolved active classes', () => {
  it('returns null/insufficient_data rather than a guessed 0', () => {
    const irritation = buildIrritationProfile(joinActiveKeys([]));

    expect(irritation.score).toBeNull();
    expect(irritation.confidence).toBe('insufficient_data');
    expect(irritation.photosensitizing).toBe(false);
    expect(irritation.lowPh).toBe(false);
  });
});

describe('buildIrritationProfile — resolved classes present', () => {
  it('reports a real deterministic-source 0 for an inert class (ceramides)', () => {
    const irritation = buildIrritationProfile(joinActiveKeys(['ceramides']));

    expect(irritation.score).toBe(0);
    expect(irritation.confidence).toBe('heuristic'); // aggregation formula is always >= heuristic
    expect(irritation.aggregationMethod).toBe('max_of_present');
    expect(irritation.sourceRefs).toEqual(['actives.json:classes.ceramides.properties.irritancy']);
  });

  it('takes the max irritancy across present classes (max_of_present)', () => {
    // ceramides: 0, aha: 3 -> max is 3
    const irritation = buildIrritationProfile(joinActiveKeys(['ceramides', 'aha']));

    expect(irritation.score).toBe(3);
  });

  it('OR-merges photosensitizing across present classes', () => {
    // aha is photosensitizing; ceramides is not
    const irritation = buildIrritationProfile(joinActiveKeys(['ceramides', 'aha']));

    expect(irritation.photosensitizing).toBe(true);
  });

  it('OR-merges lowPh across present classes', () => {
    // vitamin_c_pure is lowPh; ceramides is not
    const irritation = buildIrritationProfile(joinActiveKeys(['ceramides', 'vitamin_c_pure']));

    expect(irritation.lowPh).toBe(true);
  });

  it('always tags confidence as heuristic at minimum, never deterministic', () => {
    const irritation = buildIrritationProfile(joinActiveKeys(['ceramides']));

    expect(irritation.confidence).not.toBe('deterministic');
  });
});

describe('buildSensitivityCompatibility — Milestone 1 placeholder', () => {
  it('ships compatible=null, thresholdUsed=null, confidence=insufficient_data unconditionally', () => {
    const sensitivity = buildSensitivityCompatibility();

    expect(sensitivity.compatible).toBeNull();
    expect(sensitivity.thresholdUsed).toBeNull();
    expect(sensitivity.confidence).toBe('insufficient_data');
    expect(sensitivity.caveat).toBeTruthy();
  });
});
