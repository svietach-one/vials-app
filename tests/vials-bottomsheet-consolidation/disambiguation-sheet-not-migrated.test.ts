/**
 * Regression guard — Story 2 ACs 1-3: DisambiguationSheet was never built and
 * this task must not introduce it or touch CaptureFlowScreen.
 * Spec: docs/specs/vials-bottomsheet-consolidation.md §4 Story 2
 * Tech design: docs/tech-design/vials-bottomsheet-consolidation.md §1, §4, §5
 *
 * Story 2 is a documented negative finding, not a component to build — see
 * progress/vials-bottomsheet-consolidation.md's Log and the human
 * requester's 2026-08-21 resolution (option a: drop the migration
 * deliverable entirely). This file is a filesystem-level scope-creep guard,
 * mirroring the fs.readFileSync source-inspection precedent in
 * tests/conflict-matrix-expansion/ConflictWarningInline.severity-prefix.test.tsx,
 * so a future change can't silently reintroduce
 * `DisambiguationSheet.tsx` or start editing CaptureFlowScreen's
 * MatchResultsStep under this task's banner without a human decision.
 */
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

describe('Story 2 AC1: a full-text search of src/ for DisambiguationSheet returns zero matches', () => {
  it('finds no file or reference named DisambiguationSheet anywhere under src/', () => {
    const files = walk(SRC_ROOT).filter((f) => /\.(ts|tsx)$/.test(f));
    const matches = files.filter((f) => fs.readFileSync(f, 'utf8').includes('DisambiguationSheet'));

    expect(matches).toEqual([]);
  });
});

describe('Story 2 AC2: no DisambiguationSheet.tsx file is introduced by this task', () => {
  it('confirms src/components/**/DisambiguationSheet.tsx does not exist', () => {
    const files = walk(SRC_ROOT);
    const introduced = files.filter((f) => path.basename(f) === 'DisambiguationSheet.tsx');

    expect(introduced).toEqual([]);
  });
});

describe('Story 2 AC3: CaptureFlowScreen keeps its own MatchResultsStep untouched by this task', () => {
  const captureFlowPath = path.resolve(SRC_ROOT, 'screens/catalog/CaptureFlowScreen.tsx');

  it('still defines MatchResultsStep and does not reference DisambiguationSheet or BottomSheet', () => {
    const src = fs.readFileSync(captureFlowPath, 'utf8');

    expect(src).toMatch(/function MatchResultsStep/);
    expect(src).not.toMatch(/DisambiguationSheet/);
    // This task's BottomSheet is explicitly not folded into CaptureFlowScreen's
    // candidate picker (Open Question 1, deferred) — a future import here
    // would signal an undiscussed scope change, not a passing regression.
    expect(src).not.toMatch(/BottomSheet/);
  });
});
