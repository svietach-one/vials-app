# Vials Corpus — Reference Implementations

Drop-in reference for the four modules named in the Integration Guide §4. Adjust import
paths/types to the app's conventions. Types assume the app's existing `@/types`
(`ActiveIngredientKey`, etc.).

---

## `src/services/corpus/types.ts`

```ts
import type { ActiveIngredientKey } from '@/types';

export interface CorpusProduct {
  uid: string;            // app-facing id (products.uid)
  barcode: string | null;
  brand: string | null;
  name: string;
  type: string;           // app product-type vocabulary
  inciRaw: string | null;
  imageUrl: string | null;
  source: 'obf_import' | 'vials_seed' | 'community';
}

export interface IngredientHit {
  inciName: string;
  activeKey: ActiveIngredientKey | null;
}
```

---

## `src/services/corpus/CorpusProvider.tsx`

```tsx
import React, { useEffect } from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';

const URL = process.env.EXPO_PUBLIC_TURSO_URL!;
const TOKEN = process.env.EXPO_PUBLIC_TURSO_TOKEN!;

export function CorpusProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider
      databaseName="vials_corpus.db"
      options={{ libSQLOptions: { url: URL, authToken: TOKEN } }}
    >
      <CorpusSync />
      {children}
    </SQLiteProvider>
  );
}

/** Fire one background pull on mount. Non-blocking; offline is a normal, silent outcome. */
function CorpusSync() {
  const db = useSQLiteContext();
  useEffect(() => { void syncCorpus(db); }, [db]);
  return null;
}

export async function syncCorpus(db: SQLiteDatabase): Promise<void> {
  try {
    // API name has varied across expo-sqlite versions; guard it.
    const anyDb = db as unknown as { syncLibSQL?: () => Promise<void> };
    if (typeof anyDb.syncLibSQL === 'function') await anyDb.syncLibSQL();
  } catch {
    // No network / sync unavailable → replica still serves last-synced data. Swallow.
  }
}
```

Wire into the app root, inside existing providers, around the navigator:
```tsx
<CorpusProvider>
  <NavigationContainer>{/* ... */}</NavigationContainer>
</CorpusProvider>
```

---

## `src/services/corpus/trigramSearch.ts`

```ts
/**
 * FTS5 trigram tokenizer does SUBSTRING matching, not similarity. To tolerate
 * OCR/typo noise ("The 0rdinary" → "The Ordinary"), decompose the query into
 * character trigrams and OR them; rank by bm25 overlap at the call site.
 */
export function toTrigramQuery(raw: string): string {
  const grams = new Set<string>();
  for (const tok of raw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    for (let i = 0; i + 3 <= tok.length; i++) grams.add(tok.slice(i, i + 3));
  }
  return [...grams].map((g) => `"${g}"`).join(' OR ');
}
```

Note: tokens shorter than 3 chars contribute no trigrams (expected). If the whole
query yields no trigrams, skip the FTS call and return `[]`.

---

## `src/services/corpus/ProductRepository.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ActiveIngredientKey } from '@/types';
import type { CorpusProduct } from './types';
import { toTrigramQuery } from './trigramSearch';

const COLS = `uid, barcode, brand, name, type, inci_raw as inciRaw, image_url as imageUrl, source`;

export class ProductRepository {
  constructor(private db: SQLiteDatabase) {}

  findByBarcode(barcode: string): Promise<CorpusProduct | null> {
    return this.db.getFirstAsync<CorpusProduct>(
      `SELECT ${COLS} FROM products WHERE barcode = ? LIMIT 1`, [barcode]);
  }

  getByUid(uid: string): Promise<CorpusProduct | null> {
    return this.db.getFirstAsync<CorpusProduct>(
      `SELECT ${COLS} FROM products WHERE uid = ? LIMIT 1`, [uid]);
  }

  async search(query: string): Promise<CorpusProduct[]> {
    const match = toTrigramQuery(query);
    if (!match) return [];
    return this.db.getAllAsync<CorpusProduct>(
      `SELECT ${COLS.split(',').map(c => 'p.' + c.trim()).join(', ')}
       FROM products_fts f JOIN products p ON p.id = f.rowid
       WHERE products_fts MATCH ? ORDER BY bm25(products_fts) LIMIT 20`, [match]);
  }

  async getActiveKeys(uid: string): Promise<ActiveIngredientKey[]> {
    const rows = await this.db.getAllAsync<{ active_key: ActiveIngredientKey }>(
      `SELECT t.active_key FROM product_tags t
       JOIN products p ON p.id = t.product_id WHERE p.uid = ?`, [uid]);
    return rows.map((r) => r.active_key);
  }
}
```

---

## `src/services/corpus/IngredientRepository.ts`

```ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ActiveIngredientKey } from '@/types';
import type { IngredientHit } from './types';

export class IngredientRepository {
  constructor(private db: SQLiteDatabase) {}

  /** Prefix autocomplete over inci_name + synonyms. Debounce ~300ms at the call site. */
  async autocomplete(prefix: string): Promise<IngredientHit[]> {
    const p = prefix.trim().toLowerCase();
    if (p.length < 2) return [];
    return this.db.getAllAsync<IngredientHit>(
      `SELECT i.inci_name AS inciName, i.active_key AS activeKey
       FROM ingredients_fts f JOIN ingredients i ON i.id = f.rowid
       WHERE ingredients_fts MATCH ? LIMIT 10`, [`${p}*`]);
  }

  getActiveKey(inciName: string): Promise<ActiveIngredientKey | null> {
    return this.db
      .getFirstAsync<{ active_key: ActiveIngredientKey | null }>(
        `SELECT active_key FROM ingredients WHERE inci_name_norm = lower(trim(?)) LIMIT 1`,
        [inciName])
      .then((r) => r?.active_key ?? null);
  }
}
```

---

## Usage hooks (optional convenience)

```ts
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';
import { ProductRepository } from './ProductRepository';
import { IngredientRepository } from './IngredientRepository';

export function useProductRepository() {
  const db = useSQLiteContext();
  return useMemo(() => new ProductRepository(db), [db]);
}
export function useIngredientRepository() {
  const db = useSQLiteContext();
  return useMemo(() => new IngredientRepository(db), [db]);
}
```

---

## Adding a corpus product to the user's shelf

Snapshot — do not live-join the corpus (the row may change or be deleted at the OBF cutover):

```ts
async function toShelfProduct(uid: string, repo: ProductRepository) {
  const p = await repo.getByUid(uid);
  if (!p) return null;
  const activeTags = await repo.getActiveKeys(uid);
  return {
    // map into the app's existing Product shape:
    name: p.name, brand: p.brand,
    productType: p.type,                 // reconcile with app ProductType if vocabularies differ
    imageUrl: p.imageUrl,
    fullIngredientText: p.inciRaw,
    activeTags,                          // feeds getProductActiveKeys() → ConflictEngine
    openBeautyFactsId: p.source === 'obf_import' ? p.uid : null,
    // ...app defaults for usageTime, addedAt, etc.
  };
}
```
