#!/usr/bin/env python3
"""Download raw source data for the Texas school district finance dashboard.

Every source lands in data/raw/<source>/ untouched (no transformation here).
Each run appends to data/raw/_manifest.json: URL, retrieval time, size and
SHA-256 for every file, so you can tell what changed between pulls.

Usage (from the project root):
    python scripts/fetch_data.py                 # everything scriptable
    python scripts/fetch_data.py --list          # show sources, download nothing
    python scripts/fetch_data.py bonds geo       # only some sources
    python scripts/fetch_data.py --force         # re-download files that already exist
    python scripts/fetch_data.py peims_detail --since 2015   # limit detail years

Snapshot sources (bond elections, debt, geography, ACS, NCES) are re-pulled
every run because the publisher updates them in place. Year-stamped files
(PEIMS, tax rates, property values) are skipped if already on disk.

Sources that can't be scripted are documented in data/MANUAL_DOWNLOADS.md.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
MANIFEST = RAW / "_manifest.json"

HEADERS = {
    # TEA's CDN rejects some default client user agents.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 tx-school-dashboard-fetch",
}

# ---------------------------------------------------------------------------
# Source pages and endpoints. If a publisher moves a page, fix it here.
# ---------------------------------------------------------------------------
TEA_PEIMS_PAGE = "https://tea.texas.gov/finance-and-grants/state-funding/state-funding-reports-and-data/peims-financial-data-downloads"
TEA_PEIMS_SINGLE_PAGE = "https://tea.texas.gov/finance-and-grants/state-funding/state-funding-reports-and-data/peims-single-file-financial-data-downloads"
TEA_TAX_PAGE = "https://tea.texas.gov/about-tea/state-funding/additional-finance-resources/school-district-property-values-and-tax-rates"

SOCRATA = "https://data.texas.gov/resource"
BRB_BOND_ELECTIONS = "kbmc-qmvg"   # Local Debt Bond Election Results (Texas Bond Review Board)
BRB_DEBT_BY_YEAR = "3qmf-seku"     # Debt Outstanding By Issuance Local By Year (Texas Bond Review Board)

ARCGIS_SEARCH = "https://www.arcgis.com/sharing/rest/search"
TEA_ARCGIS_ORG = "5MVN2jsqIrNZD4tP"  # TEA's ArcGIS Online org (services2.arcgis.com/<org>/...)
GEO_LAYERS = {
    # output name -> regex on the ArcGIS item title; newest year wins
    "school_districts": r"^School[ _]+Districts[ _]+(\d{4})$",
    "campuses": r"^Schools[ _]+\d{4}[ _]+to[ _]+(\d{4})$",
    "esc_regions": r"^ESC[ _]*(\d{4})$",
}

CENSUS_API = "https://api.census.gov/data"
ACS_VARIABLES = {
    "B01003_001E": "total_population",
    "B09001_001E": "population_under_18",
    "B19013_001E": "median_household_income",
    "B17001_002E": "population_below_poverty",
    "B25001_001E": "housing_units",
    "B25035_001E": "median_year_structure_built",
    "B25077_001E": "median_home_value",
}
ACS_GEOS = ["school district (unified)", "school district (elementary)", "school district (secondary)"]

URBAN_API = "https://educationdata.urban.org/api/v1"
NCES_ENDPOINTS = {
    # output name -> (path template, filters)
    "ccd_district_directory": ("school-districts/ccd/directory/{year}/", {"fips": 48}),
    "ccd_school_directory": ("schools/ccd/directory/{year}/", {"fips": 48}),
    "ccd_district_finance": ("school-districts/ccd/finance/{year}/", {"fips": 48}),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
session = requests.Session()
session.headers.update(HEADERS)


LOG_FILE = None  # set in main(); every run is also written to data/raw/_fetch_log.txt


def log(msg: str) -> None:
    print(msg, flush=True)
    if LOG_FILE:
        LOG_FILE.write(msg + "\n")
        LOG_FILE.flush()


def get(url: str, *, params=None, stream=False, retries=3, timeout=120) -> requests.Response:
    for attempt in range(1, retries + 1):
        try:
            r = session.get(url, params=params, stream=stream, timeout=timeout)
            if r.status_code >= 500 and attempt < retries:
                raise requests.HTTPError(f"{r.status_code}")
            r.raise_for_status()
            return r
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as e:
            if attempt == retries or (isinstance(e, requests.HTTPError) and getattr(e.response, "status_code", 500) < 500):
                raise
            time.sleep(2 * attempt)
    raise RuntimeError("unreachable")


def sniff_ext(head: bytes, fallback: str) -> str:
    """Pick an extension from the first bytes of a file; TEA links often hide the real type."""
    if head.startswith(b"%PDF"):
        return ".pdf"
    if head.startswith(b"\xd0\xcf\x11\xe0"):
        return ".xls"
    if head.startswith(b"PK\x03\x04") and len(head) > 30:
        # First local file header: name length at bytes 26-27, name starts at 30.
        n = int.from_bytes(head[26:28], "little")
        first_name = head[30:30 + n].decode("latin-1")
        if first_name.startswith(("[Content_Types].xml", "xl/", "docProps/", "_rels/")):
            return ".xlsx"
        return ".zip"
    if head[:200].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        return ".html"
    first_line = head.split(b"\n", 1)[0]
    if b"," in first_line and all(32 <= c < 127 or c in (9, 13) for c in first_line):
        return ".csv"  # plain CSV served from an extension-less link
    return fallback


class Manifest:
    def __init__(self, path: Path):
        self.path = path
        self.data = json.loads(path.read_text()) if path.exists() else {"files": {}}

    def record(self, file: Path, url: str, **extra):
        sha = hashlib.sha256(file.read_bytes()).hexdigest()
        rel = file.relative_to(RAW).as_posix()
        prev = self.data["files"].get(rel)
        self.data["files"][rel] = {
            "url": url,
            "retrieved": dt.datetime.now().isoformat(timespec="seconds"),
            "bytes": file.stat().st_size,
            "sha256": sha,
            "changed_since_last_pull": None if prev is None else prev.get("sha256") != sha,
            **extra,
        }

    def save(self):
        self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))


def download(url: str, dest_stem: Path, manifest: Manifest, *, force=False, ext=".bin", **extra) -> Path | None:
    """Download url to dest_stem + detected extension. Skips if already present."""
    existing = [p for p in dest_stem.parent.glob(dest_stem.name + ".*") if p.suffix not in (".part",)]
    if existing and not force:
        log(f"  skip  {existing[0].relative_to(ROOT)} (exists; --force to refresh)")
        return existing[0]
    dest_stem.parent.mkdir(parents=True, exist_ok=True)
    r = get(url, stream=True)
    chunks = r.iter_content(1 << 16)
    first = next(chunks, b"")
    url_ext = Path(urlparse(url).path).suffix.lower()
    if url_ext in (".csv", ".zip", ".xlsx", ".xls", ".pdf", ".txt"):
        ext = url_ext  # trust the URL's extension unless the bytes say otherwise
    real_ext = sniff_ext(first, ext)
    if real_ext == ".html":
        log(f"  WARN  {url} returned a web page, not a file (moved or removed?); skipping")
        return None
    dest = Path(str(dest_stem) + real_ext)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with open(tmp, "wb") as f:
        f.write(first)
        for c in chunks:
            f.write(c)
    for p in existing:
        if p != dest:
            p.unlink()
    tmp.replace(dest)
    manifest.record(dest, url, **extra)
    log(f"  saved {dest.relative_to(ROOT)} ({dest.stat().st_size / 1e6:.1f} MB)")
    return dest


def write_text(dest: Path, text: str, url: str, manifest: Manifest, **extra) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(text, encoding="utf-8")
    manifest.record(dest, url, **extra)
    log(f"  saved {dest.relative_to(ROOT)} ({dest.stat().st_size / 1e6:.1f} MB)")
    return dest


def page_links(url: str) -> list[dict]:
    """Every <a href> on a page, with its own text and the text of its row/list item/paragraph."""
    soup = BeautifulSoup(get(url).text, "html.parser")
    out = []
    for a in soup.find_all("a", href=True):
        # Prefer the table row / list item so a bare "Excel" link still carries its label.
        block = a.find_parent("tr") or a.find_parent("li") or a.find_parent("p")
        out.append({
            "href": urljoin(url, a["href"].strip()),
            "text": " ".join(a.get_text(" ").split()),
            "context": " ".join((block.get_text(" ") if block else "").split()),
        })
    return out


def norm_dash(s: str) -> str:
    """Normalize hyphen look-alikes (non-breaking hyphen, en/em dash, minus) and odd spaces."""
    s = re.sub("[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]", "-", s)
    return re.sub("[\u00a0\u2000-\u200b\u202f]", " ", s)


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------
def fetch_peims_summary(args, m: Manifest):
    """TEA summarized PEIMS actual financial data (one xlsx, all districts, all years)."""
    links = [l for l in page_links(TEA_PEIMS_PAGE) if re.search(r"Summarized PEIMS Actual Financial Data", l["text"], re.I)]
    if not links:
        raise RuntimeError("Could not find the 'Summarized PEIMS Actual Financial Data' link on the TEA page")
    link = links[0]
    years = re.search(r"(\d{4})\s*-\s*(\d{4})", norm_dash(link["text"]))
    stem = f"peims_summarized_{years.group(1)}-{years.group(2)}" if years else "peims_summarized"
    download(link["href"], RAW / "peims_summary" / stem, m, force=args.force, ext=".xlsx", label=link["text"])

    dd = [l for l in page_links(TEA_PEIMS_PAGE) if re.search(r"Data Dictionary", l["text"], re.I)]
    if dd:
        download(dd[0]["href"], RAW / "peims_summary" / "data_dictionary", m, force=args.force, ext=".pdf", label=dd[0]["text"])


def fetch_peims_detail(args, m: Manifest):
    """TEA single-file PEIMS budget and actual data (fund/function/object detail), district + charter, every year."""
    pat = re.compile(r"(District|Charter)\s+(\d{4})\s*-\s*(\d{4})\s+Financial\s+(Budget|Actual)\s+Data", re.I)
    found = 0
    links = page_links(TEA_PEIMS_SINGLE_PAGE)
    for l in links:
        mt = pat.search(norm_dash(l["text"]))  # anchor text only: rows hold budget + actual links side by side
        if not mt:
            if re.search(r"Financial\s+(Budget|Actual)", l["text"], re.I):
                log(f"  WARN  unrecognized link text, skipped: {l['text']!r}")
            continue
        kind, _y0, y1, which = mt.group(1).lower(), mt.group(2), int(mt.group(3)), mt.group(4).lower()
        if args.since and y1 < args.since:
            continue
        found += 1
        stem = RAW / "peims_detail" / which / f"{kind}_{which}_fy{y1}"
        try:
            download(l["href"], stem, m, force=args.force, ext=".zip", label=l["text"], fiscal_year=y1)
        except requests.HTTPError as e:
            log(f"  WARN  {l['text']}: {e}")
    dd = [l for l in links if re.search(r"data dictionary", l["text"] + l["context"], re.I) and l["href"].lower().endswith(".pdf")]
    if dd:
        download(dd[0]["href"], RAW / "peims_detail" / "data_dictionary", m, force=args.force, ext=".pdf")
    if not found:
        raise RuntimeError("No PEIMS single-file links matched; the TEA page layout may have changed")


def fetch_tax_and_values(args, m: Manifest):
    """Adopted M&O/I&S tax rates (all years in one file) and Comptroller property values (one file per tax year)."""
    links = page_links(TEA_TAX_PAGE)

    def is_excel(l):
        return re.search(r"\.xlsx?($|\?)", l["href"], re.I) or re.search(r"excel|xls", l["text"], re.I)

    def not_pdf(l):
        return not re.search(r"\.pdf($|\?)", l["href"], re.I) and not re.search(r"\bpdf\b", l["text"], re.I)

    # Tax rates: pick the Excel link in the block that mentions adopted tax rates.
    rates = [l for l in links if re.search(r"adopted .*tax rates", l["context"] + " " + l["text"], re.I) and is_excel(l)]
    if rates:
        yrs = re.search(r"(\d{4})\s*-\s*(\d{4})", norm_dash(rates[0]["context"] + " " + rates[0]["text"]))
        stem = f"adopted_tax_rates_{yrs.group(1)}-{yrs.group(2)}" if yrs else "adopted_tax_rates"
        download(rates[0]["href"], RAW / "tax_rates" / stem, m, force=args.force, ext=".xlsx")
    else:
        log("  WARN  adopted tax rate link not found")

    # Property values: 'PTAD Tax Final: Tax Year 2024' / 'PTAD Tax Preliminary: Tax Year 2025'
    pat = re.compile(r"Tax\s+(Final|Preliminary)\s*:?\s*Tax Year\s+(\d{4})", re.I)
    seen = set()
    for l in links:
        mt = pat.search(l["text"]) or pat.search(l["context"])
        if not mt or not not_pdf(l):
            continue
        # Old rows link through linkit.aspx with no extension; the first non-PDF link in a row is Excel.
        key = (mt.group(1).lower(), mt.group(2))
        if key in seen:
            continue
        seen.add(key)
        stem = RAW / "property_values" / f"cptd_{key[1]}_{key[0]}"
        try:
            download(l["href"], stem, m, force=args.force, ext=".xlsx", tax_year=int(key[1]), status=key[0])
        except requests.HTTPError as e:
            log(f"  WARN  tax year {key[1]} {key[0]} property values: {e} (dead link on TEA's page; see MANUAL_DOWNLOADS.md)")
    if not seen:
        log("  WARN  no property value links matched")


def socrata_csv(dataset: str, where: str | None, dest: Path, m: Manifest, label: str):
    params = {"$limit": 5_000_000}
    if where:
        params["$where"] = where
    url = f"{SOCRATA}/{dataset}.csv"
    r = get(url, params=params, timeout=600)
    write_text(dest, r.text, r.url, m, dataset=dataset, label=label)


def fetch_bonds(args, m: Manifest):
    """Texas Bond Review Board: bond election results (pass/fail, amount, votes) and debt outstanding, ISDs only."""
    socrata_csv(BRB_BOND_ELECTIONS, "GovernmentType='ISD'", RAW / "bonds" / "bond_elections_isd.csv", m,
                "Local Debt Bond Election Results (Texas Bond Review Board)")
    socrata_csv(BRB_DEBT_BY_YEAR, "GovernmentType='ISD'", RAW / "bonds" / "debt_outstanding_by_issuance_isd.csv", m,
                "Debt Outstanding By Issuance Local By Year (Texas Bond Review Board)")


def arcgis_items(title_regex: str) -> list[tuple[int, dict]]:
    q = f'orgid:{TEA_ARCGIS_ORG} AND type:"Feature Service"'
    items, start = [], 1
    while start > 0:
        js = get(ARCGIS_SEARCH, params={"q": q, "num": 100, "start": start, "f": "json"}).json()
        items += js.get("results", [])
        start = js.get("nextStart", -1)
    out = []
    for it in items:
        mt = re.match(title_regex, it.get("title", "").strip(), re.I)
        if mt and it.get("access") == "public":
            out.append((int(mt.group(1)), it))
    return sorted(out, key=lambda t: (t[0], t[1].get("modified", 0)), reverse=True)


def arcgis_geojson(service_url: str) -> dict:
    layer = f"{service_url.rstrip('/')}/0"
    meta = get(layer, params={"f": "json"}).json()
    page = min(int(meta.get("maxRecordCount") or 1000), 2000)
    feats, offset = [], 0
    while True:
        js = get(f"{layer}/query", params={
            "where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson",
            "resultOffset": offset, "resultRecordCount": page, "geometryPrecision": 6,
        }, timeout=300).json()
        if "error" in js:
            raise RuntimeError(js["error"])
        batch = js.get("features", [])
        feats += batch
        if len(batch) < page and not js.get("properties", {}).get("exceededTransferLimit"):
            break
        offset += len(batch)
        if not batch:
            break
    return {"type": "FeatureCollection", "name": meta.get("name"), "features": feats}


def fetch_geo(args, m: Manifest):
    """TEA School District Locator layers: district boundaries, campus points, ESC regions (newest year)."""
    for name, rx in GEO_LAYERS.items():
        matches = arcgis_items(rx)
        if not matches:
            log(f"  WARN  no ArcGIS item matched {rx}")
            continue
        year, item = matches[0]
        log(f"  {name}: '{item['title']}' ({item['url']})")
        gj = arcgis_geojson(item["url"])
        write_text(RAW / "geo" / f"{name}_{year}.geojson", json.dumps(gj), item["url"], m,
                   arcgis_item=item["id"], title=item["title"], features=len(gj["features"]))


def fetch_acs(args, m: Manifest):
    """Census ACS 5-year estimates by school district geography. Needs a free key in CENSUS_API_KEY."""
    key = os.environ.get("CENSUS_API_KEY")
    if not key:
        log("  SKIP  set CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html) — see data/MANUAL_DOWNLOADS.md")
        return
    this_year = dt.date.today().year
    for year in range(this_year - 1, this_year - 5, -1):
        probe = session.get(f"{CENSUS_API}/{year}/acs/acs5", params={"get": "NAME", "for": "state:48", "key": key}, timeout=60)
        if probe.ok:
            break
    else:
        raise RuntimeError("No ACS 5-year vintage found in the last 4 years")
    log(f"  ACS 5-year vintage {year}")
    fields = ["NAME", *ACS_VARIABLES]
    for geo in ACS_GEOS:
        r = session.get(f"{CENSUS_API}/{year}/acs/acs5",
                        params={"get": ",".join(fields), "for": f"{geo}:*", "in": "state:48", "key": key}, timeout=120)
        if r.status_code == 204 or not r.ok or not r.text.strip().startswith("["):
            log(f"  none  {geo} ({r.status_code})")  # Texas has few/no elementary or secondary districts
            continue
        rows = r.json()
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow([ACS_VARIABLES.get(h, h) for h in rows[0]])
        w.writerows(rows[1:])
        slug = geo.split("(")[1].rstrip(")")
        write_text(RAW / "census_acs" / f"acs5_{year}_{slug}.csv", buf.getvalue(),
                   r.url.replace(key, "KEY"), m, vintage=year, variables=ACS_VARIABLES)


def fetch_nces(args, m: Manifest):
    """NCES Common Core of Data via the Urban Institute Education Data API (newest year available)."""
    this_year = dt.date.today().year
    for name, (path, filters) in NCES_ENDPOINTS.items():
        for year in range(this_year, this_year - 10, -1):
            url = f"{URBAN_API}/{path.format(year=year)}"
            r = session.get(url, params=filters, timeout=120)
            try:
                if r.ok and r.json().get("count"):
                    break
            except ValueError:
                pass
        else:
            log(f"  WARN  no data found for {name}")
            continue
        results, js = [], r.json()
        while True:
            results += js["results"]
            if not js.get("next"):
                break
            js = get(js["next"]).json()
        buf = io.StringIO()
        keys = sorted({k for row in results for k in row})
        w = csv.DictWriter(buf, fieldnames=keys)
        w.writeheader()
        w.writerows(results)
        write_text(RAW / "nces" / f"{name}_{year}.csv", buf.getvalue(), r.url, m, year=year, rows=len(results))


SOURCES = {
    "peims_summary": (fetch_peims_summary, "TEA summarized PEIMS actuals (xlsx, all years)"),
    "peims_detail": (fetch_peims_detail, "TEA single-file PEIMS budget + actual detail, district + charter (~1 GB total)"),
    "tax_values": (fetch_tax_and_values, "TEA/Comptroller adopted tax rates + property values by tax year"),
    "bonds": (fetch_bonds, "Bond Review Board: ISD bond elections + debt outstanding (data.texas.gov)"),
    "geo": (fetch_geo, "TEA district boundaries, campus locations, ESC regions (ArcGIS, GeoJSON)"),
    "acs": (fetch_acs, "Census ACS 5-year by school district (needs CENSUS_API_KEY)"),
    "nces": (fetch_nces, "NCES Common Core of Data: district/school directory + district finance"),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="*", help=f"subset of sources (default: all): {', '.join(SOURCES)}")
    ap.add_argument("--force", action="store_true", help="re-download year-stamped files that already exist")
    ap.add_argument("--since", type=int, default=None, help="peims_detail: only fiscal years >= this (e.g. 2015)")
    ap.add_argument("--list", action="store_true", help="list sources and exit")
    args = ap.parse_args()

    unknown = [s for s in args.sources if s not in SOURCES]
    if unknown:
        ap.error(f"unknown source(s): {', '.join(unknown)}. Choose from: {', '.join(SOURCES)}")

    if args.list:
        for k, (_, desc) in SOURCES.items():
            print(f"{k:14s} {desc}")
        return

    RAW.mkdir(parents=True, exist_ok=True)
    global LOG_FILE
    LOG_FILE = open(RAW / "_fetch_log.txt", "a", encoding="utf-8")
    log(f"\n##### run {dt.datetime.now().isoformat(timespec='seconds')}  sources={args.sources or 'all'}")
    m = Manifest(MANIFEST)
    failures = []
    for name in args.sources or SOURCES:
        fn, desc = SOURCES[name]
        log(f"\n== {name}: {desc}")
        try:
            fn(args, m)
        except Exception as e:  # keep going; report at the end
            failures.append((name, e))
            log(f"  FAIL  {type(e).__name__}: {e}")
        finally:
            m.save()

    log("\nDone." if not failures else "\nFinished with failures:")
    for name, e in failures:
        log(f"  {name}: {e}")
    log("Manual sources: see data/MANUAL_DOWNLOADS.md")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
