/**
 * Diagnostic for real device OCR captures — separate from the synthetic
 * fixture harness (run.ts). Built 2026-08-23 because real-device testing
 * surfaced "not found" on photos of products that ARE in the corpus, and the
 * human running this task wants to know, per capture, which of three
 * different failure modes is responsible before anything gets changed:
 *
 *   1. threshold calibrated too tight against the synthetic fixtures
 *   2. a retrieval/segmentation failure on real OCR noise (recall stage
 *      never surfaces the right candidate at all)
 *   3. bad OCR output upstream (the raw text itself doesn't contain enough
 *      of the real label to identify the product, no matter how search works)
 *
 * These need different fixes (lower minMatchScore vs. fix retrieveCandidates
 * / buildOcrProductQuery vs. fix OcrEngineWebView/ocrNoiseFilter upstream),
 * so this reports the raw material for that judgment rather than guessing.
 *
 * Input: scripts/search-eval/real-captures.local.json (gitignored, not
 * committed — real device data). See real-captures.example.json for the
 * shape and how to get rawText (Metro console, `[OCR] filtered:` line,
 * logged from src/components/camera/OcrEngineWebView.tsx when __DEV__).
 *
 * Usage: npm run diagnose-captures
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductRepository } from '@/services/corpus/ProductRepository';
import { isShortQuery, scoreCandidate, SHORT_QUERY_MIN_SCORE } from '@/services/corpus/scoreCandidate';
import { SEARCH_CONFIG } from '@/services/corpus/searchConfig';
import type { CorpusProduct, ProductQuery } from '@/services/corpus/types';
import { TursoHttpClient } from '@/services/turso/httpClient';
import { buildOcrProductQuery } from '@/utils/productForm/ocrNormalizer';
import { normalizeForMatch } from '@/utils/textNormalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = join(__dirname, 'real-captures.local.json');

interface RealCapture {
  id: string;
  /** Copy verbatim from the Metro console's "[OCR] filtered:" (or "raw text passthrough:") line. */
  rawText: string;
  /** What the photo actually was, for your own reference in the report. */
  label: string;
  /** Best case: exact products.uid, if you know it. */
  expectedUid?: string;
  /** Fallback resolution: barcode printed on the package. */
  expectedBarcode?: string;
  /** Last-resort fallback: brand/name as best you can tell — resolved via a corpus lookup, ambiguous matches are reported, not guessed. */
  expectedBrand?: string;
  expectedName?: string;
  /** Set true if you already know this product is NOT in the corpus. */
  notInCorpus?: boolean;
}

function createClient(): TursoHttpClient {
  const url = process.env.EXPO_PUBLIC_TURSO_HTTP_URL;
  const token = process.env.EXPO_PUBLIC_TURSO_TOKEN;
  if (!url || !token) {
    console.error('[diagnose-captures] EXPO_PUBLIC_TURSO_HTTP_URL / EXPO_PUBLIC_TURSO_TOKEN not set in .env.local');
    process.exit(1);
  }
  return new TursoHttpClient(url, token);
}

