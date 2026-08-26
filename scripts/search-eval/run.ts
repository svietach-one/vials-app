/**
 * Search-eval harness — built in Step 0 of the product-search-precision fix
 * (docs/tasks/ocr_improvement/01-eval-harness.md), updated in Step 1
 * (docs/tasks/ocr_improvement/02-segment-ocr-query.md) to mirror segmented-
 * OCR-query behaviour, and rewritten in Step 2
 * (docs/tasks/ocr_improvement/03-scoring-and-cutoff.md) to import and run
 * the REAL production modules instead of a hand-mirrored copy.
 *
 * Measures ProductRepository.search()'s CURRENT behaviour against the real
 * Turso corpus (no mocks) so every step has a before/after baseline instead
 * of a guess.
 *
 * Usage:
 *   npm run search-eval
 *   npm run search-eval -- --set minMatchScore=0.45 --label sweep-045
 *   npm run search-eval -- --compare baselines/8c1c01f.json
 *   npm run search-eval -- --tag typo
 *
 * ── Why this now imports src/ directly, and runs under `tsx` ──────────────
 * Steps 0 and 1 ran this file under plain `node <file>.ts` (Node's native
 * TypeScript type-stripping), which rejects two things the real source uses:
 * TS constructor parameter properties (`constructor(private db: ...)`) and
 * extensionless relative imports (`from './trigramSearch'`). Rather than
 * hand-port the query/scoring logic a second time — step 2 adds a 3-rule
 * token matcher, a short-query guard, asymmetric brand/name blending, 5
 * typed-search ranking tiers, and a 9-point threshold sweep whose entire
 * purpose is to produce a *trustworthy* tuning decision — a silently
 * diverging hand-mirror would be exactly the "looked plausible, was never
 * measured" failure this whole task exists to eliminate (00-README.md).
 * `tsx` (new devDependency, confirmed to resolve this project's `@/` path
 * alias and the TS syntax above with zero extra config) lets this file
 * import `ProductRepository`, `SEARCH_CONFIG`, `scoreCandidate.ts`,
 * `trigramSearch.ts`, `typedRanking.ts`, and `TursoHttpClient` directly, so
 * `new ProductRepository(new TursoHttpClient(...)).search(query)` runs the
 * exact same code path the app does. This file is now fixture loading,
 * config parsing, metrics computation, and reporting — no query/scoring
 * logic lives here anymore.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductRepository } from '@/services/corpus/ProductRepository';
import { SEARCH_CONFIG, type SearchConfig } from '@/services/corpus/searchConfig';
import type { CorpusProduct, ProductQuery, ScoredCorpusProduct } from '@/services/corpus/types';
import { TursoHttpClient } from '@/services/turso/httpClient';
import { buildOcrProductQuery } from '@/utils/productForm/ocrNormalizer';
import { normalizeForMatch } from '@/utils/textNormalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');
const BASELINES_DIR = join(__dirname, 'baselines');

/** Keys later steps haven't implemented yet — `--set` on these is parsed/echoed but has no real effect. */
const NOT_YET_IMPLEMENTED_KEYS = new Set<keyof SearchConfig>([
  'brandFilterThreshold', // step 3 (skipped, see progress/ocr-improvement.md)
  'wordIndexEnabled', // step 5
]);

// ── CLI ───────────────────────────────────────────────────────────────────

interface CliArgs {
  overrides: Partial<SearchConfig>;
  overrideKeysRaw: string[];
  label: string | null;
  comparePath: string | null;
  tagFilter: string | null;
}

function coerceConfigValue(raw: string): boolean | number | string {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (raw.trim() !== '' && !Number.isNaN(n)) return n;
  return raw;
}

function parseArgs(argv: string[]): CliArgs {
  const overrides: Partial<SearchConfig> = {};
  const overrideKeysRaw: string[] = [];
  let label: string | null = null;
  let comparePath: string | null = null;
  let tagFilter: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--set') {
      const pair = argv[++i];
      if (!pair || !pair.includes('=')) {
        throw new Error(`--set requires key=value, got: ${pair ?? '(nothing)'}`);
      }
      const [key, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (!(key in SEARCH_CONFIG)) {
        console.warn(`[search-eval] warning: --set ${key} is not a known SEARCH_CONFIG key, ignoring`);
        continue;
      }
      overrideKeysRaw.push(key);
      (overrides as Record<string, unknown>)[key] = coerceConfigValue(value);
    } else if (arg === '--label') {
      label = argv[++i] ?? null;
    } else if (arg === '--compare') {
      comparePath = argv[++i] ?? null;
    } else if (arg === '--tag') {
      tagFilter = argv[++i] ?? null;
    } else if (arg === '--help') {
      console.log(
        'Usage: npm run search-eval -- [--set key=value ...] [--label name] [--compare file] [--tag tagname]',
      );
      process.exit(0);
    }
  }
  return { overrides, overrideKeysRaw, label, comparePath, tagFilter };
}

