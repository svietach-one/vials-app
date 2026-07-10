import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  importDatabaseFromAssetAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import bundledCorpusAsset from '../../assets/corpus/vials_corpus.db';

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL;
const TURSO_TOKEN = process.env.EXPO_PUBLIC_TURSO_TOKEN;
const CORPUS_MODE = process.env.EXPO_PUBLIC_CORPUS_MODE;

/**
 * Distinct from the libSQL replica's file name so switching modes on the same
 * install never opens one mode's file with the other mode's driver.
 */
const BUNDLED_DB_NAME = 'vials_corpus_bundled.db';

/**
 * The corpus database handle, or null when Turso isn't configured/reachable
 * (missing env vars, bad token, wrong build). Consumers must treat null the
 * same as an unreachable corpus — every repository call already degrades to
 * "not found" in that case, so screens fall back to manual entry.
 */
const CorpusDbContext = createContext<SQLiteDatabase | null>(null);

export function useCorpusDb(): SQLiteDatabase | null {
  return useContext(CorpusDbContext);
}

/** Pulls the latest corpus snapshot. Non-blocking; offline is a normal, silent outcome. */
export async function syncCorpus(db: SQLiteDatabase): Promise<void> {
  try {
    // API name has varied across expo-sqlite versions; guard it.
    const anyDb = db as unknown as { syncLibSQL?: () => Promise<void> };
    if (typeof anyDb.syncLibSQL === 'function') await anyDb.syncLibSQL();
  } catch {
    // No network / sync unavailable → replica still serves last-synced data. Swallow.
  }
}

/**
 * Bundled mode (EXPO_PUBLIC_CORPUS_MODE=bundled): opens a read-only snapshot
 * shipped in the app bundle instead of the Turso embedded replica. This is
 * the only corpus that works without the libSQL native module — i.e. in
 * Expo Go and in x86_64 simulator builds (libsql.xcframework has no Intel
 * simulator slice). The snapshot updates only when the app is rebuilt with a
 * fresh assets/corpus/vials_corpus.db; forceOverwrite keeps the working copy
 * in lock-step with the bundled asset across app updates.
 */
async function openBundledCorpusAsync(): Promise<SQLiteDatabase> {
  await importDatabaseFromAssetAsync(BUNDLED_DB_NAME, {
    assetId: bundledCorpusAsset,
    forceOverwrite: true,
  });
  return openDatabaseAsync(BUNDLED_DB_NAME);
}

/**
 * Wraps the product corpus as a pull-only, read-only SQLite database. Reads
 * are always local; the app never writes to the corpus. Two sources, chosen
 * at bundle time via EXPO_PUBLIC_CORPUS_MODE: the Turso/libSQL embedded
 * replica (default, see handoff/INTEGRATION_GUIDE.md) or the bundled
 * snapshot (testing builds without the libSQL native module).
 *
 * Opens the database itself (rather than expo-sqlite's `<SQLiteProvider>`)
 * because that component renders `null` for all children while opening and
 * never recovers on an open failure (bad token, wrong env, or running in
 * Expo Go without the libSQL native module) — it would leave the whole app
 * blank. Children here always render immediately; the corpus becomes
 * available once open, or stays disabled without blocking anything.
 */
export function CorpusProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;

    let openCorpus: Promise<SQLiteDatabase> | null = null;
    if (CORPUS_MODE === 'bundled') {
      openCorpus = openBundledCorpusAsync();
    } else if (TURSO_URL && TURSO_TOKEN) {
      openCorpus = openDatabaseAsync('vials_corpus.db', {
        libSQLOptions: { url: TURSO_URL, authToken: TURSO_TOKEN },
      }).then((opened) => {
        void syncCorpus(opened);
        return opened;
      });
    }
    if (!openCorpus) return;

    openCorpus
      .then((opened) => {
        if (cancelled) return;
        setDb(opened);
      })
      .catch(() => {
        // Corpus unreachable/misconfigured — app runs on with the corpus disabled.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <CorpusDbContext.Provider value={db}>{children}</CorpusDbContext.Provider>;
}
