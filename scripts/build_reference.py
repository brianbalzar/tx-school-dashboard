#!/usr/bin/env python3
"""Build processed reference tables from data/raw (everything except PEIMS detail).

Outputs in data/processed/:
  districts.csv         one row per district/charter: name, county, region, type, locale,
                        campus counts, coordinates, superintendent, 2026 A-F rating
  enrollment.csv        id, fy, enrollment (PEIMS fall survey, from the summarized file)
  tax_rates.csv         id, fy, mo_rate, is_rate            (fy = school year end)
  property_values.csv   id, tax_year, fy, value_mo (T2), value_is (T8)
  bonds.csv             one row per bond proposition, with TEA id where matched
  debt.csv              one row per debt issue per fiscal year, with TEA id
  campuses.csv          one row per campus (no geocoder noise)
  general_fund.csv      id, fy, general-fund operating revenue and operating expenditures
  tips.csv              TIPS cooperative membership: member since, contacts

Run: python scripts/build_reference.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

LOCALE = {11: "Urban", 12: "Urban", 13: "Urban", 21: "Suburban", 22: "Suburban", 23: "Suburban",
          31: "Town", 32: "Town", 33: "Town", 41: "Rural", 42: "Rural", 43: "Rural"}
LOCALE_DETAIL = {11: "City: large", 12: "City: midsize", 13: "City: small", 21: "Suburb: large",
                 22: "Suburb: midsize", 23: "Suburb: small", 31: "Town: fringe", 32: "Town: distant",
                 33: "Town: remote", 41: "Rural: fringe", 42: "Rural: distant", 43: "Rural: remote"}


def clean_id(s: pd.Series) -> pd.Series:
    return s.astype(str).str.replace(r"[^0-9]", "", regex=True).str.zfill(6)


def norm_name(s: str) -> str:
    s = str(s).upper().replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = re.sub(r"\bCONSOLIDATED INDEPENDENT SCHOOL DISTRICT\b", "CISD", s)
    s = re.sub(r"\bINDEPENDENT SCHOOL DISTRICT\b", "ISD", s)
    s = re.sub(r"\bCO\b", "COUNTY", s)
    s = re.sub(r"\b(C?ISD)[AB]\b", r"\1", s)  # BRB disambiguators: "Wylie ISDA", "Wylie ISDB"
    return re.sub(r"\s+", " ", s).strip()


def latest(pattern: str) -> Path:
    files = sorted(RAW.glob(pattern))
    if not files:
        raise FileNotFoundError(pattern)
    return files[-1]


# ---------------------------------------------------------------------------
def build_campuses() -> pd.DataFrame:
    path = latest("geo/campuses_*.geojson")
    feats = json.loads(path.read_text())["features"]
    rows = []
    for f in feats:
        p = f["properties"]
        g = f.get("geometry") or {}
        lon, lat = (g.get("coordinates") or [None, None])[:2]
        rows.append({
            "campus_id": str(p.get("USER_School_Number", "")).replace("'", "").zfill(9),
            "id": str(p.get("USER_District_Number", "")).replace("'", "").zfill(6),
            "campus_name": p.get("USER_School_Name"),
            "school_type": p.get("School_Type"),
            "grade_range": str(p.get("USER_Grade_Range") or "").replace("'", ""),
            "instruction_type": p.get("USER_Instruction_Type"),
            "enrollment": p.get("USER_School_Enrollment_as_of_Oc"),
            "principal": (p.get("USER_School_Principal") or "").strip() or None,
            "address": p.get("USER_School_Site_Street_Address"),
            "city": p.get("USER_School_Site_City"),
            "zip": p.get("USER_School_Site_Zip"),
            "lat": lat, "lon": lon,
            # district-level fields, pulled off below
            "_district_name": p.get("USER_District_Name"),
            "_county": p.get("USER_County_Name"),
            "_region": p.get("USER_ESC_Region_Served"),
            "_type": p.get("USER_District_Type"),
            "_nces": str(p.get("USER_NCES_District_ID") or "").replace("'", ""),
            "_supt": (p.get("USER_District_Superintendent") or "").strip() or None,
            "_web": p.get("USER_District_Web_Page_Address"),
            "_phone": p.get("USER_District_Phone"),
            "_district_enrollment": p.get("USER_District_Enrollment_as_of_"),
        })
    df = pd.DataFrame(rows)
    df.attrs["source"] = path.name
    return df


def build_districts(campuses: pd.DataFrame) -> pd.DataFrame:
    d = (campuses.sort_values("campus_id")
         .groupby("id")
         .agg(name=("_district_name", "first"), county=("_county", "first"), region=("_region", "first"),
              type=("_type", "first"), nces_id=("_nces", "first"), superintendent=("_supt", "first"),
              website=("_web", "first"), phone=("_phone", "first"),
              enrollment_oct=("_district_enrollment", "first"),
              campuses=("campus_id", "count"),
              lat=("lat", "median"), lon=("lon", "median"))
         .reset_index())
    d["region"] = pd.to_numeric(d["region"].astype(str).str.extract(r"(\d+)")[0], errors="coerce").astype("Int64")
    types = campuses.pivot_table(index="id", columns="school_type", values="campus_id", aggfunc="count", fill_value=0)
    types.columns = ["campuses_" + re.sub(r"[^a-z]+", "_", str(c).lower()).strip("_") for c in types.columns]
    d = d.merge(types.reset_index(), on="id", how="left")
    d["charter"] = d["type"].str.upper().eq("CHARTER")
    d["superintendent_as_of"] = campuses.attrs.get("source")

    nces = pd.read_csv(latest("nces/ccd_district_directory_*.csv"), dtype={"state_leaid": str})
    nces["id"] = nces["state_leaid"].str.replace("TX-", "", regex=False).str.zfill(6)
    nces["locale"] = nces["urban_centric_locale"].map(LOCALE)
    nces["locale_detail"] = nces["urban_centric_locale"].map(LOCALE_DETAIL)
    d = d.merge(nces[["id", "locale", "locale_detail", "number_of_schools", "staff_total_fte", "teachers_total_fte"]],
                on="id", how="left")

    acct_files = sorted(RAW.glob("accountability/*district_accountability_summary*.csv"))
    if acct_files:
        a = pd.read_csv(acct_files[-1], dtype=str)
        a = a[a.iloc[:, 0].str.match(r"^\d")]  # drop the variable-code header row if present
        year = re.search(r"(\d{4})", acct_files[-1].name).group(1)
        a = a.rename(columns={"District #": "id", f"{year} Overall Rating": "rating"})
        a["id"] = clean_id(a["id"])
        a["rating_year"] = int(year)
        d = d.merge(a[["id", "rating", "rating_year"]], on="id", how="left")
    return d


def build_enrollment() -> pd.DataFrame:
    path = latest("peims_summary/*summarized*.xlsx")
    df = pd.read_excel(path, dtype=str, usecols=lambda c: re.search(r"DISTRICT NUMBER|^YEAR$|ENROLLMENT", c, re.I) is not None)
    df.columns = ["id", "fy", "enrollment"]
    df["id"] = clean_id(df["id"])
    df["fy"] = df["fy"].str.extract(r"(\d{4})$")[0].astype(int)
    df["enrollment"] = pd.to_numeric(df["enrollment"], errors="coerce")
    return df.dropna()


def build_tax_rates() -> pd.DataFrame:
    df = pd.read_excel(latest("tax_rates/*.xlsx"), dtype=str)
    df = df.rename(columns={df.columns[0]: "id"})
    df["id"] = clean_id(df["id"])
    long = df.melt(id_vars="id", value_vars=[c for c in df.columns if "Tax Rate" in c], var_name="col", value_name="rate")
    long["fy"] = long["col"].str.extract(r"\d{4}\s*-\s*(\d{4})")[0].astype(int)
    long["kind"] = long["col"].str.contains("M&O").map({True: "mo_rate", False: "is_rate"})
    long["rate"] = pd.to_numeric(long["rate"], errors="coerce")
    return long.pivot_table(index=["id", "fy"], columns="kind", values="rate").reset_index()


def build_property_values() -> pd.DataFrame:
    out = []
    for path in sorted(RAW.glob("property_values/cptd_*")):
        m = re.search(r"cptd_(\d{4})_(final|preliminary)", path.name)
        if not m:
            continue
        raw = pd.read_excel(path, header=None, dtype=str)
        head = raw.head(4).fillna("").astype(str)
        def col_for(prefix):
            for c in raw.columns:
                if any(v.strip().upper().startswith(prefix) for v in head[c]):
                    return c
            return None
        c2, c8 = col_for("T2"), col_for("T8")
        rows = raw[raw[0].astype(str).str.fullmatch(r"'?\d{5,6}")]
        df = pd.DataFrame({
            "id": clean_id(rows[0]),
            "tax_year": int(m.group(1)),
            "status": m.group(2),
            "value_mo": pd.to_numeric(rows[c2], errors="coerce"),
            "value_is": pd.to_numeric(rows[c8], errors="coerce") if c8 is not None else pd.NA,
        })
        out.append(df)
    pv = pd.concat(out, ignore_index=True)
    pv["fy"] = pv["tax_year"] + 1  # tax year 2024 funds school year 2024-25 = FY2025
    return pv


def build_debt_and_bonds(districts: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    debt = pd.read_csv(RAW / "bonds" / "debt_outstanding_by_issuance_isd.csv", low_memory=False)
    debt["id"] = debt["govid"].astype(str).str.extract(r"^(\d{3})-(\d{3})").agg("".join, axis=1)
    debt = debt.rename(columns={"fiscalyear": "fy"})

    bonds = pd.read_csv(RAW / "bonds" / "bond_elections_isd.csv")
    bonds["key"] = bonds["governmentname"].map(norm_name)
    bonds["cty"] = bonds["county"].str.upper().str.strip()

    # 1) exact BRB name + county from the debt file (same naming conventions, carries the TEA id)
    dk = debt.assign(key=debt["governmentname"].map(norm_name), cty=debt["county"].str.upper().str.strip())
    by_brb = dk.drop_duplicates(["key", "cty"])[["key", "cty", "id"]]
    bonds = bonds.merge(by_brb, on=["key", "cty"], how="left")
    # 2) TEA district name + county
    dist = districts.assign(key=districts["name"].map(norm_name), cty=districts["county"].str.upper().str.strip())
    by_tea = dist.drop_duplicates(["key", "cty"])[["key", "cty", "id"]].rename(columns={"id": "id2"})
    bonds = bonds.merge(by_tea, on=["key", "cty"], how="left")
    # 3) TEA name alone, only when unique statewide
    uniq = dist.drop_duplicates("key", keep=False)[["key", "id"]].rename(columns={"id": "id3"})
    bonds = bonds.merge(uniq, on="key", how="left")
    bonds["id"] = bonds["id"].fillna(bonds["id2"]).fillna(bonds["id3"])
    bonds["match"] = pd.Series("brb", index=bonds.index).where(bonds["id"].notna(), "unmatched")
    bonds = bonds.drop(columns=["key", "cty", "id2", "id3"])
    bonds["electiondate"] = pd.to_datetime(bonds["electiondate"]).dt.date
    return debt, bonds


def build_general_fund() -> pd.DataFrame:
    """General-fund operating revenue and operating expenditures (excludes bond-funded construction and debt service)."""
    path = latest("peims_summary/*summarized*.xlsx")
    want = {"DISTRICT NUMBER": "id", "YEAR": "fy", "GEN FUNDS-TOTAL OPERATING REVENUE": "gf_revenue",
            "GEN FUNDS-TOTAL OPERATING EXPENDITURES BY OBJ": "gf_opex"}
    df = pd.read_excel(path, dtype=str, usecols=lambda c: c.strip() in want)
    df = df.rename(columns=lambda c: want[c.strip()])
    df["id"] = clean_id(df["id"])
    df["fy"] = df["fy"].str.extract(r"(\d{4})$")[0].astype(int)
    for c in ("gf_revenue", "gf_opex"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def build_tips(districts: pd.DataFrame) -> pd.DataFrame:
    """TIPS (The Interlocal Purchasing System) membership, matched to TEA ids by member id, then by unique name."""
    files = sorted(RAW.glob("reference/tips_members_*.xlsx"))
    if not files:
        return pd.DataFrame(columns=["id"])
    t = pd.read_excel(files[-1], dtype=str).fillna("")
    t = t[t["State"].str.upper().isin(["TX", ""])]
    ids = set(districts["id"])
    t["mid"] = t["MemberID"].str.strip().str.replace(r"\D", "", regex=True).str.zfill(6)
    by_name = districts.assign(k=districts["name"].map(norm_name)).drop_duplicates("k", keep=False).set_index("k")["id"]
    fix = t["Member"].str.replace(r"\s*\(.*\)$", "", regex=True)  # "Big Sandy ISD (LivingstonTX)" -> "Big Sandy ISD"
    t["id"] = t["mid"].where(t["mid"].isin(ids) & t["MemberID"].str.strip().str.fullmatch(r"\d{6}"))
    t["id"] = t["id"].fillna(fix.map(norm_name).map(by_name))
    t = t[t["id"].notna()]
    t["since"] = pd.to_datetime(t["Membership Date"], errors="coerce")
    rows = []
    for i, g in t.groupby("id"):
        contacts = [{"name": r.Contact.strip(), "title": r["Contact Title"].strip(), "phone": r.Phone.strip(),
                     "type": "Primary" if r["Contact Type"] == "P" else "Alternate"}
                    for _, r in g.iterrows() if r.Contact.strip()]
        contacts.sort(key=lambda c: (c["type"] != "Primary", c["name"]))
        rows.append({"id": i, "tips_since": g["since"].min().date().isoformat() if g["since"].notna().any() else None,
                     "tips_region": g["Region"].iloc[0], "tips_contacts": json.dumps(contacts[:8]), "tips_source": files[-1].name})
    return pd.DataFrame(rows)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    campuses = build_campuses()
    districts = build_districts(campuses)
    campuses.drop(columns=[c for c in campuses.columns if c.startswith("_")]).to_csv(OUT / "campuses.csv", index=False)
    districts.to_csv(OUT / "districts.csv", index=False)
    print(f"districts: {len(districts):,}  campuses: {len(campuses):,}  "
          f"locale matched: {districts['locale'].notna().sum():,}  rated: {districts.get('rating', pd.Series()).notna().sum():,}")

    enr = build_enrollment(); enr.to_csv(OUT / "enrollment.csv", index=False)
    print(f"enrollment rows: {len(enr):,}  years {enr.fy.min()}-{enr.fy.max()}")

    tr = build_tax_rates(); tr.to_csv(OUT / "tax_rates.csv", index=False)
    print(f"tax rates rows: {len(tr):,}  years {tr.fy.min()}-{tr.fy.max()}")

    pv = build_property_values(); pv.to_csv(OUT / "property_values.csv", index=False)
    print(f"property values rows: {len(pv):,}  tax years {pv.tax_year.min()}-{pv.tax_year.max()}  "
          f"missing T2: {pv.value_mo.isna().sum()}")

    gf = build_general_fund(); gf.to_csv(OUT / "general_fund.csv", index=False)
    print(f"general fund rows: {len(gf):,}")
    tips = build_tips(districts); tips.to_csv(OUT / "tips.csv", index=False)
    print(f"TIPS members matched to districts: {len(tips):,}")

    debt, bonds = build_debt_and_bonds(districts)
    debt.to_csv(OUT / "debt.csv", index=False)
    bonds.to_csv(OUT / "bonds.csv", index=False)
    print(f"debt rows: {len(debt):,} (ids not in district list: {(~debt.id.isin(districts.id)).sum()})")
    um = bonds[bonds["match"] == "unmatched"]
    print(f"bond propositions: {len(bonds):,}  unmatched: {len(um):,} "
          f"({um.governmentname.nunique()} names; since 2010: {(pd.to_datetime(um.electiondate).dt.year >= 2010).sum()})")
    print("  unmatched since 2010:", sorted(um[pd.to_datetime(um.electiondate).dt.year >= 2010].governmentname.unique()))


if __name__ == "__main__":
    main()
