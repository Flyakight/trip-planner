# ThereandBack.Club — Itinerary Builder

A mobile-first, print-ready single-page app that turns a CSV of travel
logistics into a beautifully typeset itinerary. Built to ship to clients
of **ThereandBack.Club** — one codebase, many trips, each reachable by
a private URL like `trips.thereandback.club/?id=<trip-slug>`.

## How the routing works

| URL                                     | What it shows                                       |
| --------------------------------------- | --------------------------------------------------- |
| `/`                                     | Branded landing screen (no trip selected)           |
| `/?id=<slug>`                           | Fetches `trips/<slug>.csv` and renders the trip     |
| `/?admin=1`                             | Admin import panel (paste CSV, load demo, edit)     |
| `/?id=<slug>&admin=1`                   | Trip view with admin tools visible                  |

Clients never see the admin panel. The admin query string is the only
way in.

## Adding a new client trip

1. Export or hand-edit a CSV matching the schema (see **CSV schema** below).
2. Save it as `trips/<trip-slug>-<entropy>.csv`. Use an entropy suffix
   (e.g. `kim-steph-italy-2026-k7n4`) so the URL is unguessable.
3. Commit + push. Cloudflare Pages auto-deploys.
4. Send the client: `https://trips.thereandback.club/?id=<trip-slug>-<entropy>`.

## Auto-extract from confirmation docs (drop-folder workflow)

When you have lots of airline/hotel/activity confirmations, you can drop
them in a folder and generate a draft CSV automatically:

```bash
python3 scripts/extract_trip_from_docs.py \
  --input ./confirmations/<client-folder> \
  --slug <trip-slug>-<entropy> \
  --year 2026
```

Supported file types:

```
.pdf, .eml, .txt, .md, .html
```

The script writes:

- `trips/drafts/<slug>.csv` — import-ready draft in this app's schema.
- `trips/drafts/<slug>-review.csv` — confidence + issues per source file.

Recommended flow:

1. Drop all confirmations into one folder.
2. Run the extraction script.
3. Open `*-review.csv` and fix low-confidence rows first.
4. Rename/finalize the draft CSV into `trips/<slug>.csv` when ready.

## Import ideas from a Google My Map (KML)

For the Recommended Activities rail (Bank rows), point a KML export at
the converter:

```bash
# In Google My Maps: ⋮ → Export to KML/KMZ → check "Export as KML"

# Generate a draft CSV of Bank rows:
python3 scripts/kml_to_bank_csv.py \
  --input ./italy-ideas.kml \
  --output trips/drafts/italy-ideas-bank.csv

# Or append directly into a live trip CSV:
python3 scripts/kml_to_bank_csv.py \
  --input ./italy-ideas.kml \
  --output trips/kim-steph-italy-2026-k7n4.csv \
  --append
```

Mapping rules:

- `<Folder>` name → `City` (so organize your map by city for free city tagging).
- `<name>` → `Title`. `<description>` → `Details` (HTML stripped).
- `<Point>` coords → `MapLink` (Google Maps deep link).
- `Category` is inferred from keywords: anything matching ristorante /
  trattoria / osteria / pizzeria / gelateria / caffè / enoteca / etc.
  becomes `Food`; hotel / albergo / b&b / residence becomes `Hotel`;
  everything else is `Activity` (override with `--category-default`).
- `Tags` are inferred conservatively (food / view / reservation / splurge
  / morning / evening). Quick to clean up after.

Use `--dry-run` to preview rows without touching disk, and
`--city-override Rome` for KMLs that don't use folder structure.

After running the converter, clean the drafts before merging:

```bash
# Dedupes by (City, Title), drops orphan pins whose title is just a
# bare street address with no description. Edits files in place.
python3 scripts/clean_bank_csv.py trips/drafts/olicoy-*.csv

# Preview without writing:
python3 scripts/clean_bank_csv.py --dry-run trips/drafts/olicoy-*.csv
```

Recommended flow: run the converter → run the cleaner → spot-check the
draft → append to the live trip CSV (`--append`) and push.

## CSV schema

Required columns:

```
Date, WakeUp, Sleep, Type, Category, TimeSlot, Title, Location,
MapLink, Details, ConfNo, Cost, TicketLink
```

Optional columns (used by the Ideas rail):

```
City, Tags
```

- **Type** — `Fixed` (locked-in booking — appears on the day) or `Bank`
  (suggestion — appears in the Recommended Activities rail).
- **Date** — `YYYY-MM-DD` or `MM/DD/YYYY`. Leave blank for `Bank` rows.
- **TimeSlot** — `HH:MM` (24h) or `h:mm am/pm`. Blank for all-day items.
- **Tags** — pipe-delimited, e.g. `food|reservation|splurge`.
- **MapLink / TicketLink** — full URLs. Render as tappable chips.

A Venice alert fires automatically for any day whose `Sleep` or item
`Location`/`City` mentions Venice. A ZTL alert fires for any day with a
`Driving` category item.

## Local development

No build step. Serve the folder as static files:

```bash
python3 -m http.server 8765
# then open: http://localhost:8765/?id=kim-steph-italy-2026-k7n4
# or:        http://localhost:8765/?admin=1
```

## Stack

- **Alpine.js 3** (CDN) — reactivity (`x-data`, `x-show`, `x-for`).
- **PapaParse** (CDN) — CSV parsing.
- **qrcodejs** (CDN) — print→live QR on the cover page.
- No bundler, no build step. Any static host works.

## Files

```
index.html     — app shell + templates
app.js         — Alpine component: parsing, routing, ideas rail, locks
styles.css     — paper + type system, print stylesheet
trips/         — one CSV per client trip (the only thing that changes
                 when onboarding a new client)
DEPLOY.md      — Cloudflare Pages + Bluehost DNS walkthrough
```

## Print

`Cmd+P` hides admin controls, the ideas rail, the peek bar, and the
sticky day nav — leaving a clean, page-break-per-day PDF with a live
QR on the cover so the paper version still links back to the online
itinerary.
