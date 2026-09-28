#!/usr/bin/env python3
"""Aggregate TEA PEIMS single-file detail (actual + budget) into a compact table.

Input:  data/raw/peims_detail/{actual,budget}/{district,charter}_*_fy####.(zip|csv)
Output: data/processed/peims_detail_agg.csv  (long format)
        columns: id, fy, kind (actual|budget), measure, amount

Measures (all funds, expenditure objects 6xxx only):
  fn_XX                  total spend in function XX (e.g. fn_51 plant M&O, fn_81 facilities construction)
  f51_staff              Function 51 payroll: 61xx (salaries + benefits)
  f51_contract_repair    Function 51 object 6249 (contracted maintenance & repair)
  f51_contract_other     Function 51 other 62xx, excluding utilities (6259) and 6249
  f51_utilities          Function 51 object 6259 (utilities: electricity, gas, water/wastewater, telephone)
  f51_supplies           Function 51 63xx
  f51_insurance          Function 51 object 6429 (insurance & bonding)
  f51_other_operating    Function 51 other 64xx
  f51_capital            Function 51 66xx (capital outlay charged to plant M&O)
  f51_services_total     Function 51 all 62xx (purchased services incl. utilities). The only services
                         measure available in BUDGET files, which stop at 2-digit object groups.
  util_all               object 6259 across all functions
  capital_all            66xx across all functions
  total_exp              all 6xxx (includes debt service 65xx and capital 66xx)

Usage: python scripts/build_peims_detail.py [--since 2009] [--only-new]
Re-running only processes files not already in the output unless --rebuild is passed.
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "peims_detail"
OUT = ROOT / "data" / "processed" / "peims_detail_agg.csv"

COLMAP = {  # normalize old charter column names to district names
    "CS_NONPROF_FUNC": "FUNCTION", "CS_NONPROF_OBJ": "OBJECT",
    "ACTAMT": "AMOUNT", "BUDGAMT": "AMOUNT",
}


def _open(path: Path):
    if path.suffix == ".zip":
        z = zipfile.ZipFile(path)
        name = next(n for n in z.namelist() if n.lower().endswith((".csv", ".txt")))
        return z.open(name)
    return open(path, "rb")


def read_detail(path: Path) -> pd.DataFrame:
    with _open(path) as fh:
        header = pd.read_csv(fh, nrows=0).columns
    want = {}
    for c in header:
        std = COLMAP.get(c.strip().upper(), c.strip().upper())
        if std in ("DISTRICT", "FUNCTION", "OBJECT", "AMOUNT"):
            want[c] = std
    with _open(path) as fh:
        df = pd.read_csv(fh, usecols=list(want), dtype=str).rename(columns=want)
    df["AMOUNT"] = pd.to_numeric(df["AMOUNT"], errors="coerce").fillna(0)
    df["DISTRICT"] = df["DISTRICT"].str.strip().str.replace("'", "").str.zfill(6)
    df["FUNCTION"] = df["FUNCTION"].str.strip().str.zfill(2)
    df["OBJECT"] = df["OBJECT"].str.strip()
    return df[df["OBJECT"].str.startswith("6")]


def aggregate(df: pd.DataFrame) -> pd.DataFrame:
    parts = []
    fn = df.groupby(["DISTRICT", "FUNCTION"])["AMOUNT"].sum().reset_index()
    fn["measure"] = "fn_" + fn["FUNCTION"]
    parts.append(fn[["DISTRICT", "measure", "AMOUNT"]])

    f51 = df[df["FUNCTION"] == "51"]
    o = f51["OBJECT"]
    groups = {
        "f51_staff": o.str.startswith("61"),
        "f51_contract_repair": o == "6249",
        "f51_utilities": o == "6259",
        "f51_contract_other": o.str.startswith("62") & ~o.isin(["6249", "6259"]),
        "f51_supplies": o.str.startswith("63"),
        "f51_insurance": o == "6429",
        "f51_other_operating": o.str.startswith("64") & (o != "6429"),
        "f51_capital": o.str.startswith("66"),
        # Budget files report objects only at the 2-digit group level (6100, 6200, ...), so utilities,
        # contracted repair and insurance can't be separated in budgets. Use this total for budget comparisons.
        "f51_services_total": o.str.startswith("62"),
    }
    for name, mask in groups.items():
        s = f51[mask].groupby("DISTRICT")["AMOUNT"].sum().reset_index()
        s["measure"] = name
        parts.append(s)
    for name, mask in {
        "util_all": df["OBJECT"] == "6259",
        "capital_all": df["OBJECT"].str.startswith("66"),
        "total_exp": pd.Series(True, index=df.index),
    }.items():
        s = df[mask].groupby("DISTRICT")["AMOUNT"].sum().reset_index()
        s["measure"] = name
        parts.append(s)
    out = pd.concat(parts, ignore_index=True).rename(columns={"DISTRICT": "id", "AMOUNT": "amount"})
    out["amount"] = out["amount"].round(0)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", type=int, default=2009)
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--max-files", type=int, default=0, help="stop after N files (for time-limited shells)")
    args = ap.parse_args()

    # One small cache file per source file, written atomically, so an interrupted run loses nothing.
    cache = OUT.parent / "_peims_detail_cache"
    cache.mkdir(parents=True, exist_ok=True)
    n = 0
    for path in sorted(RAW.glob("*/*_fy*.*")):
        m = re.search(r"(district|charter)_(actual|budget)_fy(\d{4})", path.name)
        if not m or int(m.group(3)) < args.since:
            continue
        target = cache / (path.stem + ".csv")
        if target.exists() and not args.rebuild and target.stat().st_mtime >= path.stat().st_mtime:
            continue
        df = read_detail(path)
        agg = aggregate(df)
        agg["fy"] = int(m.group(3))
        agg["kind"] = m.group(2)
        agg["source"] = path.name
        tmp = target.with_suffix(".tmp")
        agg.to_csv(tmp, index=False)
        tmp.replace(target)
        n += 1
        print(f"{path.name}: {len(df):,} rows -> {len(agg):,}", flush=True)
        if args.max_files and n >= args.max_files:
            print(f"stopped after {n} files; run again to continue")
            return
    parts = [pd.read_csv(f, dtype={"id": str}) for f in sorted(cache.glob("*.csv"))]
    allp = pd.concat(parts, ignore_index=True)
    tmp = OUT.with_suffix(".tmp")
    allp.to_csv(tmp, index=False)
    tmp.replace(OUT)
    print(f"processed {n} new files; combined {len(parts)} sources -> {OUT.relative_to(ROOT)} ({len(allp):,} rows)")


if __name__ == "__main__":
    sys.exit(main())
