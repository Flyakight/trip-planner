#!/usr/bin/env python3
"""
Convert a Google My Maps KML export into Bank rows for the trip CSV schema.

Each <Placemark> with a <Point> becomes one Bank row. The placemark's
enclosing <Folder> name (if any) is used as the City. Description HTML
is stripped. Coordinates are turned into a Google Maps URL.

Category inference (conservative, keyword-based):
  - "Food"     for placemarks whose name/description hits a food keyword
                 (ristorante, trattoria, osteria, pizzeria, gelateria,
                  caffè, enoteca, pasticceria, restaurant, bar, etc.)
  - "Hotel"    for hotel/lodging keywords
  - otherwise  --category-default (default: "Activity")

Usage:
  python3 scripts/kml_to_bank_csv.py \\
      --input italy-ideas.kml \\
      --output trips/drafts/italy-ideas-bank.csv

  # Append directly into the live trip CSV (no header row written):
  python3 scripts/kml_to_bank_csv.py \\
      --input italy-ideas.kml \\
      --output trips/kim-steph-italy-2026-k7n4.csv \\
      --append

  # KML without folder structure — set city for everything:
  python3 scripts/kml_to_bank_csv.py \\
      --input italy-ideas.kml \\
      --output trips/drafts/italy-ideas-bank.csv \\
      --city-override Rome

  # See what it would write without touching disk:
  python3 scripts/kml_to_bank_csv.py --input italy-ideas.kml --output /dev/null --dry-run
"""

from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# CSV schema in the trip app — keep order in sync with trips/*.csv
COLUMNS = [
    "Date", "WakeUp", "Sleep", "Type", "Category", "TimeSlot", "Title",
    "Location", "MapLink", "Details", "ConfNo", "Cost", "TicketLink",
    "City", "Tags",
]

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}

FOOD_KEYWORDS = {
    "ristorante", "ristoro", "trattoria", "osteria", "hostaria", "pizzeria",
    "gelateria", "gelato", "caffè", "caffe", "cafe", "café", "bar",
    "enoteca", "pasticceria", "panificio", "forno", "rosticceria", "tavola",
    "pub", "wine", "vino", "restaurant", "eatery", "eat ", "dining",
    "brunch", "breakfast", "lunch", "dinner", "supper", "bistro",
    "michelin",
}
HOTEL_KEYWORDS = {
    "hotel", "albergo", "b&b", "bnb", "bed and breakfast", "guesthouse",
    "guest house", "residence", "boutique stay", "airbnb", "lodging",
    "hostel",
}

TAG_TRIGGERS = {
    "reservation": ("book", "reserv", "prenota", "advance"),
    "splurge":     ("michelin", "tasting menu", "splurge"),
    "casual":      ("casual",),
    "view":        ("view", "panorama", "vista"),
    "free":        ("free entry", "no fee"),
    "morning":     ("morning", "early"),
    "evening":     ("evening", "night", "sunset"),
}

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


# ---------- KML parsing ----------

def parse_kml(path: Path) -> list[dict]:
    """Return a flat list of {name, description, lat, lng, address, folder}."""
    tree = ET.parse(path)
    root = tree.getroot()
    placemarks: list[dict] = []
    _walk(root, folder_name=None, sink=placemarks)
    return placemarks


def _walk(node: ET.Element, folder_name: str | None, sink: list[dict]) -> None:
    for child in node:
        tag = _localname(child.tag)
        if tag == "Folder":
            name_el = child.find("kml:name", KML_NS)
            if name_el is None:
                name_el = child.find("name")
            new_folder = name_el.text.strip() if (name_el is not None and name_el.text) else folder_name
            _walk(child, new_folder, sink)
        elif tag == "Document":
            _walk(child, folder_name, sink)
        elif tag == "Placemark":
            pm = _read_placemark(child, folder_name)
            if pm:
                sink.append(pm)
        else:
            # keep walking — KML can be nested oddly
            _walk(child, folder_name, sink)


