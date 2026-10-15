/**
 * GENERATOR for essential-plans.golden.json. Skipped unless
 * REGENERATE_ESSENTIAL_GOLDEN=1, so a normal `npm test` never rewrites it.
 *
 *   REGENERATE_ESSENTIAL_GOLDEN=1 npx jest tests/intermediate-routine/golden \
 *     --testPathIgnorePatterns="worktrees"
 *
 * The golden file is the ORACLE for "Essential == today's engine"
 * (spec G6 / Story 6). It must be captured from an engine that predates the
 * Balanced work. Regenerating it later is a deliberate act: it redefines what
 * Essential means, so do it only when a reviewed engine change is meant to move
 * Essential output, and say so in progress/intermediate-routine.md.
 *
 * Each case stores its INPUT as well as the plan, so the oracle is immune to
 * later edits of the shelf generator in ../fixtures.ts.
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildSweepShelf, normaliseEssentialPlan, resetFixtureCounters } from '../fixtures';

export const GOLDEN_CASES = 600;
const GOLDEN_SALT = 91;
const OUT = join(__dirname, 'essential-plans.golden.json');

const run = process.env.REGENERATE_ESSENTIAL_GOLDEN === '1' ? it : it.skip;

run(`writes ${GOLDEN_CASES} Essential reference plans from the current engine`, () => {
  resetFixtureCounters();
  const commit = execSync('git rev-parse HEAD', { cwd: join(__dirname, '../../..') }).toString().trim();
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: join(__dirname, '../../..') }).toString().trim();
  const cases = [];
  for (let seed = 0; seed < GOLDEN_CASES; seed += 1) {
    const { input } = buildSweepShelf(seed, 'essential', { salt: GOLDEN_SALT });
    // Inputs are stored WITHOUT `depth`: the oracle pre-dates the field.
    const { depth: _depth, ...stored } = input;
    cases.push({ seed, input: { ...stored, now: input.now?.toISOString() }, plan: normaliseEssentialPlan(generatePlan(input)) });
  }
  const file = {
    _meta: {
      purpose: 'Essential-style regression oracle for the intermediate-routine task (spec G6).',
      capturedFromCommit: commit,
      capturedOnBranch: branch,
      baseBranch: 'origin/dev @ 5ed283f',
      generator: 'tests/intermediate-routine/golden/regenerate-essential-golden.test.ts',
      normalisation: 'rulesetVersion dropped; outside_routine_depth -> not_needed_for_goals',
      cases: GOLDEN_CASES,
    },
    cases,
  };
  writeFileSync(OUT, JSON.stringify(file));
});
