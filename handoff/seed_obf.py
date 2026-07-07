#!/usr/bin/env python3
"""
seed_obf.py — Open Beauty Facts JSONL dump -> Vials `products` seed (schema v2)

Usage:
    python3 seed_obf.py <openbeautyfacts-products.jsonl.gz> [outdir] [--all-countries] [--limit N]

Get the dump (~1-2 GB) from:
    https://static.openbeautyfacts.org/data/openbeautyfacts-products.jsonl.gz

Outputs (outdir, default ./out):
    products_seed.sql   — INSERTs + FTS rebuild for `turso db shell vials-corpus`
    products.db         — local SQLite (schema v2 products table + FTS) for inspection
    obf_report.txt      — filter funnel stats + skip log summary

LICENSING NOTE: rows produced here are ODbL (share-alike). They are stamped
source='obf_import' — never change that; it is the licensing firewall.
Attribution required in-app: "Product data from Open Beauty Facts (ODbL)".
"""
import gzip, json, re, sqlite3, sys, unicodedata, uuid
from collections import Counter
from pathlib import Path

# ── EU market filter (EU-27 + UK/NO/CH, OBF country tags) ────────────────────
EU_TAGS = {f"en:{c}" for c in (
    "austria belgium bulgaria croatia cyprus czech-republic denmark estonia "
    "finland france germany greece hungary ireland italy latvia lithuania "
    "luxembourg malta netherlands poland portugal romania slovakia slovenia "
    "spain sweden united-kingdom norway switzerland european-union").split()}

# ── categories_tags -> app product_type (patterns from real OBF tag survey) ──
TYPE_RULES: list[tuple[str, str]] = [
    (r"sunscreen|sun-protection|suncare|spf|after-sun|solaire",           "spf"),
    (r"serum|ampoule|essence",                                            "serum"),
    (r"exfoliant|peeling|scrub|gommage",                                  "exfoliant"),
    (r"cleanser|cleansing|face-wash|micellar|makeup-remover|demaquillant","cleanser"),
    (r"toner|tonic|facial-mist|lotion-tonique",                           "toner"),
    (r"eye-contour|eye-cream|contour-des-yeux",                           "eye_care"),
    (r"face-mask|sheet-mask|masks|masques",                               "mask"),
    (r"facial-cream|face-cream|face-care|day-cream|night-cream|anti-aging|moisturi[sz]er|body-cream|body-milk|body-lotion|hand-cream|creme-pour-les-mains|skin-care", "moisturizer"),
    (r"facial-oil|body-oil|face-oil|huile",                               "oil"),
    (r"lip-balm|lip-care|baume-a-levres",                                 "lip_care"),
    (r"shampoo|shampooing",                                               "shampoo"),
    (r"conditioner|hair-mask|apres-shampooing",                           "conditioner"),
    (r"hair-dye|hair-coloring|coloration|coiffant|hair",                  "hair_other"),
    (r"deodorant|antiperspirant|anti-perspirant",                         "deodorant"),
    (r"soap|savon|shower|douche|bath|bain|gel-douche|hygiene-products",   "wash"),
    (r"shaving|rasage|aftershave",                                        "shaving"),
    (r"foundation|concealer|lipstick|mascara|eyeshadow|blush|makeup|make-up|maquillage|nail|vernis", "makeup"),
    (r"perfume|parfum|fragrance|eau-de|cologne",                          "fragrance"),
    (r"toothpaste|dentifrice|oral|mouthwash|bain-de-bouche|tooth",        "oral_care"),
    (r"wipes|lingettes",                                                  "wipes"),
]
TYPE_RULES = [(re.compile(p), t) for p, t in TYPE_RULES]

# name-keyword fallback for products with only generic tags (multilingual)
NAME_RULES: list[tuple[str, str]] = [
    (r"\bserum\b|\bs[ée]rum\b",                                          "serum"),
    (r"sunscreen|sun\s?cream|spf\s?\d|creme solaire|sonnencreme|protector solar", "spf"),
    (r"toner|tonic|tonique|gesichtswasser",                                "toner"),
    (r"peeling|scrub|exfoliant|gommage",                                   "exfoliant"),
    (r"cleanser|face wash|micellar|micellaire|nettoyant|reinigung|limpiador", "cleanser"),
    (r"mask|masque|maske|mascarilla",                                      "mask"),
    (r"eye cream|contour des yeux|augencreme",                             "eye_care"),
    (r"shampo|szampon|champu|champô",                                      "shampoo"),
    (r"conditioner|apres-shampo|sp[üu]lung|balsamo|odzywka",               "conditioner"),
    (r"deo\b|deodorant|antiperspirant|antytranspirant",                    "deodorant"),
    (r"toothpaste|dentifrice|zahnpasta|tandpasta|pasta do zebow|mouthwash|bain de bouche", "oral_care"),
    (r"shower|douche|duschgel|soap|savon|seife|jabon|mydlo|bath|bain|zel pod prysznic",   "wash"),
    (r"body (milk|lotion|butter)|hand ?cream|creme mains|handcreme|moisturi|hydratant|feuchtigkeits|nawilzajacy|face cream|creme visage|gesichtscreme|krem do", "moisturizer"),
    (r"\boil\b|huile|[öo]l\b|olejek",                                    "oil"),
    (r"lip balm|baume.{0,3}l[èe]vres|lippenbalsam|pomadka ochronna",       "lip_care"),
    (r"mascara|lipstick|rouge a levres|foundation|fond de teint|eyeshadow|nail|vernis|lakier", "makeup"),
    (r"parfum|perfume|eau de (toilette|parfum)|cologne|woda (toaletowa|perfumowana)", "fragrance"),
    (r"aftershave|shaving|rasage|do golenia",                              "shaving"),
    (r"wipes|lingettes|feuchtt[üu]cher|chusteczki",                        "wipes"),
    (r"hair|cheveux|haar|wlosow|coiffant|hairspray|laque|gel coiffant",    "hair_other"),
]
NAME_RULES = [(re.compile(p, re.I), t) for p, t in NAME_RULES]

