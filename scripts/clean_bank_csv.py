#!/usr/bin/env python3
"""
Clean Bank-rows CSVs produced by kml_to_bank_csv.py:

  1. Dedupe rows whose (City, Title) match (case-insensitive, trimmed).
     When duplicates exist, keep the row with the most-filled Details.
  2. Drop rows whose Title looks like a bare street address — i.e. the
     pin had no name in Google My Maps so it fell back to the address
     (e.g. "Via del Proconsolo, 9R, 50122 Firenze FI, Italy").
  3. Strip stray whitespace, normalize tags, leave everything else
     untouched.

Usage:
  # Clean one file in place:
  python3 scripts/clean_bank_csv.py trips/drafts/olicoy-florence.csv

  # Clean multiple files (each in place):
  python3 scripts/clean_bank_csv.py trips/drafts/olicoy-*.csv

  # Preview without writing:
  python3 scripts/clean_bank_csv.py --dry-run trips/drafts/olicoy-rome.csv

  # Keep address-only titles (in case you want them):
  python3 scripts/clean_bank_csv.py --keep-addresses trips/drafts/olicoy-venice.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

# Italian street-type prefixes that, combined with a number, indicate a bare address title.
# Includes common abbreviations (V., Vle., P.za, P.le, C.so).
STREET_TYPES = (
    r"V\.", r"Via\.?", r"Viale\.?", r"Vle\.?",
    r"Vicolo", r"Vico", r"Vie",
    r"Costa", r"Costiera",
    r"Lungo(?:tevere|arno|mare|dora)?",
    r"Largo", r"L\.go",
    r"Piazzale", r"P\.le",
    r"Piazzetta", r"P\.za", r"P\.zza",
    r"Corso", r"C\.so",
    r"Salita", r"Calle", r"Campo", r"Fondamenta", r"Riva",
    r"Strada", r"Borgo",
)
ADDRESS_TITLE_RE = re.compile(
    r"^\s*(?:" + "|".join(STREET_TYPES) + r")\s+[\w'’\.\s]+,\s*\d+",
    re.IGNORECASE | re.UNICODE,
)


def looks_like_orphan_address(title: str, details: str) -> bool:
    """
    True only for pins where the title is a bare street address AND the user
    didn't add any description — i.e. a true orphan pin. Pins with addresses
    as titles but with real content in Details are kept (rename later).
    """
    if (details or "").strip():
        return False  # has content — worth keeping, just needs a rename
    if not title:
        return False
    return bool(ADDRESS_TITLE_RE.match(title.strip()))


def detail_richness(row: dict) -> int:
    """Score for picking the 'best' duplicate to keep. Longer details win; non-empty Tags break ties."""
    return (
        len((row.get("Details") or "").strip()),
        1 if (row.get("Tags") or "").strip() else 0,
        len((row.get("Location") or "").strip()),
    )


def clean_file(path: Path, *, keep_addresses: bool, dry_run: bool) -> dict:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    before = len(rows)
    if not before:
        return {"path": path, "before": 0, "after": 0, "addresses_dropped": 0, "dups_dropped": 0}

    # 1. Drop bare-address titles where Details is also empty (orphan pins).
    addresses_dropped = []
    if not keep_addresses:
        kept = []
        for row in rows:
            if looks_like_orphan_address(row.get("Title", ""), row.get("Details", "")):
                addresses_dropped.append(row)
            else:
                kept.append(row)
        rows = kept

    # 2. Dedupe by (City, Title) — keep the richest version
    seen: dict[tuple[str, str], dict] = {}
    order: list[tuple[str, str]] = []
    dups_dropped = 0
    for row in rows:
        key = (row.get("City", "").strip().lower(), row.get("Title", "").strip().lower())
        if not key[1]:
            # No title at all — keep with a unique sentinel so it survives
            order.append(("__notitle__", str(id(row))))
            seen[("__notitle__", str(id(row)))] = row
            continue
        if key not in seen:
            seen[key] = row
            order.append(key)
        else:
            dups_dropped += 1
            # Keep the richer one
            if detail_richness(row) > detail_richness(seen[key]):
                seen[key] = row

    out_rows = [seen[k] for k in order if k in seen]

    # 3. Light whitespace / tag normalization
    for row in out_rows:
        for col in ("Title", "Details", "Location", "City", "Category"):
            if col in row and row[col] is not None:
                row[col] = re.sub(r"\s+", " ", row[col]).strip()
        if row.get("Tags"):
            tags = [t.strip().lower() for t in row["Tags"].split("|") if t.strip()]
            # de-dupe tags, preserve order
            row["Tags"] = "|".join(dict.fromkeys(tags))

    if not dry_run:
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
            w.writeheader()
            for row in out_rows:
                w.writerow(row)

    return {
        "path": path,
        "before": before,
        "after": len(out_rows),
        "addresses_dropped": len(addresses_dropped),
        "dups_dropped": dups_dropped,
        "dropped_address_titles": [r.get("Title", "") for r in addresses_dropped],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", type=Path, help="CSV file(s) to clean (in place)")
    ap.add_argument("--keep-addresses", action="store_true",
                    help="Don't drop pins whose Title looks like a bare street address")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print what would change without writing")
    args = ap.parse_args()

    grand_before = grand_after = grand_addr = grand_dup = 0
    for p in args.inputs:
        if not p.exists():
            print(f"warning: {p} does not exist, skipping", file=sys.stderr)
            continue
        result = clean_file(p, keep_addresses=args.keep_addresses, dry_run=args.dry_run)
        verb = "Would clean" if args.dry_run else "Cleaned"
        print(f"\n{verb} {result['path']}")
        print(f"  rows: {result['before']} → {result['after']}")
        if result["addresses_dropped"]:
            print(f"  dropped {result['addresses_dropped']} bare-address title(s):")
            for t in result["dropped_address_titles"][:5]:
                print(f"    · {t}")
            if result["addresses_dropped"] > 5:
                print(f"    · …and {result['addresses_dropped'] - 5} more")
        if result["dups_dropped"]:
            print(f"  dropped {result['dups_dropped']} duplicate title(s) within city")

        grand_before += result["before"]
        grand_after  += result["after"]
        grand_addr   += result["addresses_dropped"]
        grand_dup    += result["dups_dropped"]

    if len(args.inputs) > 1:
        print(f"\n=== Total: {grand_before} → {grand_after}  "
              f"({grand_dup} dups, {grand_addr} address-titles dropped) ===")

    return 0


if __name__ == "__main__":
    sys.exit(main())