// ── Corpus client ────────────────────────────────────────────────────────

function createClient(): TursoHttpClient {
  const url = process.env.EXPO_PUBLIC_TURSO_HTTP_URL;
  const token = process.env.EXPO_PUBLIC_TURSO_TOKEN;
  if (!url || !token) {
    console.error(
      '[search-eval] EXPO_PUBLIC_TURSO_HTTP_URL / EXPO_PUBLIC_TURSO_TOKEN are not set.\n' +
        'This harness needs read-only access to the real corpus — set both in .env.local ' +
        '(see .env.example) and re-run. Never commit their values.',
    );
    process.exit(1);
  }
  return new TursoHttpClient(url, token);
}

// ── Fixtures ─────────────────────────────────────────────────────────────

interface FixtureCase {
  id: string;
  query?: string;
  rawText?: string;
  expected: string;
  tags: string[];
}

interface LoadedCase extends FixtureCase {
  set: 'typed' | 'label';
}

function loadFixtures(): LoadedCase[] {
  const typed = JSON.parse(readFileSync(join(FIXTURES_DIR, 'typed-queries.json'), 'utf8')) as FixtureCase[];
  const label = JSON.parse(readFileSync(join(FIXTURES_DIR, 'label-captures.json'), 'utf8')) as FixtureCase[];

  const cases: LoadedCase[] = [
    ...typed.map((c) => ({ ...c, set: 'typed' as const })),
    ...label.map((c) => ({ ...c, set: 'label' as const })),
  ];

  for (const c of cases) {
    if (!c.id || !c.expected || !Array.isArray(c.tags) || c.tags.length === 0) {
      throw new Error(`Fixture ${c.id ?? '(no id)'} is missing id/expected/tags`);
    }
    const hasSourceText = c.set === 'typed' ? !!c.query : !!c.rawText;
    if (!hasSourceText) {
      throw new Error(`Fixture ${c.id} has no query/rawText`);
    }
  }
  return cases;
}

/**
 * Builds the exact ProductQuery the real call sites build (CaptureFlowScreen.tsx
 * for label-captures.json via {@link buildOcrProductQuery}, AddProductHubScreen/
 * FirstProductScreen for typed-queries.json — a flat string, no brand).
 */
function buildQuery(c: LoadedCase): ProductQuery {
  if (c.set === 'typed') {
    const q = c.query ?? '';
    return { name: q, origin: 'typed', raw: q };
  }
  const rawText = c.rawText ?? '';
  return SEARCH_CONFIG.segmentOcrQuery ? buildOcrProductQuery(rawText) : { name: rawText, origin: 'ocr', raw: rawText };
}

function queryText(query: ProductQuery): string {
  return [query.brand, query.name].filter(Boolean).join(' ').trim();
}

// ── Metrics ──────────────────────────────────────────────────────────────

interface CaseResult {
  id: string;
  set: 'typed' | 'label';
  tags: string[];
  searchText: string;
  expected: string;
  expectedBrand: string | null;
  topRetrieved: CorpusProduct[]; // up to 10, pre-cutoff (recallLimit) order — for recall@retrieval + debugging
  displayResults: ScoredCorpusProduct[]; // ProductRepository.search()'s real output (already scored + capped)
  precision1: boolean | null; // null = not_in_corpus, not scored
  precision5: boolean | null;
  falseTop1: boolean | null;
  recallRetrieval: boolean | null;
  matched: boolean; // displayResults.length > 0
  latencyMs: number; // wall-clock time of the search() call itself (what the app experiences)
}