async function resolveExpected(repo: ProductRepository, c: RealCapture): Promise<CorpusProduct | 'not_in_corpus' | 'unresolved'> {
  if (c.notInCorpus) return 'not_in_corpus';
  if (c.expectedUid) {
    const row = await repo.getByUid(c.expectedUid);
    return row ?? 'unresolved';
  }
  if (c.expectedBarcode) {
    const row = await repo.findByBarcode(c.expectedBarcode);
    return row ?? 'unresolved';
  }
  if (c.expectedBrand || c.expectedName) {
    // Best-effort: use the same retrieval the app would use for a typed query
    // of "brand name", then require an exact normalized brand+name match so
    // we never silently guess the wrong product as ground truth.
    const probe = [c.expectedBrand, c.expectedName].filter(Boolean).join(' ');
    const candidates = await repo.retrieveCandidates({ name: probe, origin: 'typed' });
    const wantBrand = normalizeForMatch(c.expectedBrand ?? '');
    const wantName = normalizeForMatch(c.expectedName ?? '');
    const exact = candidates.filter(
      (cand) =>
        (wantBrand === '' || normalizeForMatch(cand.brand ?? '') === wantBrand) &&
        (wantName === '' || normalizeForMatch(cand.name) === wantName),
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      console.warn(
        `[${c.id}] AMBIGUOUS: ${exact.length} corpus rows exactly match brand/name "${probe}" — ` +
          `uids: ${exact.map((r) => r.uid).join(', ')}. Add expectedUid to disambiguate.`,
      );
      return 'unresolved';
    }
    console.warn(`[${c.id}] Could not resolve "${probe}" to an exact corpus row. Candidates seen (top 5):`);
    for (const cand of candidates.slice(0, 5)) console.warn(`    ${cand.uid}: ${cand.brand ?? '(no brand)'} / ${cand.name}`);
    return 'unresolved';
  }
  return 'unresolved';
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    console.error(
      `[diagnose-captures] ${INPUT_PATH} not found.\n` +
        `Create it from real-captures.example.json in this directory — one entry per real device capture.`,
    );
    process.exit(1);
  }
  const captures = JSON.parse(readFileSync(INPUT_PATH, 'utf8')) as RealCapture[];
  const repo = new ProductRepository(createClient());

  console.log(`SEARCH_CONFIG: minMatchScore=${SEARCH_CONFIG.minMatchScore}, recallLimit=${SEARCH_CONFIG.recallLimit}, maxResults=${SEARCH_CONFIG.maxResults}`);
  console.log(`${captures.length} real captures loaded.\n`);

  const buckets = { thresholdTooTight: 0, retrievalMiss: 0, notInCorpusConfirmed: 0, foundAndDisplayed: 0, unresolved: 0 };

  for (const c of captures) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`[${c.id}] ${c.label}`);
    console.log(`  raw OCR text:\n    ${c.rawText.split('\n').join('\n    ')}`);

    const query: ProductQuery = SEARCH_CONFIG.segmentOcrQuery
      ? buildOcrProductQuery(c.rawText)
      : { name: c.rawText, origin: 'ocr', raw: c.rawText };
    console.log(`  segmented -> brand: ${JSON.stringify(query.brand ?? null)}, name: ${JSON.stringify(query.name)}`);

    const expected = await resolveExpected(repo, c);
    if (expected === 'unresolved') {
      console.log(`  ground truth: UNRESOLVED — see warning above, this case is not counted below.`);
      buckets.unresolved++;
      continue;
    }

    const [candidates, displayResults] = await Promise.all([repo.retrieveCandidates(query), repo.search(query)]);

    if (expected === 'not_in_corpus') {
      const matched = displayResults.length > 0;
      console.log(`  ground truth: not in corpus. search() returned ${displayResults.length} result(s) ${matched ? '(SHOULD be 0)' : '(correct)'}`);
      buckets.notInCorpusConfirmed++;
      continue;
    }

    console.log(`  ground truth: ${expected.uid} — "${expected.brand ?? '(no brand)'} / ${expected.name}"`);

    const foundInCandidates = candidates.find((cand) => cand.uid === expected.uid);
    const displayedAt = displayResults.findIndex((r) => r.uid === expected.uid);

    if (!foundInCandidates) {
      console.log(
        `  (2) recall@retrieval: FALSE — expected product never appeared among the ${candidates.length} ` +
          `pre-cutoff candidates (recallLimit=${SEARCH_CONFIG.recallLimit}). This is a RETRIEVAL/SEGMENTATION ` +
          `failure, not a threshold problem — check whether the segmented brand/name above still contains ` +
          `enough of the real product name for the trigram query to find it, or whether OCR output itself ` +
          `(see raw text) is too degraded.`,
      );
      buckets.retrievalMiss++;
    } else {
      const score = scoreCandidate(query, foundInCandidates);
      const floor = isShortQuery(query) ? SHORT_QUERY_MIN_SCORE : SEARCH_CONFIG.minMatchScore;
      const gap = floor - score;
      console.log(`  (2) recall@retrieval: TRUE — present in pre-cutoff candidates.`);
      console.log(`  (3) score: ${score.toFixed(3)} vs floor ${floor.toFixed(3)} (${isShortQuery(query) ? 'short-query mode' : 'minMatchScore'}) -> gap ${gap >= 0 ? '-' : '+'}${Math.abs(gap).toFixed(3)} ${gap > 0 ? '(BELOW floor — filtered out)' : '(clears floor)'}`);
      if (gap > 0) buckets.thresholdTooTight++;
      else buckets.foundAndDisplayed++;
    }

    console.log(`  search() actually displayed: ${displayResults.length === 0 ? '[] (not found)' : displayResults.map((r) => `${r.uid}${r.uid === expected.uid ? '*' : ''}`).join(', ')}`);
    if (displayedAt >= 0) console.log(`  expected product shown at display position ${displayedAt + 1}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`SUMMARY (${captures.length} total captures)`);
  console.log(`  found & correctly displayed:              ${buckets.foundAndDisplayed}`);
  console.log(`  found in recall, but BELOW score floor:   ${buckets.thresholdTooTight}  <- threshold-too-tight candidates`);
  console.log(`  NEVER in pre-cutoff recall at all:        ${buckets.retrievalMiss}  <- retrieval/segmentation/OCR candidates`);
  console.log(`  confirmed not-in-corpus, handled correctly: ${buckets.notInCorpusConfirmed}`);
  console.log(`  unresolved ground truth (not counted):    ${buckets.unresolved}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