def _localname(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _read_placemark(pm: ET.Element, folder: str | None) -> dict | None:
    name = _text(pm, "name")
    desc = _text(pm, "description") or ""
    addr = _text(pm, "address") or ""

    coords_el = pm.find(".//kml:Point/kml:coordinates", KML_NS)
    if coords_el is None or not coords_el.text:
        return None  # skip lines, polygons, routes

    raw = coords_el.text.strip().split(",")
    if len(raw) < 2:
        return None
    try:
        lng = float(raw[0])
        lat = float(raw[1])
    except ValueError:
        return None

    return {
        "name": (name or "Untitled pin").strip(),
        "description": _clean_html(desc),
        "address": addr.strip(),
        "lat": lat,
        "lng": lng,
        "folder": folder.strip() if folder else "",
    }


def _text(el: ET.Element, child: str) -> str | None:
    found = el.find(f"kml:{child}", KML_NS)
    if found is None:
        found = el.find(child)
    return found.text if (found is not None and found.text) else None


def _clean_html(s: str) -> str:
    if not s:
        return ""
    # Convert <br> and </p> to line breaks before stripping
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p>", "\n\n", s, flags=re.I)
    s = HTML_TAG_RE.sub("", s)
    s = html.unescape(s)
    # Collapse runs of whitespace, but keep paragraph breaks
    parts = [WHITESPACE_RE.sub(" ", p).strip() for p in s.split("\n")]
    parts = [p for p in parts if p]
    return " — ".join(parts) if len(parts) > 1 else (parts[0] if parts else "")


# ---------- Categorization ----------

def infer_category(name: str, desc: str, default: str) -> str:
    blob = f"{name} {desc}".lower()
    if any(k in blob for k in HOTEL_KEYWORDS):
        return "Hotel"
    if any(k in blob for k in FOOD_KEYWORDS):
        return "Food"
    return default


def infer_tags(name: str, desc: str, category: str) -> str:
    blob = f"{name} {desc}".lower()
    tags = set()
    if category == "Food":
        tags.add("food")
    for tag, triggers in TAG_TRIGGERS.items():
        if any(t in blob for t in triggers):
            tags.add(tag)
    return "|".join(sorted(tags))


def maps_url(lat: float, lng: float, name: str) -> str:
    # Google Maps URL spec — opens the pin at lat/lng with the name as the search.
    # Falls back gracefully if the name is gibberish.
    from urllib.parse import quote_plus
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(name)}+{lat},{lng}"


# ---------- CSV writing ----------

def to_row(pm: dict, *, category_default: str, city_override: str | None) -> dict:
    category = infer_category(pm["name"], pm["description"], category_default)
    city = city_override if city_override else pm["folder"]
    return {
        "Date": "",
        "WakeUp": "",
        "Sleep": "",
        "Type": "Bank",
        "Category": category,
        "TimeSlot": "",
        "Title": pm["name"],
        "Location": pm["address"],
        "MapLink": maps_url(pm["lat"], pm["lng"], pm["name"]),
        "Details": pm["description"],
        "ConfNo": "",
        "Cost": "",
        "TicketLink": "",
        "City": city,
        "Tags": infer_tags(pm["name"], pm["description"], category),
    }


def write_csv(rows: list[dict], out_path: Path, *, append: bool, dry_run: bool) -> None:
    if dry_run:
        w = csv.DictWriter(sys.stdout, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        if not append:
            w.writeheader()
        for r in rows:
            w.writerow(r)
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append and out_path.exists() else "w"
    write_header = not (append and out_path.exists() and out_path.stat().st_size > 0)
    with out_path.open(mode, newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        if write_header:
            w.writeheader()
        for r in rows:
            w.writerow(r)


# ---------- CLI ----------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", "-i", required=True, type=Path, help="Path to the .kml file from Google My Maps")
    ap.add_argument("--output", "-o", required=True, type=Path, help="Path to write the CSV (Bank rows)")
    ap.add_argument("--category-default", default="Activity",
                    help="Category for pins that don't match food/hotel keywords (default: Activity)")
    ap.add_argument("--city-override", default=None,
                    help="Set City for every row, ignoring folder names (useful for flat KMLs)")
    ap.add_argument("--append", action="store_true",
                    help="Append to --output instead of overwriting (skips header if file is non-empty)")
    ap.add_argument("--dry-run", action="store_true", help="Print rows to stdout instead of writing the file")
    args = ap.parse_args()

    if not args.input.exists():
        print(f"error: KML not found: {args.input}", file=sys.stderr)
        return 2

    placemarks = parse_kml(args.input)
    if not placemarks:
        print(f"warning: no <Placemark> with a <Point> found in {args.input}", file=sys.stderr)
        return 1

    rows = [to_row(pm, category_default=args.category_default, city_override=args.city_override)
            for pm in placemarks]

    write_csv(rows, args.output, append=args.append, dry_run=args.dry_run)

    # Summary to stderr so --dry-run stdout stays clean CSV
    by_city: dict[str, int] = {}
    by_cat: dict[str, int] = {}
    for r in rows:
        by_city[r["City"] or "(no city)"] = by_city.get(r["City"] or "(no city)", 0) + 1
        by_cat[r["Category"]] = by_cat.get(r["Category"], 0) + 1

    print(f"\nParsed {len(rows)} placemarks from {args.input.name}", file=sys.stderr)
    print(f"  By city:     {dict(sorted(by_city.items(), key=lambda x: -x[1]))}", file=sys.stderr)
    print(f"  By category: {dict(sorted(by_cat.items(), key=lambda x: -x[1]))}", file=sys.stderr)
    if not args.dry_run:
        verb = "Appended to" if args.append and args.output.exists() else "Wrote"
        print(f"  {verb} {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