async function runCase(
  repo: ProductRepository,
  c: LoadedCase,
  expectedBrand: string | null,
): Promise<CaseResult> {
  const query = buildQuery(c);
  const searchText = queryText(query);
  const isRealExpectation = c.expected !== 'not_in_corpus';

  const t0 = performance.now();
  const displayResults = await repo.search(query);
  const latencyMs = performance.now() - t0;

  // Pre-cutoff candidate pool, for recall@retrieval — a separate call (not
  // timed as user-facing latency), always the new step-2 recall stage
  // regardless of SEARCH_CONFIG.scoringV2 (retrieveCandidates() has no
  // legacy-toggle equivalent — see ProductRepository.ts).
  const preCutoff = await repo.retrieveCandidates(query);

  let precision1: boolean | null = null;
  let precision5: boolean | null = null;
  let falseTop1: boolean | null = null;
  let recallRetrieval: boolean | null = null;

  if (isRealExpectation) {
    precision1 = displayResults[0]?.uid === c.expected;
    precision5 = displayResults.slice(0, 5).some((r) => r.uid === c.expected);
    recallRetrieval = preCutoff.some((r) => r.uid === c.expected);

    const top = displayResults[0];
    if (!top) {
      falseTop1 = false; // no-match is a different failure mode (no_match_rate), not a false top-1
    } else if (top.uid === c.expected) {
      falseTop1 = false;
    } else {
      const topBrand = normalizeForMatch(top.brand ?? '');
      const wantBrand = normalizeForMatch(expectedBrand ?? '');
      falseTop1 = topBrand !== wantBrand;
    }
  }

  return {
    id: c.id,
    set: c.set,
    tags: c.tags,
    searchText,
    expected: c.expected,
    expectedBrand,
    topRetrieved: preCutoff.slice(0, 10),
    displayResults,
    precision1,
    precision5,
    falseTop1,
    recallRetrieval,
    matched: displayResults.length > 0,
    latencyMs,
  };
}

interface Aggregate {
  n: number;
  precisionAt1: number | null;
  precisionAt5: number | null;
  falseTop1Rate: number | null;
  recallAtRetrieval: number | null;
  noMatchRateNotInCorpus: number | null;
  noMatchRateReal: number | null;
  meanResults: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function computeAggregate(cases: CaseResult[]): Aggregate {
  const real = cases.filter((c) => c.expected !== 'not_in_corpus');
  const notInCorpus = cases.filter((c) => c.expected === 'not_in_corpus');
  const latencies = [...cases.map((c) => c.latencyMs)].sort((a, b) => a - b);

  return {
    n: cases.length,
    precisionAt1: ratio(real.filter((c) => c.precision1 === true).length, real.length),
    precisionAt5: ratio(real.filter((c) => c.precision5 === true).length, real.length),
    falseTop1Rate: ratio(real.filter((c) => c.falseTop1 === true).length, real.length),
    recallAtRetrieval: ratio(real.filter((c) => c.recallRetrieval === true).length, real.length),
    noMatchRateNotInCorpus: ratio(notInCorpus.filter((c) => !c.matched).length, notInCorpus.length),
    noMatchRateReal: ratio(real.filter((c) => !c.matched).length, real.length),
    meanResults: cases.length === 0 ? 0 : cases.reduce((s, c) => s + c.displayResults.length, 0) / cases.length,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
  };
}

const KNOWN_TAGS = [
  'exact',
  'typo',
  'truncation',
  'generic',
  'generic-heavy',
  'same-brand-variant',
  'cyrillic',
  'short-query',
  // Added for the human-approved follow-up fix to the brand-only-typed-query
  // gap step 2's report flagged (progress/ocr-improvement.md dated follow-up
  // entry) — a typed query consisting only of a brand name, no product name.
  'brand-only',
];

// ── Table printing ──────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  return v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
}
function fmtNum(v: number): string {
  return v.toFixed(1);
}
function fmtMs(v: number): string {
  return `${v.toFixed(0)}ms`;
}

function printTable(title: string, rows: Array<[string, Aggregate]>): void {
  console.log(`\n${title}`);
  const header = ['slice', 'n', 'p@1', 'p@5', 'false_top1', 'recall@retr', 'no_match(oov)', 'no_match(real)', 'mean_res', 'p50', 'p95'];
  const widths = header.map((h) => h.length);
  const dataRows = rows.map(([label, a]) => [
    label,
    String(a.n),
    fmtPct(a.precisionAt1),
    fmtPct(a.precisionAt5),
    fmtPct(a.falseTop1Rate),
    fmtPct(a.recallAtRetrieval),
    fmtPct(a.noMatchRateNotInCorpus),
    fmtPct(a.noMatchRateReal),
    fmtNum(a.meanResults),
    fmtMs(a.p50LatencyMs),
    fmtMs(a.p95LatencyMs),
  ]);
  for (const row of dataRows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], cell.length);
    });
  }
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of dataRows) console.log(line(row));
}

