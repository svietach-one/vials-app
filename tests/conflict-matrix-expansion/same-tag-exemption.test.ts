/**
 * FE-9 — the same-tag exemption is structural (never a hardcoded skip list).
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3
 * ("confirm this holds for physical_exfoliant too once it's a real class").
 *
 * actives.json never pairs a class with itself (rulesetIntegrity.test.ts's
 * "never pairs a class with itself" invariant, mirrored independently for
 * physical_exfoliant specifically in physical-exfoliant-ruleset-class.test.ts).
 * This file proves the BEHAVIOURAL consequence at the public ConflictEngine
 * API: two products that share only one identical active tag are never
 * flagged as conflicting with each other — for an arbitrary pre-existing
 * class, and for physical_exfoliant once FE-1/FE-2/FE-3 land. No per-class
 * exemption list exists anywhere for this to be a hardcoded special case.
 */
import { ConflictEngine } from '@/utils/conflictEngine';
import { makeProduct, makeStep } from './fixtures';

describe('same active tag on two products is never flagged as a self-conflict (generic tagA===tagB check)', () => {
  it('does not conflict two products that both carry only the aha tag', () => {
    const a = makeProduct(['aha'], { name: 'Toner A' });
    const b = makeProduct(['aha'], { name: 'Toner B' });
    const steps = [makeStep(a.id), makeStep(b.id)];

    expect(ConflictEngine.detectConflicts(steps, [a, b])).toEqual([]);
  });

  it('does not conflict two products that both carry only the retinoid tag', () => {
    const a = makeProduct(['retinoid'], { name: 'Retinol Serum A' });
    const b = makeProduct(['retinoid'], { name: 'Retinol Serum B' });
    const steps = [makeStep(a.id), makeStep(b.id)];

    expect(ConflictEngine.detectConflicts(steps, [a, b])).toEqual([]);
  });

  it('does not conflict two products that both carry only the benzoyl_peroxide tag', () => {
    const a = makeProduct(['benzoyl_peroxide'], { name: 'BPO Gel A' });
    const b = makeProduct(['benzoyl_peroxide'], { name: 'BPO Gel B' });
    const steps = [makeStep(a.id), makeStep(b.id)];

    expect(ConflictEngine.detectConflicts(steps, [a, b])).toEqual([]);
  });

  it('does not conflict two products that are both flagged isPhysicalExfoliant, with no other overlapping active', () => {
    const a = makeProduct([], { name: 'Scrub A', isPhysicalExfoliant: true });
    const b = makeProduct([], { name: 'Scrub B', isPhysicalExfoliant: true });
    const steps = [makeStep(a.id), makeStep(b.id)];

    expect(ConflictEngine.detectConflicts(steps, [a, b])).toEqual([]);
  });

  it('still conflicts two products on a genuinely different, ruled pair — the exemption is not a blanket "never conflict"', () => {
    // Sanity check the same suite could catch an over-broad exemption
    // implementation (e.g. one that accidentally treats every pair as
    // compatible).
    const retinoid = makeProduct(['retinoid']);
    const acid = makeProduct(['aha']);
    const steps = [makeStep(retinoid.id), makeStep(acid.id)];

    expect(ConflictEngine.detectConflicts(steps, [retinoid, acid])).toHaveLength(1);
  });
});
