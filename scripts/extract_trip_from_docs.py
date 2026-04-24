#!/usr/bin/env python3
"""Build a draft trip CSV from mixed confirmation documents.

Usage:
  python3 scripts/extract_trip_from_docs.py --input ./confirmations --slug my-client-2026-a1b2

Outputs:
  trips/drafts/<slug>.csv
  trips/drafts/<slug>-review.csv
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import email
import email.policy
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

REQUIRED_HEADERS = [
    "Date",
    "WakeUp",
    "Sleep",
    "Type",
    "Category",
    "TimeSlot",
    "Title",
    "Location",
    "MapLink",
    "Details",
    "ConfNo",
    "Cost",
    "TicketLink",
    "City",
    "Tags",
]

SUPPORTED_EXTS = {".txt", ".md", ".eml", ".pdf", ".html", ".htm"}

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

URL_RE = re.compile(r"https?://[^\s\]\[\)\(\"'<>]+", re.IGNORECASE)
CURRENCY_RE = re.compile(r"(?:[$€£]\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*(?:\.\d{2})?\s?(?:USD|EUR|GBP))", re.IGNORECASE)
CONF_RE = re.compile(
    r"(?:confirmation|reservation|booking|record locator|pnr|ref(?:erence)?)[^\n:]{0,30}[:#\s]+([A-Z0-9\-]{5,})",
    re.IGNORECASE,
)
AIRPORT_RE = re.compile(r"\b[A-Z]{3}\b")
TIME_RE = re.compile(r"\b((?:[01]?\d|2[0-3]):[0-5]\d(?:\s?[ap]m)?|(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?[ap]m)\b", re.IGNORECASE)
ISO_DATE_RE = re.compile(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b")
US_DATE_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b")
MONTH_DATE_RE = re.compile(
    r"\b(" + "|".join(MONTHS.keys()) + r")\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b",
    re.IGNORECASE,
)
BAD_CODES = {
    "ARRIVAL",
    "DEPARTURE",
    "CHECKIN",
    "CHECKOUT",
    "CONFIRMATION",
    "RESERVATION",
    "BOOKING",
}
BAD_AIRPORT_TOKENS = {"THE", "AND", "FOR", "YOU", "HOT", "NOW"}


@dataclass
class DraftRow:
    row: dict[str, str]
    source_file: str
    confidence: float
    issues: list[str]


def read_file_text(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return read_pdf_text(path)
    if ext == ".eml":
        return read_eml_text(path)
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError as exc:
        return f"\n[read-error] {exc}\n"


def read_pdf_text(path: Path) -> str:
    cmd = ["pdftotext", "-layout", str(path), "-"]
    try:
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return ""
    if proc.returncode != 0:
        return ""
    return proc.stdout


def read_eml_text(path: Path) -> str:
    try:
        with path.open("rb") as f:
            msg = email.message_from_binary_file(f, policy=email.policy.default)
    except Exception:
        return path.read_text(encoding="utf-8", errors="ignore")

    chunks: list[str] = []
    if msg.get("Subject"):
        chunks.append(f"Subject: {msg['Subject']}")

    for part in msg.walk():
        ctype = part.get_content_type()
        if ctype == "text/plain":
            try:
                chunks.append(part.get_content())
            except Exception:
                pass
    return "\n".join(chunks)


def normalize_whitespace(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def iter_docs(root: Path) -> Iterable[Path]:
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
            yield p


def guess_category(text: str, filename: str) -> str:
    hay = f"{filename}\n{text[:3000]}".lower()
    if any(k in hay for k in ["flight", "airline", "boarding", "terminal", "record locator"]):
        return "Flight"
    if any(k in hay for k in ["hotel", "check-in", "check in", "lodging", "airbnb"]):
        return "Hotel"
    if any(k in hay for k in ["train", "rail", "freccia", "amtrak"]):
        return "Train"
    if any(k in hay for k in ["uber", "taxi", "transfer", "ferry", "vaporetto", "metro"]):
        return "Transit"
    if any(k in hay for k in ["car rental", "hertz", "sixt", "avis", "driving"]):
        return "Driving"
    if any(k in hay for k in ["restaurant", "dinner", "lunch", "reservation"]):
        return "Food"
    return "Activity"


def parse_date(text: str, default_year: int | None) -> tuple[str, list[str]]:
    issues: list[str] = []

    m = ISO_DATE_RE.search(text)
    if m:
        try:
            d = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return d.isoformat(), issues
        except ValueError:
            pass

    m = US_DATE_RE.search(text)
    if m:
        month = int(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3))
        if year < 100:
            year += 2000
        try:
            d = dt.date(year, month, day)
            return d.isoformat(), issues
        except ValueError:
            pass

    m = MONTH_DATE_RE.search(text)
    if m:
        mon = MONTHS[m.group(1).lower()]
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else (default_year or dt.date.today().year)
        try:
            d = dt.date(year, mon, day)
            return d.isoformat(), issues
        except ValueError:
            pass

    issues.append("No date found")
    return "", issues


def parse_time(text: str) -> tuple[str, list[str]]:
    issues: list[str] = []
    m = TIME_RE.search(text)
    if not m:
        return "", ["No time found"]

    raw = m.group(1).strip().lower().replace(".", "")
    try:
        if "am" in raw or "pm" in raw:
            t = dt.datetime.strptime(raw, "%I:%M %p") if ":" in raw else dt.datetime.strptime(raw, "%I %p")
        else:
            t = dt.datetime.strptime(raw, "%H:%M")
        return t.strftime("%H:%M"), issues
    except ValueError:
        return "", [f"Unparseable time: {raw}"]


def parse_title(text: str, category: str, filename: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    for pattern in [r"^subject:\s*(.+)$", r"^itinerary[:\s-]+(.+)$", r"^(?:trip|booking)\s+to\s+(.+)$"]:
        for line in lines[:15]:
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                val = cleanup_title(m.group(1))
                if val and not val.lower().startswith("for:"):
                    return val

    if category == "Flight":
        flight = re.search(r"\b([A-Z]{2}\s?\d{1,4})\b", text)
        if flight:
            return f"Flight {flight.group(1).replace(' ', '')}"
        if len(AIRPORT_RE.findall(text)) >= 2:
            codes = AIRPORT_RE.findall(text)[:2]
            return f"Flight {codes[0]} to {codes[1]}"

    stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    return cleanup_title(stem) or f"{category} confirmation"


def cleanup_title(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip(" -:\n\t")
    return s[:120]


def parse_location(text: str) -> str:
    for pat in [r"\baddress[:\s]+([^\n]{8,120})", r"\blocation[:\s]+([^\n]{8,120})", r"\bvenue[:\s]+([^\n]{8,120})"]:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip(" ,")

    airports = [t for t in AIRPORT_RE.findall(text) if t not in BAD_AIRPORT_TOKENS]
    if len(airports) >= 2:
        return f"{airports[0]} to {airports[1]}"
    if airports:
        return airports[0]
    return ""


def parse_city(location: str, text: str) -> str:
    candidates = []
    if location:
        candidates.append(location)
    candidates.append(text[:1500])
    for chunk in candidates:
        m = re.search(r"\b(?:in|to|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", chunk)
        if m:
            c = m.group(1)
            if len(c) > 2:
                return c
    return ""


def parse_urls(text: str) -> tuple[str, str]:
    urls = URL_RE.findall(text)
    if not urls:
        return "", ""
    map_like = ""
    ticket_like = urls[0]
    for u in urls:
        low = u.lower()
        if ("maps.google" in low or "apple.com/maps" in low) and not map_like:
            map_like = u
        if any(k in low for k in ["ticket", "booking", "reservation", "airline", "train", "hotel"]):
            ticket_like = u
            break
    return map_like, ticket_like


def parse_conf_no(text: str) -> str:
    m = CONF_RE.search(text)
    if m:
        conf = m.group(1).strip()
        if conf.upper() not in BAD_CODES:
            return conf

    # Backup: standalone likely locator
    for token in re.findall(r"\b[A-Z0-9]{6,10}\b", text):
        has_letter = any(c.isalpha() for c in token)
        has_digit = any(c.isdigit() for c in token)
        if has_letter and has_digit and token.upper() not in BAD_CODES:
            return token
    return ""


def parse_cost(text: str) -> str:
    m = CURRENCY_RE.search(text)
    return m.group(0).strip() if m else ""


def parse_details(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    keep = []
    for line in lines:
        if any(k in line.lower() for k in ["check", "arrive", "departure", "terminal", "seat", "gate", "policy", "cancel", "luggage", "baggage"]):
            keep.append(line)
        if len(keep) >= 3:
            break
    if not keep:
        keep = lines[:2]
    details = " | ".join(keep)
    details = re.sub(r"\s+", " ", details).strip()
    return details[:280]


def build_tags(category: str, has_date: bool, confidence: float) -> str:
    tags = [category.lower()]
    if not has_date:
        tags.append("needs-date")
    if confidence < 0.75:
        tags.append("review")
    return "|".join(tags)


def score_confidence(date: str, time_slot: str, conf_no: str, title: str, location: str, issues: list[str]) -> float:
    score = 0.2
    if date:
        score += 0.25
    if time_slot:
        score += 0.15
    if conf_no:
        score += 0.2
    if title:
        score += 0.1
    if location:
        score += 0.1
    score -= min(len(issues) * 0.08, 0.32)
    return max(0.1, min(round(score, 2), 0.95))


def parse_document(path: Path, text: str, default_year: int | None) -> DraftRow:
    normalized = normalize_whitespace(text)
    category = guess_category(normalized, path.name)

    date_val, date_issues = parse_date(normalized, default_year)
    time_val, time_issues = parse_time(normalized)
    title = parse_title(normalized, category, path.name)
    location = parse_location(normalized)
    city = parse_city(location, normalized)
    map_link, ticket_link = parse_urls(normalized)
    conf = parse_conf_no(normalized)
    cost = parse_cost(normalized)
    details = parse_details(normalized)

    issues = []
    issues.extend(date_issues)
    issues.extend(time_issues)
    if not conf:
        issues.append("No confirmation number found")
    if not location:
        issues.append("No location found")
    if title.lower().startswith("for:"):
        issues.append("Weak title extracted")

    confidence = score_confidence(date_val, time_val, conf, title, location, issues)
    row_type = "Fixed" if date_val else "Bank"
    tags = build_tags(category, bool(date_val), confidence)

    row = {
        "Date": date_val,
        "WakeUp": "",
        "Sleep": "",
        "Type": row_type,
        "Category": category,
        "TimeSlot": time_val,
        "Title": title,
        "Location": location,
        "MapLink": map_link,
        "Details": details,
        "ConfNo": conf,
        "Cost": cost,
        "TicketLink": ticket_link,
        "City": city,
        "Tags": tags,
    }
    return DraftRow(row=row, source_file=str(path), confidence=confidence, issues=issues)


def write_csv(path: Path, rows: list[DraftRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=REQUIRED_HEADERS)
        writer.writeheader()
        for draft in sorted(rows, key=lambda r: (r.row["Date"] or "9999-12-31", r.row["TimeSlot"] or "99:99", r.row["Title"])):
            writer.writerow(draft.row)


def write_review_csv(path: Path, rows: list[DraftRow]) -> None:
    fields = [
        "SourceFile",
        "Confidence",
        "Issues",
        "Date",
        "TimeSlot",
        "Category",
        "Title",
        "Location",
        "ConfNo",
        "Cost",
        "TicketLink",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for draft in rows:
            writer.writerow(
                {
                    "SourceFile": draft.source_file,
                    "Confidence": f"{draft.confidence:.2f}",
                    "Issues": "; ".join(draft.issues),
                    "Date": draft.row["Date"],
                    "TimeSlot": draft.row["TimeSlot"],
                    "Category": draft.row["Category"],
                    "Title": draft.row["Title"],
                    "Location": draft.row["Location"],
                    "ConfNo": draft.row["ConfNo"],
                    "Cost": draft.row["Cost"],
                    "TicketLink": draft.row["TicketLink"],
                }
            )


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract draft itinerary CSV rows from confirmation docs.")
    p.add_argument("--input", required=True, help="Folder containing confirmation documents.")
    p.add_argument("--slug", required=True, help="Output slug, e.g. kim-steph-italy-2026-k7n4.")
    p.add_argument("--year", type=int, default=None, help="Default year when docs only show month/day.")
    p.add_argument("--output-dir", default="trips/drafts", help="Output directory for generated CSVs.")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    in_dir = Path(args.input).expanduser().resolve()
    if not in_dir.exists() or not in_dir.is_dir():
        print(f"Input folder not found: {in_dir}", file=sys.stderr)
        return 2

    docs = list(iter_docs(in_dir))
    if not docs:
        print(f"No supported files found in {in_dir}", file=sys.stderr)
        print(f"Supported extensions: {', '.join(sorted(SUPPORTED_EXTS))}", file=sys.stderr)
        return 2

    drafts: list[DraftRow] = []
    for doc in docs:
        text = read_file_text(doc)
        if not text.strip():
            drafts.append(
                DraftRow(
                    row={h: "" for h in REQUIRED_HEADERS} | {"Type": "Bank", "Category": "Activity", "Title": doc.stem, "Tags": "review|empty-source"},
                    source_file=str(doc),
                    confidence=0.1,
                    issues=["Could not read text from file"],
                )
            )
            continue
        drafts.append(parse_document(doc, text, args.year))

    out_dir = Path(args.output_dir).expanduser().resolve()
    csv_path = out_dir / f"{args.slug}.csv"
    review_path = out_dir / f"{args.slug}-review.csv"

    write_csv(csv_path, drafts)
    write_review_csv(review_path, drafts)

    low_conf = sum(1 for d in drafts if d.confidence < 0.75)
    no_date = sum(1 for d in drafts if not d.row["Date"])
    print(f"Scanned {len(drafts)} document(s)")
    print(f"Draft CSV: {csv_path}")
    print(f"Review CSV: {review_path}")
    print(f"Rows needing extra review: {low_conf} low-confidence, {no_date} with no date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
