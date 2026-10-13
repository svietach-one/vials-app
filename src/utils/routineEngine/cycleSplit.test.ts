import { computeCycleSplitDays } from '@/utils/routineEngine/cycleSplit';

describe('computeCycleSplitDays — matching caps (day-split-alternation FE-3/FE-7)', () => {
  it('returns the byte-identical [Tue, Sat] winner split and a disjoint [Mon, Thu] rival split at 2/2', () => {
    const { winnerDays, rivalDays } = computeCycleSplitDays(2, 2);
    expect(winnerDays).toEqual([2, 6]);
    expect(rivalDays).toEqual([1, 4]);
  });
});

describe('computeCycleSplitDays — divergent caps', () => {
  it('sizes both sides to the SMALLER of the two caps, never the larger', () => {
    const { winnerDays, rivalDays } = computeCycleSplitDays(4, 2);
    expect(winnerDays).toHaveLength(2);
    expect(rivalDays).toHaveLength(2);
  });

  it('is symmetric regardless of which argument is smaller', () => {
    const a = computeCycleSplitDays(4, 2);
    const b = computeCycleSplitDays(2, 4);
    expect(a.winnerDays).toHaveLength(2);
    expect(b.winnerDays).toHaveLength(2);
    expect(a.rivalDays).toHaveLength(2);
    expect(b.rivalDays).toHaveLength(2);
  });
});

describe('computeCycleSplitDays — never overlapping', () => {
  it('produces disjoint day sets for every cap combination from 1 to 3', () => {
    for (let winnerCap = 1; winnerCap <= 3; winnerCap += 1) {
      for (let rivalCap = 1; rivalCap <= 3; rivalCap += 1) {
        const { winnerDays, rivalDays } = computeCycleSplitDays(winnerCap, rivalCap);
        const overlap = winnerDays.some((d) => rivalDays.includes(d));
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('computeCycleSplitDays — single-day caps', () => {
  it('picks one day per side, still disjoint', () => {
    const { winnerDays, rivalDays } = computeCycleSplitDays(1, 1);
    expect(winnerDays).toEqual([2]);
    expect(rivalDays).toEqual([1]);
  });
});

describe('computeCycleSplitDays — fallback-free-day path', () => {
  it('falls back to remaining free days when size exceeds either preference set (size=3)', () => {
    const { winnerDays, rivalDays } = computeCycleSplitDays(3, 3);
    expect(winnerDays).toHaveLength(3);
    expect(rivalDays).toHaveLength(3);
    // Both preferred days are always included first.
    expect(winnerDays).toEqual(expect.arrayContaining([2, 6]));
    expect(rivalDays).toEqual(expect.arrayContaining([1, 4]));
    expect(winnerDays.some((d) => rivalDays.includes(d))).toBe(false);
  });
});

describe('computeCycleSplitDays — determinism', () => {
  it('returns an identical result for the same inputs across repeated calls', () => {
    const a = computeCycleSplitDays(2, 2);
    const b = computeCycleSplitDays(2, 2);
    expect(a).toEqual(b);
  });
});
