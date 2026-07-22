import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Connection to the **contributions** Turso database — write-only, and
 * deliberately isolated from the product corpus.
 *
 * ## Token isolation (architecture rule)
 *
 * This module reads ONLY `EXPO_PUBLIC_TURSO_CONTRIBUTIONS_*`. The corpus's
 * read token (`EXPO_PUBLIC_TURSO_URL` / `_TOKEN`, see `CorpusProvider`) must
 * never appear here, and these two must never be combined into one config
 * object — a single object holding both would make it trivial to hand the
 * write token to a read path or vice versa.
 *
 * The token is provisioned at the narrowest scope Turso offers:
 *
 * ```
 * turso db tokens create vials-contributions -p contributions:data_add --expiration 90d
 * ```
 *
 * `contributions:data_add` = INSERT-only, on that one table, in that one
 * database. It cannot read rows back, update, delete, or alter schema.
 *
 * ## Why `remoteOnly`
 *
 * REQUIRED, not merely preferred: an embedded replica syncs by *reading* the
 * primary, which an insert-only token cannot do. `remoteOnly: true` issues
 * statements straight to the remote database with no local replica.
 *
 * ## Known limitation — the token ships in the client
 *
 * `EXPO_PUBLIC_*` values are inlined into the JS bundle and are extractable
 * from a shipped app. `data_add`-only contains the blast radius (no reads of
 * other users' submissions, no deletes, no schema changes), but nothing stops
 * an extracted token from inserting spam rows or oversized blobs — there is no
 * server to rate-limit. Accepted for MVP; recorded in
 * docs/tasks/product-images/BLOCKERS.md.
 */

const CONTRIBUTIONS_URL = process.env.EXPO_PUBLIC_TURSO_CONTRIBUTIONS_URL;
const CONTRIBUTIONS_TOKEN = process.env.EXPO_PUBLIC_TURSO_CONTRIBUTIONS_TOKEN;

/** Local handle name; distinct from the corpus's `vials_corpus.db`. */
const DB_NAME = 'vials_contributions.db';

let cached: SQLiteDatabase | null = null;

/** True when both contributions env vars are configured for this build. */
export function isContributionsConfigured(): boolean {
  return !!CONTRIBUTIONS_URL && !!CONTRIBUTIONS_TOKEN;
}

/**
 * Opens (once) the write-only contributions connection.
 *
 * Returns null when unconfigured, or when the libSQL native module is absent —
 * which is the case in Expo Go and in bundled-corpus builds, where
 * `app.config.js` compiles expo-sqlite with `useLibSQL: false`. Callers must
 * treat null as "sharing unavailable in this build" and surface that as its
 * own state, never as a write failure the user could retry.
 */
export async function getContributionsDb(): Promise<SQLiteDatabase | null> {
  if (!CONTRIBUTIONS_URL || !CONTRIBUTIONS_TOKEN) return null;
  if (cached) return cached;

  try {
    cached = await openDatabaseAsync(DB_NAME, {
      libSQLOptions: {
        url: CONTRIBUTIONS_URL,
        authToken: CONTRIBUTIONS_TOKEN,
        remoteOnly: true,
      },
    });
    return cached;
  } catch {
    // No libSQL module in this build, bad token, or unreachable host.
    return null;
  }
}

/** Test seam — drops the memoized handle. */
export function resetContributionsDbForTests(): void {
  cached = null;
}
