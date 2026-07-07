#!/usr/bin/env python3
"""
seed_cosing.py — CosIng inventory CSV -> Vials `ingredients` seed (schema v2)

Usage:
    python3 seed_cosing.py <path-to-COSING_Ingredients-Fragrance.Inventory_v2.csv> [outdir]

Outputs (in outdir, default ./out):
    ingredients_seed.sql   — INSERTs + FTS rebuild, pipe into `turso db shell vials-corpus`
    ingredients.db         — local SQLite with full schema v2 + FTS, for inspection/tests
    seed_report.txt        — stats and dropped/deduped rows log

Works with both the 2016 archived export and current data.europa.eu exports
(header is detected dynamically; preamble lines are skipped).
"""
import csv, json, re, sqlite3, sys, unicodedata
from collections import Counter
from pathlib import Path

HEADER_KEY = "INCI name"          # column that identifies the real header row
ANNEX_RE = re.compile(r'\b(II|III|IV|V|VI|I)\b\s*/')

DDL = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS ingredients (
  id             INTEGER PRIMARY KEY,
  uid            TEXT NOT NULL UNIQUE,
  inci_name      TEXT NOT NULL,
  inci_name_norm TEXT GENERATED ALWAYS AS (lower(trim(inci_name))) STORED,
  synonyms       TEXT NOT NULL DEFAULT '[]',
  active_key     TEXT,
  functions      TEXT NOT NULL DEFAULT '[]',
  annexes        TEXT NOT NULL DEFAULT '[]',
  description    TEXT,                          -- proposed v2.1: Chem/IUPAC description (ingredient info screen)
  cas_number     TEXT,
  ec_number      TEXT,
  source         TEXT NOT NULL DEFAULT 'cosing',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_norm   ON ingredients (inci_name_norm);
CREATE INDEX IF NOT EXISTS        idx_ingredients_active ON ingredients (active_key) WHERE active_key IS NOT NULL;
CREATE VIRTUAL TABLE IF NOT EXISTS ingredients_fts USING fts5(
  inci_name, synonyms,
  content='ingredients', content_rowid='id',
  prefix='2 3'
);
"""

def clean(s: str | None) -> str:
    if not s: return ""
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"\s+", " ", s).strip()
    return "" if s in {"-", "--"} else s

def parse_annexes(restriction: str) -> list[str]:
    return sorted(set(ANNEX_RE.findall(restriction)), key=lambda a: ["I","II","III","IV","V","VI"].index(a))

def parse_functions(fn: str) -> list[str]:
    return sorted({clean(t) for t in fn.split(",") if clean(t)})

def richness(rec: dict) -> int:
    """Score for dedup: prefer the record carrying more information."""
    return sum(bool(rec[k]) for k in ("cas_number","ec_number","description")) \
         + len(json.loads(rec["functions"])) + len(json.loads(rec["synonyms"]))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    outdir = Path(sys.argv[2] if len(sys.argv) > 2 else "out"); outdir.mkdir(exist_ok=True)

    # --- read, skipping preamble until the real header row -------------------
    with open(src, encoding="utf-8", errors="replace", newline="") as f:
        pos, line_no = 0, 0
        while True:
            line = f.readline()
            if not line: sys.exit(f"header row containing '{HEADER_KEY}' not found")
            if HEADER_KEY in line: break
            pos = f.tell(); line_no += 1
        f.seek(pos)
        rows = list(csv.DictReader(f))
    print(f"parsed {len(rows)} records (skipped {line_no} preamble lines)")

    # --- normalize ------------------------------------------------------------
    records, dropped = {}, []
    dupes = 0
    for r in rows:
        name = clean(r.get("INCI name"))
        ref  = clean(r.get("COSING Ref No"))
        if not name or not ref:
            dropped.append(("missing name/ref", r)); continue
        syn = sorted({s for s in (clean(r.get("INN name")), clean(r.get("Ph. Eur. Name"))) if s and s.lower() != name.lower()})
        rec = dict(
            uid         = f"cosing:{ref}",
            inci_name   = name,
            synonyms    = json.dumps(syn, ensure_ascii=False),
            active_key  = None,                                  # assigned later (conflict-vocab pass)
            functions   = json.dumps(parse_functions(r.get("Function") or ""), ensure_ascii=False),
            annexes     = json.dumps(parse_annexes(r.get("Restriction") or "")),
            description = clean(r.get("Chem/IUPAC Name / Description")) or None,
            cas_number  = clean(r.get("CAS No")) or None,
            ec_number   = clean(r.get("EINECS/ELINCS No")) or None,
        )
        key = name.lower()
        if key in records:                                       # dedupe on normalized name
            dupes += 1
            if richness(rec) <= richness(records[key]):
                dropped.append(("duplicate (kept richer)", {"INCI name": name, "ref": ref})); continue
            dropped.append(("duplicate (replaced poorer)", {"INCI name": records[key]["inci_name"], "ref": records[key]["uid"]}))
        records[key] = rec
    final = list(records.values())
    print(f"normalized: {len(final)} unique ingredients ({dupes} duplicate names resolved, {len(dropped)} rows logged)")

    # --- build local SQLite -----------------------------------------------------
    dbp = outdir / "ingredients.db"; dbp.unlink(missing_ok=True)
    db = sqlite3.connect(dbp); db.executescript(DDL)
    db.executemany("""INSERT INTO ingredients
        (uid, inci_name, synonyms, active_key, functions, annexes, description, cas_number, ec_number)
        VALUES (:uid,:inci_name,:synonyms,:active_key,:functions,:annexes,:description,:cas_number,:ec_number)""", final)
    db.execute("INSERT INTO ingredients_fts(ingredients_fts) VALUES('rebuild')")
    db.commit()

    # --- emit Turso-loadable SQL -------------------------------------------------
    def q(v): return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
    with open(outdir / "ingredients_seed.sql", "w", encoding="utf-8") as f:
        f.write("-- CosIng seed for vials_corpus.ingredients — generated by seed_cosing.py\n")
        f.write("BEGIN;\n")
        for rec in final:
            f.write("INSERT INTO ingredients (uid, inci_name, synonyms, active_key, functions, annexes, description, cas_number, ec_number) VALUES ("
                    + ", ".join(q(rec[k]) for k in ("uid","inci_name","synonyms","active_key","functions","annexes","description","cas_number","ec_number"))
                    + ");\n")
        f.write("COMMIT;\n")
        f.write("INSERT INTO ingredients_fts(ingredients_fts) VALUES('rebuild');\n")

    # --- report -------------------------------------------------------------------
    ann = Counter(a for rec in final for a in json.loads(rec["annexes"]))
    with open(outdir / "seed_report.txt", "w", encoding="utf-8") as f:
        f.write(f"source: {src.name}\nrecords in: {len(rows)}\nunique ingredients out: {len(final)}\n")
        f.write(f"annex membership: {dict(ann)}\n")
        f.write(f"with synonyms: {sum(1 for r in final if r['synonyms'] != '[]')}\n")
        f.write(f"with CAS: {sum(1 for r in final if r['cas_number'])}\n\ndropped/deduped log:\n")
        for reason, r in dropped:
            f.write(f"  [{reason}] {r.get('INCI name','?')}\n")
    print(f"annex membership: {dict(ann)}")
    print(f"wrote: {dbp} ({dbp.stat().st_size/1e6:.1f} MB), ingredients_seed.sql "
          f"({(outdir/'ingredients_seed.sql').stat().st_size/1e6:.1f} MB), seed_report.txt")

if __name__ == "__main__":
    main()
