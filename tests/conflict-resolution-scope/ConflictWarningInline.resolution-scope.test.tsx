/**
 * FE-3/FE-4/FE-5 — resolutionScope ('slot' | 'day') branching in
 * ConflictEngine.detectConflicts, exercised through the real
 * ConflictWarningInline component (the shared warning-rendering primitive
 * used by RoutinesScreen).
 *
 * Spec: docs/specs/conflict-resolution-scope.md — Stories 1, 2, 3
 * Tech design: docs/tech-design/conflict-resolution-scope.md §1, §3 (FE-3/4/5)
 *
 * Written BEFORE the engineer's implementation, per the qa-lead -> engineer
 * handoff (.claude/rules/agent-layer-protocol.md). Today, `detectConflicts`
 * warns whenever both conflicting steps are present in the merged step list
 * regardless of period, so the "slot pair split across AM/PM clears the
 * warning" tests below are EXPECTED TO FAIL (red) until FE-3 ships. The
 * day-scoped regression tests are expected to already pass, since every real
 * pair defaults to `resolutionScope: 'day'` — today's exact behavior
 * (spec §2 "Zero warning-behavior change").
 *
 * Story 1 AC3 requires proving the slot branch via a TEST FIXTURE rule, not
 * a live one. The fixture pair below (niacinamide + peptide_signal) is
 * injected only into this file's module registry via jest.mock and does not
 * touch the real ruleset. `rule_vitc_pure_acids` (Vitamin C pure + AHA/BHA)
 * was separately reclassified 'day' -> 'slot' on 2026-09-22 — the one row in
 * progress/conflict-resolution-scope-handoff.json's
 * still_blocked.bounded_decision_list with unanimous research support (see
 * progress/conflict-resolution-scope.md log) — and gets its own real-pair
 * coverage in Story 5 below. Every other real pair stays 'day'.
 *
 * The fixture rule literal lives ENTIRELY inside the jest.mock factory below
 * (not a separate top-level const referenced from it): `@babel/plugin-
 * transform-modules-commonjs` hoists every import-derived `require()` call —
 * including ones textually written AFTER this file's other top-level
 * statements — above any plain `const`, so a `mock`-prefixed const declared
 * mid-file is still `undefined` by the time the factory runs (verified
 * empirically while authoring this suite). Reading the injected rule back
 * off `ACTIVES_RULESET.pairRules` by id, after the imports, sidesteps the
 * hazard entirely.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

const FIXTURE_SLOT_RULE_ID = 'fixture_slot_niacinamide_peptide';

jest.mock('@/constants/rulesets/actives.json', () => {
  const actual = jest.requireActual('@/constants/rulesets/actives.json');
  return {
    ...actual,
    pairRules: [
      ...actual.pairRules,
      {
        id: 'fixture_slot_niacinamide_peptide',
        a: 'niacinamide',
        b: 'peptide_signal',
        scope: 'same_period',
        severity: 'caution',
        reasonCode: 'vitamin_c_copper_conflict',
        resolutions: ['separate_periods'],
        explanation:
          'Fixture-only conflict for resolution-scope QA coverage (niacinamide and peptide signal do not actually conflict in the real ruleset).',
        suggestion:
          'FIXTURE_STORED_SUGGESTION_TEXT — must never render once the slot-scope actionable-copy override applies in the same-period case.',
        resolutionScope: 'slot',
      },
    ],
  };
});

import { ConflictWarningInline } from '@/components/routine/ConflictWarningInline';
import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { escapeRegExp, makeProduct, makeStep } from './fixtures';

/** The mocked fixture rule, read back off the ruleset by id (see file banner). */
function fixtureSlotRule() {
  const rule = ACTIVES_RULESET.pairRules.find((r) => r.id === FIXTURE_SLOT_RULE_ID);
  if (!rule) {
    throw new Error(`Expected fixture pairRule "${FIXTURE_SLOT_RULE_ID}" to be injected via jest.mock`);
  }
  return rule;
}

// ─── Story 1: splitting a slot-resolvable pair across AM/PM clears the warning ─