// ── Baseline diff (--compare) ───────────────────────────────────────────────

interface BaselineFile {
  gitSha: string;
  label: string | null;
  timestamp: string;
  config: { effective: SearchConfig; overridesApplied: Partial<SearchConfig> };
  cases: CaseResult[];
  aggregate: { overall: Aggregate; bySet: Record<string, Aggregate>; byTag: Record<string, Aggregate> };
}

function isCorrect(c: CaseResult): boolean {
  return c.expected === 'not_in_corpus' ? !c.matched : c.precision1 === true;
}

function printCompare(prevFile: string, current: CaseResult[]): void {
  const candidates = [
    resolve(process.cwd(), prevFile),
    join(BASELINES_DIR, prevFile),
    join(BASELINES_DIR, basename(prevFile)),
  ];
  const resolvedPath = candidates.find((p) => existsSync(p));
  if (!resolvedPath) {
    console.error(`[search-eval] --compare file not found: ${prevFile} (tried: ${candidates.join(', ')})`);
    process.exit(1);
  }
  const prev = JSON.parse(readFileSync(resolvedPath, 'utf8')) as BaselineFile;
  const prevById = new Map(prev.cases.map((c) => [c.id, c]));
  const currById = new Map(current.map((c) => [c.id, c]));

  const fixed: string[] = [];
  const broken: string[] = [];
  let unchangedCorrect = 0;
  let unchangedIncorrect = 0;
  const onlyInPrev: string[] = [];
  const onlyInCurrent: string[] = [];

  for (const [id, prevCase] of prevById) {
    const currCase = currById.get(id);
    if (!currCase) {
      onlyInPrev.push(id);
      continue;
    }
    const wasCorrect = isCorrect(prevCase);
    const nowCorrect = isCorrect(currCase);
    if (wasCorrect && !nowCorrect) broken.push(id);
    else if (!wasCorrect && nowCorrect) fixed.push(id);
    else if (nowCorrect) unchangedCorrect++;
    else unchangedIncorrect++;
  }
  for (const id of currById.keys()) {
    if (!prevById.has(id)) onlyInCurrent.push(id);
  }

  console.log(`\nCompare vs ${resolvedPath} (gitSha ${prev.gitSha}${prev.label ? `-${prev.label}` : ''})`);
  console.log(`  fixed:               ${fixed.length}  ${fixed.join(', ')}`);
  console.log(`  broken:              ${broken.length}  ${broken.join(', ')}`);
  console.log(`  unchanged (correct): ${unchangedCorrect}`);
  console.log(`  unchanged (wrong):   ${unchangedIncorrect}`);
  if (onlyInCurrent.length) console.log(`  new fixtures:        ${onlyInCurrent.length}  ${onlyInCurrent.join(', ')}`);
  if (onlyInPrev.length) console.log(`  removed fixtures:     ${onlyInPrev.length}  ${onlyInPrev.join(', ')}`);

  if (broken.length > 0) {
    console.log('\n  BROKEN case detail:');
    for (const id of broken) {
      const p = prevById.get(id)!;
      const n = currById.get(id)!;
      console.log(
        `    ${id} [${n.tags.join(',')}] expected=${n.expected} prevTop1=${p.displayResults[0]?.uid ?? 'none'} nowTop1=${n.displayResults[0]?.uid ?? 'none'}`,
      );
    }
  }
  if (fixed.length > 0) {
    console.log('\n  FIXED case detail:');
    for (const id of fixed) {
      const p = prevById.get(id)!;
      const n = currById.get(id)!;
      console.log(
        `    ${id} [${n.tags.join(',')}] expected=${n.expected} prevTop1=${p.displayResults[0]?.uid ?? 'none'} nowTop1=${n.displayResults[0]?.uid ?? 'none'}`,
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Mutate the REAL SEARCH_CONFIG singleton so ProductRepository/scoreCandidate
  // actually see the override — this is the whole point of running under tsx.
  Object.assign(SEARCH_CONFIG, args.overrides);

  const inertOverrides = args.overrideKeysRaw.filter((k) => NOT_YET_IMPLEMENTED_KEYS.has(k as keyof SearchConfig));
  if (inertOverrides.length > 0) {
    console.warn(
      `[search-eval] note: --set ${inertOverrides.join(', ')} accepted and echoed, but has no effect yet — ` +
        'the corresponding app logic (brandFilterThreshold / wordIndexEnabled) does not exist ' +
        'until later steps.',
    );
  }

  const client = createClient();
  const repo = new ProductRepository(client);
  const cases = loadFixtures();

  if (args.tagFilter) {
    const filtered = cases.filter((c) => c.tags.includes(args.tagFilter!));
    if (filtered.length === 0) {
      console.error(`[search-eval] no fixtures tagged "${args.tagFilter}"`);
      process.exit(1);
    }
  }
  const activeCases = args.tagFilter ? cases.filter((c) => c.tags.includes(args.tagFilter!)) : cases;

  // Pre-fetch brand for every real `expected` uid in one batched query, used
  // for false_top_1's "different brand" check.
  const expectedUids = [...new Set(activeCases.map((c) => c.expected).filter((e) => e !== 'not_in_corpus'))];
  const brandByUid = new Map<string, string | null>();
  if (expectedUids.length > 0) {
    const placeholders = expectedUids.map(() => '?').join(',');
    const rows = await client.getAllAsync<{ uid: string; brand: string | null }>(
      `SELECT uid, brand FROM products WHERE uid IN (${placeholders})`,
      expectedUids,
    );
    for (const r of rows) brandByUid.set(r.uid, r.brand);
  }

  const results: CaseResult[] = [];
  for (const c of activeCases) {
    const expectedBrand = c.expected === 'not_in_corpus' ? null : (brandByUid.get(c.expected) ?? null);
    results.push(await runCase(repo, c, expectedBrand));
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log(
    `\nsearch-eval — ${results.length} cases (recallLimit=${SEARCH_CONFIG.recallLimit}, ` +
      `maxResults=${SEARCH_CONFIG.maxResults}, minMatchScore=${SEARCH_CONFIG.minMatchScore}, ` +
      `scoringV2=${SEARCH_CONFIG.scoringV2})`,
  );
  if (args.tagFilter) console.log(`filtered to tag: ${args.tagFilter}`);

  printTable('Overall', [['overall', computeAggregate(results)]]);
  printTable(
    'By fixture set',
    (['typed', 'label'] as const).map((set) => [set, computeAggregate(results.filter((c) => c.set === set))]),
  );
  printTable(
    'By tag',
    KNOWN_TAGS.filter((tag) => results.some((c) => c.tags.includes(tag))).map((tag) => [
      tag,
      computeAggregate(results.filter((c) => c.tags.includes(tag))),
    ]),
  );

  // ── Baseline JSON ──────────────────────────────────────────────────────
  let gitSha = 'nogit';
  try {
    gitSha = execSync('git rev-parse --short HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    console.warn('[search-eval] could not resolve git sha (not a git repo?) — using "nogit"');
  }
  if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });

  const baseline: BaselineFile = {
    gitSha,
    label: args.label,
    timestamp: new Date().toISOString(),
    config: { effective: { ...SEARCH_CONFIG }, overridesApplied: args.overrides },
    cases: results,
    aggregate: {
      overall: computeAggregate(results),
      bySet: {
        typed: computeAggregate(results.filter((c) => c.set === 'typed')),
        label: computeAggregate(results.filter((c) => c.set === 'label')),
      },
      byTag: Object.fromEntries(
        KNOWN_TAGS.filter((tag) => results.some((c) => c.tags.includes(tag))).map((tag) => [
          tag,
          computeAggregate(results.filter((c) => c.tags.includes(tag))),
        ]),
      ),
    },
  };

  const filename = `${gitSha}${args.label ? `-${args.label}` : ''}.json`;
  const outPath = join(BASELINES_DIR, filename);
  writeFileSync(outPath, JSON.stringify(baseline, null, 2));
  console.log(`\nBaseline written: ${resolve(outPath)}`);

  if (args.comparePath) {
    printCompare(args.comparePath, results);
  }
}

main().catch((e) => {
  console.error('[search-eval] failed:', e);
  process.exit(1);
});
