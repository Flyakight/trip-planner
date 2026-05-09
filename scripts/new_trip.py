#!/usr/bin/env python3
"""
Scaffold a new client trip — creates trips/<slug>-<year>-<entropy>.csv with
the standard schema header, plus a placeholder Fixed row so the trip renders
something on first load. Also registers the trip in trips/index.json so it
shows up in the admin home (/?admin=1).

Usage:
  python3 scripts/new_trip.py "Kate & Sarah Albania"
  python3 scripts/new_trip.py "Cordaro/Fraim/Brown Montreal" --year 2026
  python3 scripts/new_trip.py "Olicoy Italia" --year 2026 --no-stub --display "Olicoy — Italia"
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import secrets
import string
import sys
from datetime import datetime
from pathlib import Path

COLUMNS = [
    "Date", "WakeUp", "Sleep", "Type", "Category", "TimeSlot", "Title",
    "Location", "MapLink", "Details", "ConfNo", "Cost", "TicketLink",
    "City", "Tags",
]

REPO_ROOT = Path(__file__).resolve().parents[1]
TRIPS_DIR = REPO_ROOT / "trips"
INDEX_PATH = TRIPS_DIR / "index.json"
PROD_BASE = "https://trips.thereandback.club"
LOCAL_BASE = "http://localhost:8765"


def slugify(s: str) -> str:
    s = s.lower()
    # Treat & and / as separators (so "Cordaro/Fraim/Brown" → "cordaro-fraim-brown")
    s = re.sub(r"[&/]+", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def random_entropy(n: int = 4) -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def load_index() -> list[dict]:
    if INDEX_PATH.exists():
        with INDEX_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_index(entries: list[dict]) -> None:
    # Sort newest-first by year then by created date
    entries.sort(key=lambda e: (e.get("year", 0), e.get("createdAt", "")), reverse=True)
    with INDEX_PATH.open("w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
        f.write("\n")


def stub_row(year: int) -> dict:
    """A placeholder Fixed row so the new trip isn't an empty-state landing."""
    return {
        "Date": f"{year}-01-01",
        "WakeUp": "Home",
        "Sleep": "Destination — TBD",
        "Type": "Fixed",
        "Category": "Flight",
        "TimeSlot": "10:00",
        "Title": "Outbound flight (placeholder — replace me)",
        "Location": "Home airport",
        "MapLink": "",
        "Details": "Replace this row with the real outbound flight once booked.",
        "ConfNo": "",
        "Cost": "",
        "TicketLink": "",
        "City": "",
        "Tags": "",
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", help='Trip name, e.g. "Kate & Sarah Albania"')
    ap.add_argument("--year", type=int, default=datetime.now().year,
                    help="Year for the trip slug + stub row (default: current year)")
    ap.add_argument("--display", default=None,
                    help="Display name for the admin index (default: same as name)")
    ap.add_argument("--entropy", default=None,
                    help="4-char unguessable suffix (default: random)")
    ap.add_argument("--no-stub", action="store_true",
                    help="Don't include the placeholder Flight row (file will be header-only)")
    ap.add_argument("--no-index", action="store_true",
                    help="Don't register the trip in trips/index.json (rare — for templates)")
    ap.add_argument("--timezone", default=None,
                    help='IANA timezone for the destination, e.g. "Europe/Tirane". '
                         'Used by the app to compute "today" in local trip time. '
                         'Falls back to the browser timezone if omitted.')
    args = ap.parse_args()

    if args.timezone and "/" not in args.timezone:
        print(f'warning: "{args.timezone}" does not look like an IANA tz id '
              f'(expected "Region/City")', file=sys.stderr)

    slug_base = slugify(args.name)
    if not slug_base:
        print("error: name must contain at least one alphanumeric character", file=sys.stderr)
        return 2

    suffix = args.entropy or random_entropy()
    if not re.match(r"^[a-z0-9]{2,8}$", suffix):
        print("error: --entropy must be 2-8 chars of [a-z0-9]", file=sys.stderr)
        return 2

    slug = f"{slug_base}-{args.year}-{suffix}"
    out = TRIPS_DIR / f"{slug}.csv"
    if out.exists():
        print(f"error: {out.relative_to(REPO_ROOT)} already exists. Pick a different name or --entropy.", file=sys.stderr)
        return 2

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        if not args.no_stub:
            w.writerow(stub_row(args.year))

    # Register in the manifest
    if not args.no_index:
        entries = load_index()
        # Avoid duplicate slugs
        entries = [e for e in entries if e.get("slug") != slug]
        entry = {
            "slug": slug,
            "name": args.display or args.name,
            "year": args.year,
            "createdAt": datetime.now().strftime("%Y-%m-%d"),
        }
        if args.timezone:
            entry["timezone"] = args.timezone
        entries.append(entry)
        save_index(entries)

    print(f"\n✓ Created trips/{out.name}")
    if not args.no_index:
        print(f"✓ Registered in trips/index.json")

    print(f"\nLocal preview:")
    print(f"  Client view:  {LOCAL_BASE}/?id={slug}")
    print(f"  Admin view:   {LOCAL_BASE}/?id={slug}&admin=1")
    print(f"  Admin home:   {LOCAL_BASE}/?admin=1")

    print(f"\nAfter `git push`:")
    print(f"  Client URL:   {PROD_BASE}/?id={slug}")
    print(f"  Admin URL:    {PROD_BASE}/?id={slug}&admin=1")

    print(f"\nNext steps:")
    print(f"  git add trips/{out.name} trips/index.json")
    print(f'  git commit -m "Add {args.display or args.name} trip"')
    print(f"  git push")
    return 0


if __name__ == "__main__":
    sys.exit(main())