BARCODE_RE = re.compile(r"^\d{8}$|^\d{12,14}$")   # EAN-8, UPC-A, EAN-13, GTIN-14

def clean(s) -> str:
    if not isinstance(s, str): return ""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip()

def pick_name(p: dict) -> str:
    return clean(p.get("product_name_en") or p.get("product_name") or "")

def pick_inci(p: dict) -> str:
    return clean(p.get("ingredients_text_en") or p.get("ingredients_text") or "")

def pick_type(p: dict) -> str:
    tags = " ".join(p.get("categories_tags") or []).lower()
    for rx, t in TYPE_RULES:
        if rx.search(tags): return t
    import unicodedata as _ud
    name = "".join(c for c in _ud.normalize("NFD", pick_name(p)) if not _ud.combining(c))
    for rx, t in NAME_RULES:
        if rx.search(name): return t
    return "other"

def pick_image(p: dict) -> str | None:
    u = p.get("image_front_url") or p.get("image_url")
    return clean(u) or None

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args: sys.exit(__doc__)
    src = Path(args[0])
    outdir = Path(args[1] if len(args) > 1 else "out"); outdir.mkdir(exist_ok=True)
    eu_only = "--all-countries" not in sys.argv
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

    funnel = Counter(); types = Counter()
    by_barcode: dict[str, dict] = {}
    no_barcode: list[dict] = []

    opener = gzip.open if src.suffix == ".gz" else open
    with opener(src, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            funnel["read"] += 1
            if limit and funnel["read"] > limit: break
            try:
                p = json.loads(line)
            except json.JSONDecodeError:
                funnel["bad_json"] += 1; continue

            if eu_only and not (set(p.get("countries_tags") or []) & EU_TAGS):
                funnel["non_eu"] += 1; continue

            name = pick_name(p)
            if not name:
                funnel["no_name"] += 1; continue

            inci = pick_inci(p)
            if not inci or len(inci) < 10:            # quality gate: ingredientless rows are useless to us
                funnel["no_ingredients"] += 1; continue

            code = clean(str(p.get("code") or ""))
            barcode = code if BARCODE_RE.match(code) else None
            if code and not barcode:
                funnel["bad_barcode_kept_null"] += 1   # keep the product, drop the malformed code

            brand = clean((p.get("brands") or "").split(",")[0]) or None
            ptype = pick_type(p); types[ptype] += 1

            rec = dict(
                uid=str(uuid.uuid4()),
                barcode=barcode, brand=brand, name=name[:200],
                type=ptype, inci_raw=inci[:10000],
                image_url=pick_image(p), source="obf_import",
            )
            if barcode:
                prev = by_barcode.get(barcode)
                if prev:                               # dedupe: prefer richer record
                    funnel["dupe_barcode"] += 1
                    if (len(inci) + bool(brand)) <= (len(prev["inci_raw"]) + bool(prev["brand"])): continue
                by_barcode[barcode] = rec
            else:
                no_barcode.append(rec)
            funnel["kept"] += 1

    final = list(by_barcode.values()) + no_barcode
    print(f"funnel: {dict(funnel)}")
    print(f"kept {len(final)} products ({len(no_barcode)} without barcode); types: {dict(types.most_common(10))}")

    # ── local SQLite ──────────────────────────────────────────────────────────
    DDL = """
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, uid TEXT NOT NULL UNIQUE, barcode TEXT,
      brand TEXT, name TEXT NOT NULL,
      search_norm TEXT GENERATED ALWAYS AS (lower(trim(coalesce(brand,'') || ' ' || name))) STORED,
      type TEXT NOT NULL DEFAULT 'other', inci_raw TEXT, image_url TEXT,
      source TEXT NOT NULL, rating REAL, rating_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode) WHERE barcode IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_products_source ON products (source);
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      search_norm, content='products', content_rowid='id', tokenize='trigram');
    """
    dbp = outdir / "products.db"; dbp.unlink(missing_ok=True)
    db = sqlite3.connect(dbp); db.executescript(DDL)
    db.executemany("""INSERT INTO products (uid, barcode, brand, name, type, inci_raw, image_url, source)
                      VALUES (:uid,:barcode,:brand,:name,:type,:inci_raw,:image_url,:source)""", final)
    db.execute("INSERT INTO products_fts(products_fts) VALUES('rebuild')"); db.commit()

    # ── Turso-loadable SQL ────────────────────────────────────────────────────
    def q(v): return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
    with open(outdir / "products_seed.sql", "w", encoding="utf-8") as f:
        f.write("-- OBF seed for vials_corpus.products — ODbL data, source='obf_import'\nBEGIN;\n")
        for r in final:
            f.write("INSERT INTO products (uid, barcode, brand, name, type, inci_raw, image_url, source) VALUES ("
                    + ", ".join(q(r[k]) for k in ("uid","barcode","brand","name","type","inci_raw","image_url","source")) + ");\n")
        f.write("COMMIT;\nINSERT INTO products_fts(products_fts) VALUES('rebuild');\n")

    with open(outdir / "obf_report.txt", "w") as f:
        f.write(f"source: {src.name}\nfunnel: {dict(funnel)}\ntypes: {dict(types)}\nfinal: {len(final)}\n")
    print(f"wrote {dbp} ({dbp.stat().st_size/1e6:.1f} MB), products_seed.sql "
          f"({(outdir/'products_seed.sql').stat().st_size/1e6:.1f} MB), obf_report.txt")

if __name__ == "__main__":
    main()
