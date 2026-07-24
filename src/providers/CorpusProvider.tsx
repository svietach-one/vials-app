import React, { createContext, useContext, useMemo } from 'react';

import type { CorpusQueryExecutor } from '@/services/corpus/types';
import { createTursoHttpClient } from '@/services/turso/httpClient';

/**
 * Provides the product corpus as a remote, read-only query executor backed by
 * the Turso HTTP API (see {@link createTursoHttpClient}). All corpus reads —
 * search, barcode lookup, ingredient autocomplete — go over the network, so
 * the corpus works everywhere the app runs (Expo Go, any simulator, device);
 * there is no bundled/local snapshot and no libSQL native module involved.
 *
 * The value is `null` when the corpus isn't configured for this build (missing
 * EXPO_PUBLIC_TURSO_HTTP_URL / EXPO_PUBLIC_TURSO_TOKEN). Consumers treat null
 * as "corpus disabled" and fall back to manual entry — but unlike before, that
 * condition is logged and surfaced in the UI rather than silently masked as an
 * empty search result.
 */
const CorpusDbContext = createContext<CorpusQueryExecutor | null>(null);

export function useCorpusDb(): CorpusQueryExecutor | null {
  return useContext(CorpusDbContext);
}

export function CorpusProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    const c = createTursoHttpClient();
    if (!c && __DEV__) {
      console.warn(
        '[CorpusProvider] Turso corpus is not configured — set ' +
          'EXPO_PUBLIC_TURSO_HTTP_URL and EXPO_PUBLIC_TURSO_TOKEN in .env.local. ' +
          'Product database search is disabled for this build.',
      );
    }
    return c;
  }, []);

  return <CorpusDbContext.Provider value={client}>{children}</CorpusDbContext.Provider>;
}
