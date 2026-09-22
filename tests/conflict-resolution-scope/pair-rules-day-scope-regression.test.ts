/**
 * FE-2 — Story 4 (spec §Story 4 AC1/AC2): every `pairRules` entry that ships
 * today, live or still-gated proposed, must declare an explicit
 * `resolutionScope`. Originally every entry shipped 'day' (reproducing
 * today's exact day-level-binary warning behavior, tech design §2,
 * Assumption 3). `rule_vitc_pure_acids` (Vitamin C pure + AHA/BHA) was
 * reclassified 'day' -> 'slot' on 2026-09-22 — the one row in
 * progress/conflict-resolution-scope-handoff.json's
 * still_blocked.bounded_decision_list with unanimous, uncontested research
 * support (see progress/conflict-resolution-scope.md log). Every other pair
 * stays 'day' pending stronger sourcing or an actual clinical reviewer.
 *
 * Written BEFORE the engineer's implementation — `resolutionScope` does not
 * exist on any entry yet, so every assertion below is EXPECTED TO FAIL (red)
 * until FE-2 ships (docs/tech-design/conflict-resolution-scope.md §3).
 *
 * Deliberately narrower in shape than FE-7 (the co-located
 * rulesetIntegrity.test.ts completeness audit, engineer-owned): this file
 * pins specific known rule IDs to a specific expected value rather than
 * looping "does every entry declare SOME resolutionScope". That is a real,
 * non-overlapping gap FE-7 alone would not catch: a rule shipping
 * `resolutionScope: 'slot'` by mistake still "declares a resolutionScope",
 * so FE-7 would pass while this file would (correctly) fail.
 */
import activesRuleset from '@/constants/rulesets/actives.json';
import { PROPOSED_V12_PAIR_RULES } from '@/constants/rulesets/proposedPairRules';

interface ResolutionScopeSnapshot {
  id: string;
  resolutionScope?: 'slot' | 'day';
}

// ─── Live pairs (actives.json) ─────────────────────────────────────────────

const LIVE_PAIR_RULES = activesRuleset.pairRules as unknown as ResolutionScopeSnapshot[];

const DAY_SCOPED_LIVE_PAIR_IDS = [
  'rule_retinol_aha',
  'rule_retinol_bha',
  'rule_benzoyl_retinol',
  'rule_copper_peptides_acids',
  'rule_vitc_pure_copper_peptides',
  'rule_vitc_derivative_bpo',
];

const SLOT_SCOPED_LIVE_PAIR_IDS = ['rule_vitc_pure_acids'];

const LIVE_PAIR_IDS = [...DAY_SCOPED_LIVE_PAIR_IDS, ...SLOT_SCOPED_LIVE_PAIR_IDS];

function liveRuleById(id: string): ResolutionScopeSnapshot {
  const rule = LIVE_PAIR_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Expected live pairRule "${id}" to still exist`);
  return rule;
}

describe('actives.json pairRules — resolutionScope per pair (Story 4 AC1)', () => {
  it.each(DAY_SCOPED_LIVE_PAIR_IDS)('%s declares resolutionScope: "day"', (id) => {
    expect(liveRuleById(id).resolutionScope).toBe('day');
  });

  it.each(SLOT_SCOPED_LIVE_PAIR_IDS)('%s declares resolutionScope: "slot"', (id) => {
    expect(liveRuleById(id).resolutionScope).toBe('slot');
  });

  it('ships exactly these 7 live pairs — no pair silently added or removed by this task', () => {
    expect(LIVE_PAIR_RULES.map((r) => r.id).sort()).toEqual([...LIVE_PAIR_IDS].sort());
  });
});

// ─── Proposed, still-gated pairs (proposedPairRules.ts) ────────────────────

const PROPOSED_PAIR_RULES = PROPOSED_V12_PAIR_RULES as unknown as ResolutionScopeSnapshot[];

const PROPOSED_PAIR_IDS = [
  'proposed_bpo_acids',
  'proposed_bpo_copper_peptides',
  'proposed_bpo_vitamin_c_pure',
  'proposed_azelaic_acids',
];

function proposedRuleById(id: string): ResolutionScopeSnapshot {
  const rule = PROPOSED_PAIR_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Expected proposed pairRule "${id}" to still exist`);
  return rule;
}

describe('proposedPairRules.ts — every gated draft pair ships resolutionScope: "day" (Story 4 AC2)', () => {
  it.each(PROPOSED_PAIR_IDS)('%s declares resolutionScope: "day"', (id) => {
    expect(proposedRuleById(id).resolutionScope).toBe('day');
  });

  it('ships exactly these 4 proposed pairs, asserted independent of PROPOSED_V12_PAIR_RULES_ENABLED', () => {
    // Read directly off the exported array, not getProposedPairRules(), so
    // this assertion holds regardless of the feature flag's current value —
    // the flag gates whether the pairs are APPLIED, not whether they carry a
    // resolutionScope classification (spec Story 4 AC2).
    expect(PROPOSED_PAIR_RULES.map((r) => r.id).sort()).toEqual([...PROPOSED_PAIR_IDS].sort());
  });
});
