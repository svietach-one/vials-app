/**
 * Unit test — `goalFit.ts` (explore-fit-signals FE-1).
 * Spec: docs/specs/explore-fit-signals.md §4 Story 1
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-1
 *
 * Pure logic only — no React, no react-native, no store (.claude/rules/testing.md).
 */
import { buildGoalFit, buildGoalFitMatchMessage, buildGoalFitMissMessage } from './goalFit';

describe('buildGoalFit — goal list construction', () => {
  it('returns an empty array when primaryGoal is maintenance and secondaryGoal is null', () => {
    const findings = buildGoalFit(['niacinamide'], 'maintenance', null);

    expect(findings).toEqual([]);
  });

  it('returns one finding for a single real primaryGoal', () => {
    const findings = buildGoalFit(['niacinamide'], 'acne', null);

    expect(findings).toEqual([{ goal: 'acne', matchedKeys: ['niacinamide'] }]);
  });

  it('returns two findings when primaryGoal and secondaryGoal are two different real goals', () => {
    const findings = buildGoalFit(['niacinamide'], 'acne', 'dehydration');

    expect(findings.map((f) => f.goal)).toEqual(['acne', 'dehydration']);
  });

  it('de-duplicates when primaryGoal and secondaryGoal are set to the same real goal', () => {
    const findings = buildGoalFit(['niacinamide'], 'acne', 'acne');

    expect(findings).toHaveLength(1);
    expect(findings[0].goal).toBe('acne');
  });

  it('drops secondaryGoal when it is maintenance, keeping only the real primaryGoal', () => {
    const findings = buildGoalFit(['niacinamide'], 'acne', 'maintenance');

    expect(findings).toEqual([{ goal: 'acne', matchedKeys: ['niacinamide'] }]);
  });
});

describe('buildGoalFit — match / miss branch', () => {
  it('returns matchedKeys naming every detected active that overlaps the goal (match branch)', () => {
    const findings = buildGoalFit(['azelaic_acid', 'niacinamide', 'retinoid'], 'oil_control', null);

    expect(findings[0].matchedKeys.sort()).toEqual(['azelaic_acid', 'niacinamide'].sort());
  });

  it('returns an empty matchedKeys array when no detected active overlaps the goal (honest miss branch, spec §10 Open Question 1)', () => {
    const findings = buildGoalFit(['retinoid'], 'dehydration', null);

    expect(findings).toEqual([{ goal: 'dehydration', matchedKeys: [] }]);
  });

  it('returns an empty matchedKeys array for an empty resolvedActiveKeys list', () => {
    const findings = buildGoalFit([], 'acne', null);

    expect(findings).toEqual([{ goal: 'acne', matchedKeys: [] }]);
  });
});

describe('buildGoalFitMatchMessage — factual, no invented numbers', () => {
  it('names the single matched active and the goal', () => {
    const message = buildGoalFitMatchMessage('acne', ['niacinamide']);

    expect(message).toMatch(/niacinamide/i);
    expect(message).toMatch(/clear acne/i);
    expect(message).not.toMatch(/%/);
    expect(message).not.toMatch(/\bscore\b|\bconfidence\b/i);
  });

  it('names every matched active when more than one overlaps the goal', () => {
    const message = buildGoalFitMatchMessage('pigmentation', ['azelaic_acid', 'niacinamide']);

    expect(message).toMatch(/azelaic acid/i);
    expect(message).toMatch(/niacinamide/i);
  });
});

describe('buildGoalFitMissMessage — honest miss, no invented numbers', () => {
  it('names the goal and never claims an active match', () => {
    const message = buildGoalFitMissMessage('dehydration');

    expect(message).toMatch(/deep hydration/i);
    expect(message).not.toMatch(/%/);
    expect(message).not.toMatch(/\bscore\b|\bconfidence\b/i);
  });
});
