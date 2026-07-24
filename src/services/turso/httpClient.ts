import type { CorpusQueryExecutor } from '@/services/corpus/types';

/**
 * Turso HTTP client — queries the remote libSQL/Turso database over the HTTP
 * "pipeline" endpoint (`POST {origin}/v2/pipeline`). Pure `fetch`, no native
 * module, so it runs everywhere the app runs: Expo Go, any simulator (incl.
 * Intel), and device builds. This is the network transport for the product
 * corpus (search, barcode lookup, ingredient autocomplete).
 *
 * Env (inlined into the JS bundle at build time — see .env.example):
 *   EXPO_PUBLIC_TURSO_HTTP_URL   HTTPS origin of the Turso DB, e.g.
 *                                https://vials-corpus-<org>.turso.io
 *                                (a `libsql://` URL is accepted and rewritten)
 *   EXPO_PUBLIC_TURSO_TOKEN      read-only auth token
 *
 * Errors are never swallowed here — every failure (network, non-2xx, API-level
 * error, bad payload) throws a {@link TursoHttpError} so callers can surface a
 * real error instead of a fake "no results".
 */

const RAW_URL = process.env.EXPO_PUBLIC_TURSO_HTTP_URL;
const TOKEN = process.env.EXPO_PUBLIC_TURSO_TOKEN;

/**
 * Normalises the corpus URL to an `https://` origin: Turso serves the HTTP API
 * over TLS, and iOS App Transport Security blocks cleartext anyway. Accepts
 * `libsql://` or a stray `http://` and upgrades both; trims trailing slashes.
 */
function toHttpOrigin(url: string): string {
  return url.replace(/^(libsql|http):\/\//i, 'https://').replace(/\/+$/, '');
}

/** True when both HTTP corpus env vars are configured for this build. */
export function isTursoHttpConfigured(): boolean {
  return !!RAW_URL && !!TOKEN;
}

export class TursoHttpError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TursoHttpError';
  }
}

// ── Turso pipeline wire types ────────────────────────────────────────────────

type TursoValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

interface ExecuteResult {
  cols: { name: string | null }[];
  rows: TursoValue[][];
}

interface PipelineResponse {
  results?: Array<
    | { type: 'ok'; response: { type: string; result?: ExecuteResult } }
    | { type: 'error'; error: { message: string; code?: string } }
  >;
}

/** Turso typed value → JS scalar the corpus row shapes expect. */
function decode(v: TursoValue): string | number | null {
  switch (v.type) {
    case 'null':
      return null;
    case 'integer':
      return Number(v.value);
    case 'float':
      return v.value;
    case 'text':
      return v.value;
    case 'blob':
      return null; // corpus queries never select blob columns
  }
}

/** JS bind param → Turso typed arg. */
function encode(arg: unknown): TursoValue {
  if (arg === null || arg === undefined) return { type: 'null' };
  if (typeof arg === 'number') {
    return Number.isInteger(arg)
      ? { type: 'integer', value: String(arg) }
      : { type: 'float', value: arg };
  }
  return { type: 'text', value: String(arg) };
}

export class TursoHttpClient implements CorpusQueryExecutor {
  private readonly endpoint: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.endpoint = `${toHttpOrigin(url)}/v2/pipeline`;
    this.token = token;
  }

  private async execute<T>(sql: string, params: unknown[]): Promise<T[]> {
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            { type: 'execute', stmt: { sql, args: params.map(encode) } },
            { type: 'close' },
          ],
        }),
      });
    } catch (e) {
      throw new TursoHttpError(`Network request to Turso failed (${this.endpoint})`, e);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TursoHttpError(
        `Turso HTTP ${res.status} ${res.statusText}: ${body.slice(0, 300)}`,
      );
    }

    let payload: PipelineResponse;
    try {
      payload = (await res.json()) as PipelineResponse;
    } catch (e) {
      throw new TursoHttpError('Turso returned a non-JSON response', e);
    }

    const first = payload.results?.[0];
    if (!first) throw new TursoHttpError('Turso returned an empty results block');
    if (first.type === 'error') {
      throw new TursoHttpError(`Turso query error: ${first.error.message}`);
    }

    const result = first.response.result;
    if (!result) return [];
    const cols = result.cols.map((c) => c.name ?? '');
    return result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      row.forEach((val, i) => {
        obj[cols[i]] = decode(val);
      });
      return obj as T;
    });
  }

  async getAllAsync<T>(sql: string, params: unknown[]): Promise<T[]> {
    return this.execute<T>(sql, params);
  }

  async getFirstAsync<T>(sql: string, params: unknown[]): Promise<T | null> {
    const rows = await this.execute<T>(sql, params);
    return rows[0] ?? null;
  }
}

/**
 * Builds the client from env vars, or returns null when the corpus is not
 * configured for this build. Null is the "corpus disabled" signal consumers
 * already understand (manual entry stays available); it is logged, not
 * silently ignored, at the provider boundary.
 */
export function createTursoHttpClient(): TursoHttpClient | null {
  if (!RAW_URL || !TOKEN) return null;
  return new TursoHttpClient(RAW_URL, TOKEN);
}
