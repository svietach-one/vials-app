#!/usr/bin/env python3
"""
find_active_key_gaps.py — find ingredients that look like a known active class
(by the app's own actives.json matchers) but got no active_key from
assign_active_keys.py / active_key_map.json.

This is a recall net, not an authority: actives.json's regexes are broader/fuzzier
than the curated CosIng active_key_map.json, and the two are known to disagree
(~69 cases per DATA_PIPELINE.md's "parser parity" note). Every hit here is a
candidate for a human to review and, if genuine, add to active_key_map.json —
not an automatic reclassification.

Usage:
    python3 find_active_key_gaps.py <ingredients.db (post active_key_updates.sql)> <actives.json>
"""
import json, re, sqlite3, sys
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    dbp, rulesp = Path(sys.argv[1]), Path(sys.argv[2])
    ruleset = json.load(open(rulesp, encoding="utf-8"))

    compiled = []
    for key, cls in ruleset["classes"].items():
        positives = [re.compile(m["pattern"], re.I) for m in cls.get("matchers", [])]
        negatives = [re.compile(p, re.I) for p in cls.get("negativePatterns", [])]
        compiled.append((key, positives, negatives))

    db = sqlite3.connect(dbp); db.row_factory = sqlite3.Row
    rows = db.execute(
        "SELECT uid, inci_name, inci_name_norm, synonyms, active_key FROM ingredients"
    ).fetchall()

    gaps = {}
    for r in rows:
        if r["active_key"]:
            continue
        haystacks = [r["inci_name_norm"]] + [s.lower() for s in json.loads(r["synonyms"])]
        text = " | ".join(haystacks)
        for key, positives, negatives in compiled:
            if any(p.search(text) for p in positives) and not any(n.search(text) for n in negatives):
                gaps.setdefault(key, []).append((r["uid"], r["inci_name"]))
                break  # first matching class wins; a name rarely straddles two

    total = sum(len(v) for v in gaps.values())
    print(f"scanned {len(rows)} ingredients; {total} unclassified rows match an actives.json pattern\n")
    for key in sorted(gaps, key=lambda k: -len(gaps[k])):
        items = gaps[key]
        print(f"== {key} ({len(items)}) ==")
        for uid, name in items:
            print(f"  {uid}\t{name}")
        print()

if __name__ == "__main__":
    main()
