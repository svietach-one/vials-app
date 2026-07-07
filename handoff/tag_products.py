#!/usr/bin/env python3
"""
tag_products.py — populate product_tags from inci_raw via the CosIng dictionary map.

Usage:
    python3 tag_products.py <products.db> <active_key_map.json> [outdir]

Outputs:
    product_tags_seed.sql — DELETE + INSERTs for `turso db shell vials-corpus`
    tag_report.txt        — coverage stats
Matching = dictionary exact-match on tokens (accent-folded) + a narrow
word-boundary phrase fallback for the unambiguous conflict-critical actives.
"""
import json, re, sqlite3, sys, unicodedata
from collections import Counter
from pathlib import Path

# unambiguous multi-word phrases; rescues tokens mangled by odd delimiters
PHRASE_FALLBACK = [
    ("retinoid",        re.compile(r"\bretin(ol|al|yl|oate|aldehyde)\b")),
    ("bha",             re.compile(r"\bsalicylic acid\b")),
    ("aha",             re.compile(r"\b(glycolic|lactic|mandelic) acid\b")),
    ("vitamin_c_pure",  re.compile(r"\b(l-)?ascorbic acid\b(?! polysorbate)")),
    ("niacinamide",     re.compile(r"\bniacinamide\b")),
    ("azelaic_acid",    re.compile(r"\bazelaic acid\b")),
    ("benzoyl_peroxide",re.compile(r"\bbenzoyl peroxide\b")),
    ("hyaluronic_acid", re.compile(r"\b(sodium )?hyaluron(ate|ic acid)\b")),
]

def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower()).strip()

def tokens(inci: str):
    for t in re.split(r"[,;·|•/]| - ", inci):
        t = re.sub(r"\(.*?\)", " ", t)            # drop parentheticals ...
        t = re.sub(r"[\d.]+\s*%|[*†‡]", " ", t)   # ...percentages, footnote marks
        t = fold(t)
        if t: yield t
    for m in re.finditer(r"\((.*?)\)", inci):     # ...but also try parens content as tokens
        t = fold(m.group(1))
        if t: yield t

def main():
    if len(sys.argv) < 3: sys.exit(__doc__)
    dbp, mapp = Path(sys.argv[1]), Path(sys.argv[2])
    outdir = Path(sys.argv[3] if len(sys.argv) > 3 else dbp.parent); outdir.mkdir(exist_ok=True)
    kmap = json.load(open(mapp, encoding="utf-8"))

    db = sqlite3.connect(dbp); db.row_factory = sqlite3.Row
    rows = db.execute("SELECT id, uid, inci_raw FROM products WHERE inci_raw IS NOT NULL").fetchall()

    per_key, tagged_products, inserts = Counter(), 0, []
    for r in rows:
        keys = {kmap[t] for t in tokens(r["inci_raw"]) if t in kmap}
        folded = fold(r["inci_raw"])
        for key, rx in PHRASE_FALLBACK:
            if rx.search(folded): keys.add(key)
        if keys: tagged_products += 1
        for k in sorted(keys):
            per_key[k] += 1
            inserts.append((r["id"], k))

    with open(outdir / "product_tags_seed.sql", "w") as f:
        f.write("-- product_tags from dictionary-driven tagger\nBEGIN;\nDELETE FROM product_tags;\n")
        for pid, k in inserts:
            f.write(f"INSERT OR IGNORE INTO product_tags (product_id, active_key) VALUES ({pid}, '{k}');\n")
        f.write("COMMIT;\n")
    with open(outdir / "tag_report.txt", "w") as f:
        f.write(f"products with inci_raw: {len(rows)}\nproducts tagged: {tagged_products} ({100*tagged_products/max(len(rows),1):.1f}%)\n")
        f.write(f"tags written: {len(inserts)}\nper key: {dict(per_key.most_common())}\n")
    print(f"products with inci: {len(rows)}; tagged: {tagged_products} ({100*tagged_products/max(len(rows),1):.1f}%); tags: {len(inserts)}")
    print("per key:", dict(per_key.most_common()))
    print(f"wrote {outdir/'product_tags_seed.sql'}, {outdir/'tag_report.txt'}")

if __name__ == "__main__":
    main()
