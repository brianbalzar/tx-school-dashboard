"""Data loader: TEA summarized PEIMS actual financial data -> tidy district-year CSV.

Reads the newest `*summarized*.xlsx` in data/raw/peims_summary/ and joins district
geography from data/raw/reference/district_information.csv. Writes CSV to stdout
(Observable Framework caches it as /data/districts.csv at build time).

All dollar figures are ALL FUNDS actuals. Per-student math happens in the page.
"""

import re
import sys
from pathlib import Path

import pandas as pd

RAW = Path("data/raw")
SUMMARY_DIR = RAW / "peims_summary"

# output column -> regex matched against the "ALL FUNDS-..." header.
# Regexes (not exact names) so minor TEA header edits between releases don't break the build.
METRICS = {
    "revenue": r"TOTAL OPERATING REVENUE AND OTHER REVENUE AND RECAPTUR",
    "total_expense": r"TOTAL DISBURSEMENTS",
    "operating_expense": r"TOTAL OPERATING EXPENDITURES BY OBJ",
    "payroll": r"TOTAL PAYROLL EXPENDITURES",
    "plant_maintenance": r"PLANT MAINTENANCE.*FCT51",
    "security": r"SECURITY.*FCT52",
    "data_processing": r"DATA PROCESSING.*FCT53",
    "transport": r"TRANSPORTATION.*FCT34",
    "food_service": r"FOOD SERVICE.*FCT35",
    "capital_outlay": r"TOTAL CAPITAL PROJECTS EXPEND BY OBJ",
    "debt_service": r"TOTAL DEBT SERVICE EXPEND BY OBJ",
}


def pick_source() -> Path:
    files = sorted(SUMMARY_DIR.glob("*summarized*.xlsx"))  # year range in the name sorts oldest -> newest
    if not files:
        sys.exit("No *summarized*.xlsx in data/raw/peims_summary/ — run: python scripts/fetch_data.py peims_summary")
    return files[-1]


def find_col(columns, pattern):
    hits = [c for c in columns if c.upper().startswith("ALL FUNDS") and re.search(pattern, c, re.I)]
    if len(hits) != 1:
        sys.exit(f"Expected 1 column for /{pattern}/, found {hits}")
    return hits[0]


def fiscal_year(value) -> int:
    """'2022' -> 2022; '2024-2025' or '2425' -> 2025 (year the school year ends)."""
    s = str(value).strip()
    years = [int(n) for n in re.findall(r"\d{4}", s) if 1990 <= int(n) <= 2100]
    if years:
        return years[-1]
    if re.fullmatch(r"\d{4}", s):  # compact form like "2425"
        return 2000 + int(s[2:])
    raise ValueError(f"Unrecognized year: {value!r}")


def main():
    src = pick_source()
    df = pd.read_excel(src, dtype=str)
    df.columns = [c.strip() for c in df.columns]

    id_col = next(c for c in df.columns if re.search(r"DISTRICT\s*(NUMBER|ID)", c, re.I))
    name_col = next(c for c in df.columns if re.search(r"DISTRICT\s*NAME", c, re.I))
    year_col = next(c for c in df.columns if re.fullmatch(r"(FISCAL\s*)?YEAR", c, re.I))
    enr_col = next(c for c in df.columns if re.search(r"ENROLLMENT", c, re.I))

    out = pd.DataFrame({
        "id": df[id_col].str.replace(r"\D", "", regex=True).str.zfill(6),
        "name": df[name_col].str.strip(),
        "year": df[year_col].map(fiscal_year),
        "enrollment": pd.to_numeric(df[enr_col], errors="coerce"),
    })
    for key, pattern in METRICS.items():
        out[key] = pd.to_numeric(df[find_col(df.columns, pattern)], errors="coerce").round(0)

    geo = pd.read_csv(RAW / "reference" / "district_information.csv", dtype=str)
    geo["id"] = geo["district_number"].str.zfill(6)
    geo = geo[["id", "county", "region", "city"]].drop_duplicates("id")
    out = out.merge(geo, on="id", how="left")
    out["region"] = pd.to_numeric(out["region"], errors="coerce").astype("Int64")

    out = out[out["enrollment"] > 0].sort_values(["id", "year"])
    out.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    main()