describe('Story 1 — slot-scoped pairs clear when split across AM/PM (fixture rule)', () => {
  it('renders no conflict warning when a slot-scoped pair is split across morning and evening', () => {
    const niacinamide = makeProduct(['niacinamide']);
    const peptide = makeProduct(['peptide_signal']);

    const { toJSON } = render(
      <ConflictWarningInline
        morningSteps={[makeStep(niacinamide.id)]}
        eveningSteps={[makeStep(peptide.id)]}
        products={[niacinamide, peptide]}
      />,
    );

    expect(screen.queryByText('Ingredient conflict')).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it('still renders the conflict warning when both slot-scoped products are in the same morning routine', () => {
    const niacinamide = makeProduct(['niacinamide']);
    const peptide = makeProduct(['peptide_signal']);

    render(
      <ConflictWarningInline
        morningSteps={[makeStep(niacinamide.id), makeStep(peptide.id)]}
        eveningSteps={[]}
        products={[niacinamide, peptide]}
      />,
    );

    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });

  it('still renders the conflict warning when both slot-scoped products are in the same evening routine', () => {
    const niacinamide = makeProduct(['niacinamide']);
    const peptide = makeProduct(['peptide_signal']);

    render(
      <ConflictWarningInline
        morningSteps={[]}
        eveningSteps={[makeStep(niacinamide.id), makeStep(peptide.id)]}
        products={[niacinamide, peptide]}
      />,
    );

    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });
});

// ─── Story 2: additive-irritation (day-scoped) pairs keep warning regardless ──

describe('Story 2 — day-scoped pairs keep warning regardless of AM/PM split (regression)', () => {
  it('still renders the conflict warning for a live day-scoped pair (rule_retinol_aha) split across morning and evening', () => {
    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);

    render(
      <ConflictWarningInline
        morningSteps={[makeStep(retinoid.id)]}
        eveningSteps={[makeStep(acid.id)]}
        products={[retinoid, acid]}
      />,
    );

    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
  });

  it('renders no warning when only one side of a pair has a scheduled step at all (simulating a different day)', () => {
    const retinoid = makeProduct(['retinoid']);

    render(
      <ConflictWarningInline
        morningSteps={[makeStep(retinoid.id)]}
        eveningSteps={[]}
        products={[retinoid]}
      />,
    );

    expect(screen.queryByText('Ingredient conflict')).toBeNull();
  });
});

// ─── Story 3: actionable copy for a same-period slot conflict ────────────────

describe('Story 3 — actionable copy for a same-period slot conflict', () => {
  it('names the evening routine when a slot-scoped conflict fires in the morning', () => {
    const niacinamide = makeProduct(['niacinamide']);
    const peptide = makeProduct(['peptide_signal']);

    render(
      <ConflictWarningInline
        morningSteps={[makeStep(niacinamide.id), makeStep(peptide.id)]}
        eveningSteps={[]}
        products={[niacinamide, peptide]}
      />,
    );

    expect(screen.getByText(/evening routine/i)).toBeTruthy();
    expect(
      screen.queryByText(new RegExp(escapeRegExp(fixtureSlotRule().suggestion))),
    ).toBeNull();
  });

  it('names the morning routine when a slot-scoped conflict fires in the evening', () => {
    const niacinamide = makeProduct(['niacinamide']);
    const peptide = makeProduct(['peptide_signal']);

    render(
      <ConflictWarningInline
        morningSteps={[]}
        eveningSteps={[makeStep(niacinamide.id), makeStep(peptide.id)]}
        products={[niacinamide, peptide]}
      />,
    );

    expect(screen.getByText(/morning routine/i)).toBeTruthy();
    expect(
      screen.queryByText(new RegExp(escapeRegExp(fixtureSlotRule().suggestion))),
    ).toBeNull();
  });

  it('keeps a day-scoped pair\'s original stored suggestion unchanged when it fires (regression)', () => {
    const rule = ACTIVES_RULESET.pairRules.find((r) => r.id === 'rule_retinol_aha');
    if (!rule) throw new Error('Expected live pairRule "rule_retinol_aha" to still exist');

    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);

    render(
      <ConflictWarningInline
        morningSteps={[]}
        eveningSteps={[makeStep(retinoid.id), makeStep(acid.id)]}
        products={[retinoid, acid]}
      />,
    );

    expect(
      screen.getByText(new RegExp(escapeRegExp(rule.suggestion))),
    ).toBeTruthy();
  });
});

// ─── Story 5: real live pair reclassified to slot (rule_vitc_pure_acids) ─────

describe('Story 5 — rule_vitc_pure_acids (Vitamin C pure + AHA/BHA) is slot-scoped for real', () => {
  it('renders no conflict warning when split across morning and evening', () => {
    const vitaminC = makeProduct(['vitamin_c_pure']);
    const acid = makeProduct(['aha']);

    const { toJSON } = render(
      <ConflictWarningInline
        morningSteps={[makeStep(vitaminC.id)]}
        eveningSteps={[makeStep(acid.id)]}
        products={[vitaminC, acid]}
      />,
    );

    expect(screen.queryByText('Ingredient conflict')).toBeNull();
    expect(toJSON()).toBeNull();
  });

  it('still renders the conflict warning when both are in the same morning routine', () => {
    const vitaminC = makeProduct(['vitamin_c_pure']);
    const acid = makeProduct(['bha']);

    render(
      <ConflictWarningInline
        morningSteps={[makeStep(vitaminC.id), makeStep(acid.id)]}
        eveningSteps={[]}
        products={[vitaminC, acid]}
      />,
    );

    expect(screen.getByText('Ingredient conflict')).toBeTruthy();
    // Slot-scope actionable copy replaces the rule's stored suggestion, same
    // as the fixture rule in Story 3 — this is a real pair, not a fixture.
    expect(screen.getByText(/evening routine/i)).toBeTruthy();
    const rule = ACTIVES_RULESET.pairRules.find((r) => r.id === 'rule_vitc_pure_acids');
    if (!rule) throw new Error('Expected live pairRule "rule_vitc_pure_acids" to still exist');
    expect(
      screen.queryByText(new RegExp(escapeRegExp(rule.suggestion))),
    ).toBeNull();
  });
});
