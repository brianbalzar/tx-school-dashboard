#!/usr/bin/env python3
"""Build the app's data bundle: district series, peer groups and opportunity signals.

Input:  data/processed/*.csv (from build_reference.py and build_peims_detail.py)
Output: app/data/bundle.json   (plaintext; scripts/encrypt_bundle.mjs encrypts it for publishing)

Signals are deliberately transparent: each one is a plain rule over public data, and each
card carries the numbers, comparison group, period, caveat and a discovery question.
Thresholds live in THRESH below; tune them there.
"""

from __future__ import annotations

import datetime as dt
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
OUT = ROOT / "app" / "data" / "bundle.json"

FY0, FY1 = 2009, 2025          # actuals range
YEARS = list(range(FY0, FY1 + 1))
BUDGET_FY = 2026
K_PEERS = 20
AS_OF = dt.date(2026, 9, 28)   # "today" for bond timing; update when rebuilding

THRESH = {
    "min_enrollment": 500,          # smaller districts get no signals: per-student figures swing too much
    "pc_level": 0.25, "pc_level_strong": 0.40,
    "pc_growth_pts": 0.15, "pc_growth_strong": 0.30,
    "om_level": 0.25, "om_level_strong": 0.40,
    "om_shift_pts": 0.10, "om_shift_strong": 0.18,
    "om_growth_pts": 0.25, "om_growth_strong": 0.40,
    "om_low": -0.25,
    "budget_jump": 0.15,
    "cap_years": 8, "cap_growth": 0.10, "cap_growth_strong": 0.20,
    "cap_retire": 0.45, "cap_retire_strong": 0.65,
    "cap_is_low": 0.20,
}


# Consultative guidance attached to every card: why it matters, explanations, what to request, who to ask, next step.
GUIDE = {
    "utility-level": dict(
        why="Utility spending that sits well above similar districts year after year is the classic starting point for a performance contract: the gap is the savings pool that can fund upgrades.",
        explanations=["Higher electricity or gas rates (contract structure, retail provider, demand charges)", "Aging HVAC, lighting or controls", "Longer operating hours or after-hours building use", "More or larger buildings per student (square footage isn't public)", "Water or irrigation costs, or telephone costs coded to utilities", "Climate: West and South Texas districts run more cooling hours"],
        requests=["24–36 months of utility bills (electric, gas, water) by meter or campus", "Campus square footage and year built", "Current electricity supply contract and rate schedules", "Any energy audits or energy-management plans (SB 300 plans)", "BAS/controls inventory and scheduling practices"],
        who="Chief financial officer / business official; director of facilities or energy manager",
        next="Request utility bills and square footage, then benchmark energy use intensity (EUI) by campus.",
        questions=["What's driving utility costs above similar districts: rates, usage, or the building portfolio?", "When was your last energy audit, and what came of it?"]),
    "utility-growth": dict(
        why="Utility costs growing faster than peers can point to equipment decline, schedule creep or rate exposure, and district leaders usually feel this in the budget.",
        explanations=["Rate increases or an expiring fixed-price electricity contract", "New or expanded buildings added since FY2019", "Longer hours, more after-school use, or post-COVID ventilation changes", "Equipment efficiency declining with age", "Water or wastewater rate increases"],
        requests=["Utility bills for FY2019 and the latest 24 months", "List of buildings added or renovated since 2019", "Electricity contract history (term, price, provider)", "Controls schedules / setpoint policies"],
        who="Business official; facilities director; energy manager if the district has one",
        next="Separate rate effects from usage by comparing $/kWh and kWh per square foot, 2019 vs today.",
        questions=["What contributed to the rise in utility spending since 2019?", "Have new facilities, longer hours or new electricity contracts changed the picture?"]),
    "om-level": dict(
        why="Plant operations spending well above peers suggests room to improve how maintenance and custodial work is organized, or a portfolio that is expensive to run.",
        explanations=["More campuses or older buildings per student", "Service levels the district chose (custodial frequency, grounds)", "Reactive rather than preventive maintenance", "Wage levels or staffing structure", "Contracts priced above market"],
        requests=["Facilities org chart and staffing counts", "Work-order data (reactive vs preventive mix, backlog)", "Major service contracts (HVAC, custodial, grounds) and terms", "Campus square footage and age"],
        who="Facilities / maintenance director; business official",
        next="Ask for work-order history to see how much maintenance is reactive.",
        questions=["How is facilities work split between in-house staff and contractors?", "Where do facilities costs feel hardest to control?"]),
    "om-low": dict(
        why="Sustained spending well below peers can mean efficient operations, or maintenance being deferred and building up as future capital need.",
        explanations=["Newer buildings that need less maintenance", "Efficient operations or lean staffing", "Deferred maintenance or unfilled positions", "Costs recorded in other functions or funds"],
        requests=["Deferred-maintenance list or backlog estimate", "Most recent facility condition assessment", "Open facilities positions", "Capital improvement plan"],
        who="Facilities director; superintendent; business official",
        next="Ask whether a facility condition assessment has been done; if not, this is an FCA conversation.",
        questions=["How is the district keeping up with preventive maintenance?", "Is there a backlog of deferred work, and has it been quantified?"]),
    "om-shift": dict(
        why="A shift toward contracted services often signals staffing gaps or a deliberate outsourcing strategy, both of which open a conversation about managed O&M.",
        explanations=["Difficulty hiring or keeping skilled trades", "A deliberate outsourcing decision", "One-time repair projects paid through contracts", "COVID-era or ESSER-funded work"],
        requests=["List of facilities service contracts and annual value", "Facilities staffing history and vacancies", "Scope of any recent large repair projects"],
        who="Facilities director; purchasing; business official",
        next="Map which trades are now contracted and whether that was a strategy or a stopgap.",
        questions=["Has the district moved facilities work to contractors on purpose, or to fill staffing gaps?", "Which trades are hardest to staff in-house?"]),
    "om-growth": dict(
        why="Facilities costs rising much faster than enrollment compress the rest of the budget and make efficiency projects easier to justify.",
        explanations=["New campuses opened", "Wage and benefit increases", "Contract price escalation", "Catch-up on deferred repairs", "Insurance or utilities outside plant operations were excluded, so this is mostly labor, contracts and supplies"],
        requests=["Facilities budget history by category", "New buildings opened since 2019", "Major contract renewals"],
        who="Business official; facilities director",
        next="Break the increase into labor, contracts and supplies with the district.",
        questions=["What has driven facilities operating costs up since 2019?", "Which cost categories are you most concerned about next year?"]),
    "om-budget": dict(
        why="A larger adopted facilities budget signals planned work this year: the timing for conversations about contracts, repairs or equipment.",
        explanations=["New buildings coming online", "Planned repairs or equipment replacements", "Expected rate or wage increases", "Budgeting conservatively above expected spend"],
        requests=["FY2026 adopted budget detail for plant maintenance & operations", "Planned facilities projects for the year"],
        who="Business official; facilities director",
        next="Read the adopted budget document for named facilities priorities.",
        questions=["What's behind the larger facilities budget this year?", "Which projects are planned, and how will they be procured?"]),
    "cap-since": dict(
        why="A long gap since the last successful bond often means capital needs are accumulating; a facility condition assessment is usually the first step toward the next bond.",
        explanations=["Needs funded from fund balance, tax notes or lease-purchase", "Buildings still relatively new", "Community or board reluctance to go to voters", "Planning already under way but not yet public"],
        requests=["Most recent facility condition assessment or master plan", "Capital improvement plan", "Board discussions of a future bond"],
        who="Superintendent; business official; board facilities committee",
        next="Check board agendas for facilities planning or long-range facility committees.",
        questions=["How are you planning for major capital needs?", "Has the district completed a recent facility condition assessment?"]),
    "cap-growth": dict(
        why="Sustained enrollment growth usually leads to new campuses and additions, and eventually to a bond program.",
        explanations=["Housing growth in the attendance zone", "Transfers or program changes", "Virtual or online program enrollment (doesn't need building space)"],
        requests=["Demographer's enrollment projections", "Campus capacity and utilization", "Long-range facility plan"],
        who="Superintendent; planning / operations leadership",
        next="Look for a demographic study; it usually precedes a bond.",
        questions=["Where is enrollment growth putting the most pressure on existing campuses?", "Is a demographic study or long-range facility plan under way?"]),
    "cap-retire": dict(
        why="As existing debt retires, the district can issue new bonds without raising the I&S rate, which makes a new bond far easier to pass.",
        explanations=["Scheduled maturities of older bond series", "Refunding activity changes the actual schedule", "Straight-line estimate here; actual amortization varies"],
        requests=["Debt service schedule from the financial advisor", "Most recent annual financial report (debt notes)", "Board discussion of bond capacity"],
        who="Business official; financial advisor",
        next="Confirm the actual debt service schedule in the district's annual financial report.",
        questions=["As existing debt retires, is the board considering a new bond program?", "What would a new program need to include?"]),
    "cap-failed": dict(
        why="A failed bond usually comes back revised; districts often commission better needs assessments before returning to voters.",
        explanations=["Voter concern about tax impact", "Project list seen as too broad", "Weak community engagement", "Timing or turnout"],
        requests=["Proposition language and project list", "Post-election board discussion", "Any community survey results"],
        who="Superintendent; board; bond steering committee",
        next="Read the failed proposition's project list and board follow-up.",
        questions=["What did the district learn from the last election?", "How are you re-prioritizing the project list?"]),
    "cap-passed": dict(
        why="A newly approved bond means design, construction and commissioning are coming; it's the window to talk about controls standards, commissioning and long-term O&M.",
        explanations=["Program management and design procurement under way", "Projects phased over several years"],
        requests=["Bond project list and schedule", "Program manager / architect selections", "Controls and commissioning standards"],
        who="Bond program manager; facilities director; business official",
        next="Get the bond project schedule and identify commissioning and controls-standard needs.",
        questions=["How are you planning commissioning and controls standards for the bond projects?", "How will long-term O&M be funded for the new buildings?"]),
    "cap-mixed": dict(
        why="Mixed recent results (some propositions passed, some failed) mean the district is funded for part of its plan and re-planning the rest.",
        explanations=["Voters approved core facilities but rejected amenities or technology", "Separate elections with different turnout"],
        requests=["Proposition-by-proposition results and project lists", "Board plans for the failed items"],
        who="Superintendent; business official; bond steering committee",
        next="Compare what passed and what failed to see which needs are still unfunded.",
        questions=["Which needs from the failed propositions are still unfunded?", "How are you planning to address them?"]),
    "em-fit": dict(
        why="Districts this size usually can't justify a full-time energy manager, yet their utility spend is large enough that someone actively managing schedules, setpoints, bills and behavior typically pays for itself.",
        explanations=["No dedicated energy manager; facilities staff handle energy part-time", "Controls schedules drift without anyone reviewing them", "Utility bills paid without audit for errors or rate optimization", "An energy manager position may exist but be vacant or shared with other duties"],
        requests=["Who currently owns energy and utility bills?", "12–24 months of utility bills", "BAS/controls access and current schedules", "The board's long-term energy plan (Texas Education Code §44.902)"],
        who="Business official; facilities / maintenance director",
        next="Ask who owns energy today; if nobody full-time, propose a shared energy manager with bill auditing and schedule management.",
        questions=["Who is responsible for energy management today, and how much of their time does it get?", "When were building schedules and setpoints last reviewed?"]),
    "em-utility": dict(
        why="Utility spending above or growing faster than peers is the savings pool an energy manager would work on first: schedules, setpoints and bill errors.",
        explanations=["Schedules and setpoints not actively managed", "Rate or contract issues", "Building portfolio differences (size, age, type)"],
        requests=["Utility bills by campus", "Controls schedules", "Electricity supply contract"],
        who="Business official; facilities director",
        next="Benchmark campuses against each other with 12 months of bills to find the first no-cost wins.",
        questions=["Which campuses use the most energy per square foot?", "Is anyone reviewing monthly bills for errors or unusual use?"]),
    "em-budget": dict(
        why="A general-fund operating deficit makes low-cost, no-capital savings like shared energy management easy to justify.",
        explanations=["Enrollment-driven revenue decline", "Rising payroll or insurance costs", "Deliberate use of fund balance"],
        requests=["Adopted budget and deficit plan", "Fund balance position"],
        who="Business official / CFO",
        next="Frame energy management as a budget-neutral savings program with a fee below expected savings.",
        questions=["What cost-reduction options is the board considering?", "Would a savings program with no upfront cost help close the gap?"]),
    "cap-capacity": dict(
        why="A low I&S rate and a strong tax base mean a district could support new debt if the board and voters choose to.",
        explanations=["Conservative debt policy", "Recent debt payoff", "Growing property values"],
        requests=["Debt policy", "Financial advisor's capacity analysis"],
        who="Business official; financial advisor",
        next="Pair with a facility condition assessment conversation: capacity is only useful with a defined need.",
        questions=["Is the board weighing a bond?", "What would a facility condition assessment need to show to support it?"]),
}

LOCALE_ORD = {"Urban": 0, "Suburban": 1, "Town": 2, "Rural": 3}


# ---------------------------------------------------------------------------
def load():
    d = pd.read_csv(P / "districts.csv", dtype={"id": str})
    enr = pd.read_csv(P / "enrollment.csv", dtype={"id": str})
    det = pd.read_csv(P / "peims_detail_agg.csv", dtype={"id": str})
    tax = pd.read_csv(P / "tax_rates.csv", dtype={"id": str})
    pv = pd.read_csv(P / "property_values.csv", dtype={"id": str})
    bonds = pd.read_csv(P / "bonds.csv", dtype={"id": str}, parse_dates=["electiondate"])
    debt = pd.read_csv(P / "debt.csv", dtype={"id": str}, low_memory=False,
                       parse_dates=["lastprincipalpayment", "maturitydate"])
    return d, enr, det, tax, pv, bonds, debt


def wide(det, kind, measure):
    s = det[(det.kind == kind) & (det.measure == measure)]
    return s.pivot_table(index="id", columns="fy", values="amount", aggfunc="sum")


def fnum(x, nd=0):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(float(x), nd) if nd else int(round(float(x)))


def money(x):
    if x is None or pd.isna(x):
        return "—"
    a = abs(x)
    s = f"${a/1e9:.1f}B" if a >= 1e9 else f"${a/1e6:.1f}M" if a >= 1e6 else f"${a/1e3:.0f}K" if a >= 1e4 else f"${a:,.0f}"
    return ("−" if x < 0 else "") + s


def pct(x, signed=True):
    if x is None or pd.isna(x):
        return "—"
    v = round(x * 100)
    return f"{'+' if signed and v > 0 else ''}{v}%"


# ---------------------------------------------------------------------------
def knn(features: pd.DataFrame, weights: dict, pool_mask: pd.Series, k: int) -> dict:
    X = features[list(weights)].astype(float)
    X = (X - X.mean()) / X.std(ddof=0)
    X = X.fillna(0) * pd.Series(weights)
    ids = X.index.to_numpy()
    arr = X.to_numpy()
    pool = pool_mask.reindex(X.index).fillna(False).to_numpy()
    out = {}
    for i, idx in enumerate(ids):
        dist = np.sqrt(((arr - arr[i]) ** 2).sum(axis=1))
        dist[i] = np.inf
        dist[~pool] = np.inf
        # peers must share charter status
        order = np.argsort(dist)[:k]
        out[idx] = [ids[j] for j in order if np.isfinite(dist[j])]
    return out


def med(values):
    v = [x for x in values if x is not None and not pd.isna(x) and np.isfinite(x)]
    return float(np.median(v)) if v else np.nan


# ---------------------------------------------------------------------------
def main():
    d, enr, det, tax, pv, bonds, debt = load()
    d = d.set_index("id")

    E = enr.pivot_table(index="id", columns="fy", values="enrollment").reindex(columns=YEARS)
    A = {m: wide(det, "actual", m).reindex(columns=YEARS) for m in [
        "fn_51", "f51_staff", "f51_utilities", "f51_contract_repair", "f51_contract_other", "f51_supplies",
        "f51_insurance", "f51_other_operating", "f51_capital", "fn_81", "capital_all", "total_exp",
        "fn_34", "fn_52", "fn_53", "fn_11"]}
    B51 = wide(det, "budget", "fn_51")
    BSV = wide(det, "budget", "f51_contract_other")  # budget 62xx = all purchased services (see build notes)

    ids = [i for i in d.index if i in E.index and not pd.isna(E.loc[i, FY1]) and E.loc[i, FY1] > 0]
    d = d.loc[ids]
    E = E.loc[ids]
    A = {m: t.reindex(ids) for m, t in A.items()}

    ctrl = A["fn_51"] - A["f51_insurance"].fillna(0) - A["f51_capital"].fillna(0)   # controllable plant O&M
    util_ps = A["f51_utilities"] / E
    ctrl_ps = ctrl / E
    nonutil = ctrl - A["f51_utilities"].fillna(0)
    contracted = A["f51_contract_repair"].fillna(0) + A["f51_contract_other"].fillna(0)

    # --- debt: FY2025 outstanding by issue, straight-line retirement estimate
    dcur = debt[debt.fy == debt.fy.max()].copy()
    dcur["final"] = dcur["lastprincipalpayment"].fillna(dcur["maturitydate"]).dt.year
    dcur["years_left"] = (dcur["final"] - debt.fy.max()).clip(lower=1)
    debt_by = {}
    for i, g in dcur.groupby("id"):
        P0 = g["totalprincipaloutstanding"].sum()
        prof = {}
        for _, r in g.iterrows():
            per = r["totalprincipaloutstanding"] / r["years_left"]
            for y in range(int(debt.fy.max()) + 1, int(debt.fy.max() + r["years_left"]) + 1):
                prof[y] = prof.get(y, 0) + per
        cum = lambda n: sum(v for y, v in prof.items() if y <= debt.fy.max() + n)
        debt_by[i] = {"principal": P0, "interest": g["totalinterestoutstanding"].sum(),
                      "retire1": cum(1), "retire3": cum(3), "retire5": cum(5),
                      "profile": sorted(prof.items())}
    DEBT_FY = int(debt.fy.max())

    # --- tax & property values
    TX = {i: g.sort_values("fy") for i, g in tax.groupby("id")}
    PVW = pv.pivot_table(index="id", columns="tax_year", values="value_mo")
    pv_latest_year = int(pv.tax_year.max())
    pv_status = pv[pv.tax_year == pv_latest_year].status.iloc[0]
    pv_ps = (PVW[pv_latest_year] / E[FY1]).reindex(ids)
    pv_growth = (PVW[pv_latest_year] / PVW[pv_latest_year - 5] - 1).reindex(ids)

    # --- sizing inputs (Upchurch assumptions in config/sizing.json)
    SZ = json.loads((ROOT / "config" / "sizing.json").read_text())
    GF = pd.read_csv(P / "general_fund.csv", dtype={"id": str}).set_index(["id", "fy"]) if (P / "general_fund.csv").exists() else None
    TIPS = pd.read_csv(P / "tips.csv", dtype={"id": str}).set_index("id") if (P / "tips.csv").exists() else pd.DataFrame()
    _tf = sorted((ROOT / "data" / "raw" / "reference").glob("tips_members_*.xlsx"))
    TIPS_ASOF = ("TIPS member list " + pd.Timestamp(_tf[-1].stem.split("_")[-1]).strftime("%b %Y")) if _tf else "TIPS member list"
    f51_ps = A["fn_51"] / E
    cap_ps = (A["capital_all"] / E)[FY1]
    cap_hi = cap_ps[E[FY1] >= THRESH["min_enrollment"]].quantile(SZ["inefficiency"]["high_capital_percentile"])
    addressable = A["f51_staff"].fillna(0) + A["f51_contract_repair"].fillna(0) + A["f51_contract_other"].fillna(0) + A["f51_supplies"].fillna(0)

    def band(value, bands):
        for lim, out in bands:
            if lim is None or value <= lim:
                return out
    clamp = lambda v, lo=0.0, hi=1.0: max(lo, min(hi, v))

    # --- bonds
    bonds = bonds[bonds.id.notna()].copy()
    BD = {i: g.sort_values("electiondate") for i, g in bonds.groupby("id")}

    # --- features for peers
    f = pd.DataFrame(index=ids)
    f["log_enr"] = np.log(E[FY1])
    f["locale"] = d["locale"].map(LOCALE_ORD)
    f["lat"] = d["lat"]
    f["lon"] = d["lon"]
    f["camp_per_k"] = d["campuses"] / (E[FY1] / 1000)
    f["enr_g5"] = E[FY1] / E[FY1 - 5] - 1
    f["log_pvps"] = np.log(pv_ps.clip(lower=1))
    f["debt_ps"] = np.log1p(pd.Series({i: debt_by.get(i, {}).get("principal", 0) for i in ids}) / E[FY1])
    last_is = pd.Series({i: (TX[i]["is_rate"].dropna().iloc[-1] if i in TX and TX[i]["is_rate"].notna().any() else np.nan) for i in ids})
    f["is_rate"] = last_is
    charter = d["charter"].astype(bool)
    f = f.fillna(f.median(numeric_only=True))

    peers_ops, peers_cap = {}, {}
    for is_ch in (False, True):
        mask = charter == is_ch
        sub = f[mask]
        po = knn(sub, {"log_enr": 2.0, "locale": 1.0, "lat": 0.75, "lon": 0.75, "camp_per_k": 0.75}, mask[mask], K_PEERS)
        peers_ops.update(po)
        pc = knn(sub, {"log_enr": 2.0, "enr_g5": 1.0, "log_pvps": 1.5, "locale": 1.0, "debt_ps": 1.0, "is_rate": 0.75}, mask[mask], K_PEERS)
        peers_cap.update(pc)

    # --- peer medians by year helper
    def peer_med(table: pd.DataFrame, i: str, peers: dict, fy: int):
        return med([table.at[p, fy] if p in table.index else np.nan for p in peers[i]])

    region_of = d["region"]
    districts_out = []
    lens_rows = []
    today = pd.Timestamp(AS_OF)

    for i in ids:
        row = d.loc[i]
        e25 = E.at[i, FY1]
        is_ch = bool(charter[i])
        cards = []

        def card(key, lens, title, strength, finding, dollars, dollars_label, period, compare, caveat, question, source, value=None):
            cards.append(dict(key=key, lens=lens, title=title, strength=strength, finding=finding, dollars=fnum(dollars),
                              dollarsLabel=dollars_label, period=period, compare=compare, caveat=caveat,
                              question=question, source=source, value=value))

        small = e25 < THRESH["min_enrollment"]
        npo = len(peers_ops[i])
        cmp_ops = f"vs {npo} similar districts"

        # ---------- Performance contracting ----------
        u25 = util_ps.at[i, FY1]
        m25 = peer_med(util_ps, i, peers_ops, FY1)
        dev = u25 / m25 - 1 if m25 and not pd.isna(u25) else np.nan
        persist = sum(1 for y in range(FY1 - 3, FY1 + 1)
                      if not pd.isna(util_ps.at[i, y]) and util_ps.at[i, y] > 1.10 * peer_med(util_ps, i, peers_ops, y))
        if not pd.isna(dev) and dev >= THRESH["pc_level"]:
            strength = "Strong" if dev >= THRESH["pc_level_strong"] and persist >= 3 else "Moderate" if persist >= 2 else "Weak"
            card("utility-level", "pc", "Utility-cost level", strength,
                 f"Utility spending is {pct(dev, False)} above the median for similar districts "
                 f"(${u25:,.0f} vs ${m25:,.0f} per student in FY{FY1}) and has been above peers in {persist} of the last 4 years.",
                 (u25 - m25) * e25, "/yr above peer median", f"FY{FY1-3}–FY{FY1}", cmp_ops,
                 "May reflect building age or type, controls, rate structure, operating hours, climate or more square footage per student.",
                 "What's driving utility costs above similar districts: rates, usage, or the building portfolio? When was your last energy audit?",
                 "TEA PEIMS actuals, Function 51 object 6259 (utilities)", value=dev)

        u19 = util_ps.at[i, 2019]
        g = u25 / u19 - 1 if u19 and not pd.isna(u19) and u19 > 0 else np.nan
        pg = med([util_ps.at[p, FY1] / util_ps.at[p, 2019] - 1 for p in peers_ops[i]
                  if not pd.isna(util_ps.at[p, 2019]) and util_ps.at[p, 2019] > 0])
        if not pd.isna(g) and not pd.isna(pg) and g - pg >= THRESH["pc_growth_pts"]:
            strength = "Strong" if g - pg >= THRESH["pc_growth_strong"] else "Moderate" if g - pg >= 0.18 else "Weak"
            card("utility-growth", "pc", "Utility growth outpacing peers", strength,
                 f"Utility spending per student rose {pct(g, False)} from FY2019 to FY{FY1}, compared with {pct(pg, False)} for similar districts.",
                 (g - pg) * u19 * e25, "/yr more than peer-rate growth", f"FY2019–FY{FY1}", cmp_ops,
                 "Rate increases, new or expanded buildings, longer operating hours or equipment decline can each drive growth.",
                 f"What contributed to the rise in utility spending since 2019? Have new facilities or schedules changed usage?",
                 "TEA PEIMS actuals, Function 51 object 6259", value=g - pg)

        # ---------- O&M ----------
        c25 = ctrl_ps.at[i, FY1]
        cm25 = peer_med(ctrl_ps, i, peers_ops, FY1)
        cdev = c25 / cm25 - 1 if cm25 and not pd.isna(c25) else np.nan
        cpersist = sum(1 for y in range(FY1 - 3, FY1 + 1)
                       if not pd.isna(ctrl_ps.at[i, y]) and ctrl_ps.at[i, y] > 1.10 * peer_med(ctrl_ps, i, peers_ops, y))
        lowpersist = sum(1 for y in range(FY1 - 3, FY1 + 1)
                         if not pd.isna(ctrl_ps.at[i, y]) and ctrl_ps.at[i, y] < 0.85 * peer_med(ctrl_ps, i, peers_ops, y))
        if not pd.isna(cdev) and cdev >= THRESH["om_level"]:
            strength = "Strong" if cdev >= THRESH["om_level_strong"] and cpersist >= 3 else "Moderate" if cpersist >= 2 else "Weak"
            card("om-level", "om", "Plant operations cost level", strength,
                 f"Plant maintenance & operations spending (excluding insurance and capital) is {pct(cdev, False)} above similar districts: "
                 f"${c25:,.0f} vs ${cm25:,.0f} per student in FY{FY1}.",
                 (c25 - cm25) * e25, "/yr above peer median", f"FY{FY1}", cmp_ops,
                 "A difficult portfolio (many small or older campuses, long distances) can justify higher costs; so can service levels the district chose.",
                 "How is facilities work split between in-house staff and contractors, and where do costs feel hardest to control?",
                 "TEA PEIMS actuals, Function 51", value=cdev)
        elif not pd.isna(cdev) and cdev <= THRESH["om_low"] and lowpersist >= 3:
            card("om-low", "om", "Spending well below peers", "Moderate",
                 f"Plant operations spending has been at least 15% below similar districts in {lowpersist} of the last 4 years "
                 f"(${c25:,.0f} vs ${cm25:,.0f} per student in FY{FY1}).",
                 (cm25 - c25) * e25, "/yr below peer median", f"FY{FY1-3}–FY{FY1}", cmp_ops,
                 "Low spending can mean efficient operations, newer buildings, or maintenance being deferred. Public data can't tell which.",
                 "How is the district keeping up with preventive maintenance? Is there a backlog of deferred work?",
                 "TEA PEIMS actuals, Function 51", value=cdev)

        def share(y0, y1):
            num = contracted.loc[i, y0:y1].sum()
            den = nonutil.loc[i, y0:y1].sum()
            return num / den if den and den > 0 else np.nan
        sh0, sh1 = share(2017, 2019), share(FY1 - 2, FY1)
        if not pd.isna(sh0) and not pd.isna(sh1) and sh1 - sh0 >= THRESH["om_shift_pts"]:
            strength = "Strong" if sh1 - sh0 >= THRESH["om_shift_strong"] else "Moderate"
            card("om-shift", "om", "Operating-model shift", strength,
                 f"Contracted maintenance and services grew from {sh0*100:.0f}% to {sh1*100:.0f}% of non-utility plant operations spending "
                 f"(FY2017–19 vs FY{FY1-2}–{FY1} averages).",
                 contracted.at[i, FY1], "/yr contracted services", f"FY2017–FY{FY1}", "District trend",
                 "Can reflect a deliberate outsourcing decision, staffing shortages, or one-time repair projects.",
                 "Has the district moved facilities work to contractors on purpose, or is it filling staffing gaps?",
                 "TEA PEIMS actuals, Function 51 objects 61xx and 62xx", value=sh1 - sh0)

        ctot = ctrl.loc[i]
        eg = E.at[i, FY1] / E.at[i, 2019] - 1 if not pd.isna(E.at[i, 2019]) else np.nan
        cg = ctot[FY1] / ctot[2019] - 1 if ctot[2019] and not pd.isna(ctot[2019]) else np.nan
        pcg = med([ctrl.at[p, FY1] / ctrl.at[p, 2019] - (E.at[p, FY1] / E.at[p, 2019]) for p in peers_ops[i]
                   if not pd.isna(ctrl.at[p, 2019]) and ctrl.at[p, 2019] > 0 and not pd.isna(E.at[p, 2019])])
        if not pd.isna(cg) and not pd.isna(eg) and not pd.isna(pcg) and (cg - eg) - pcg >= THRESH["om_growth_pts"]:
            strength = "Strong" if (cg - eg) - pcg >= THRESH["om_growth_strong"] else "Moderate"
            card("om-growth", "om", "Costs rising faster than enrollment", strength,
                 f"Plant operations spending rose {pct(cg, False)} from FY2019 to FY{FY1} while enrollment changed {pct(eg)}; "
                 f"that gap is {((cg - eg) - pcg)*100:.0f} points wider than for similar districts.",
                 ctot[FY1] - ctot[2019] * (1 + eg + pcg), "/yr above peer-rate growth", f"FY2019–FY{FY1}", cmp_ops,
                 "New campuses, expanded hours, wage increases or deferred work being caught up can all drive this.",
                 "What has driven facilities operating costs up since 2019: new buildings, wages, contracts or repairs?",
                 "TEA PEIMS actuals, Function 51; TEA enrollment", value=(cg - eg) - pcg)

        b26 = B51.at[i, BUDGET_FY] if i in B51.index and BUDGET_FY in B51.columns else np.nan
        a25 = A["fn_51"].at[i, FY1]
        bchg = b26 / a25 - 1 if a25 and not pd.isna(b26) and a25 > 0 else np.nan
        if not pd.isna(bchg) and bchg >= THRESH["budget_jump"]:
            card("om-budget", "om", "Plant M&O budget increase", "Moderate" if bchg >= 0.2 else "Weak",
                 f"The FY{BUDGET_FY} adopted budget for plant maintenance & operations is {pct(bchg, False)} above FY{FY1} actual spending "
                 f"({money(b26)} vs {money(a25)}).",
                 b26 - a25, "planned increase", f"FY{FY1} actual → FY{BUDGET_FY} budget", "District trend",
                 "Budgets are plans, and districts often budget above what they end up spending. Utilities can't be separated in budget data.",
                 f"What's behind the larger FY{BUDGET_FY} facilities budget: new buildings, contracts, or planned repairs?",
                 f"TEA PEIMS budget FY{BUDGET_FY}, Function 51", value=bchg)

        # ---------- Capital planning (ISDs only) ----------
        bd = BD.get(i)
        passed = bd[bd.result == "Carried"] if bd is not None else None
        failed = bd[bd.result == "Defeated"] if bd is not None else None
        last_pass = passed.electiondate.max() if passed is not None and len(passed) else pd.NaT
        yrs_since = (today - last_pass).days / 365.25 if not pd.isna(last_pass) else np.nan
        eg5 = E.at[i, FY1] / E.at[i, FY1 - 5] - 1 if not pd.isna(E.at[i, FY1 - 5]) else np.nan
        dbt = debt_by.get(i)
        npc = len(peers_cap[i])
        cmp_cap = f"vs {npc} districts with similar size, growth and tax base"
        if not is_ch:
            if (pd.isna(yrs_since) or yrs_since >= THRESH["cap_years"]) and not (not pd.isna(eg5) and eg5 < -0.05):
                strength = "Strong" if (not pd.isna(eg5) and eg5 >= 0.05) else "Moderate"
                since_txt = f"{int(yrs_since)} years" if not pd.isna(yrs_since) else "no passed bond on record since 1990s"
                card("cap-since", "cap", "Time since last passed bond", strength,
                     (f"The district last passed a bond {int(yrs_since)} years ago ({last_pass:%b %Y}); enrollment changed {pct(eg5)} over five years."
                      if not pd.isna(yrs_since) else
                      f"No passed bond election is on record for this district; enrollment changed {pct(eg5)} over five years."),
                     None, "", f"Through {bonds.electiondate.max():%b %Y}", "District history",
                     "Districts also fund facilities from fund balance, maintenance tax notes or lease-purchase, which bond records don't show.",
                     "How are you planning for major capital needs, and has the district completed a recent facility condition assessment?",
                     "Texas Bond Review Board bond election results", value=yrs_since if not pd.isna(yrs_since) else 99)
            if not pd.isna(eg5) and eg5 >= THRESH["cap_growth"]:
                card("cap-growth", "cap", "Enrollment growth", "Strong" if eg5 >= THRESH["cap_growth_strong"] else "Moderate",
                     f"Enrollment grew {pct(eg5, False)} from FY{FY1-5} to FY{FY1} ({E.at[i, FY1-5]:,.0f} to {e25:,.0f} students).",
                     None, "", f"FY{FY1-5}–FY{FY1}", "District trend",
                     "Growth may be absorbed by existing capacity; campus-level utilization isn't in public data.",
                     "Where is enrollment growth putting the most pressure on existing campuses?",
                     "TEA PEIMS fall enrollment", value=eg5)
            if dbt and dbt["principal"] > 0:
                share5 = dbt["retire5"] / dbt["principal"]
                if share5 >= THRESH["cap_retire"]:
                    card("cap-retire", "cap", "Debt capacity freeing up", "Strong" if share5 >= THRESH["cap_retire_strong"] else "Moderate",
                         f"An estimated {money(dbt['retire5'])} ({share5*100:.0f}%) of the {money(dbt['principal'])} in outstanding principal "
                         f"retires by FY{DEBT_FY+5}, which frees I&S tax capacity for new debt.",
                         dbt["retire5"], f"principal retiring by FY{DEBT_FY+5} (est.)", f"FY{DEBT_FY+1}–FY{DEBT_FY+5}", "District debt",
                         "Straight-line estimate from each issue's final maturity; actual amortization schedules vary. Refundings change the picture.",
                         "As existing debt retires, is the board considering a new bond program, and what would it need to include?",
                         f"Texas Bond Review Board debt outstanding, FY{DEBT_FY}", value=share5)
            if failed is not None and len(failed):
                lf = failed.electiondate.max()
                if (today - lf).days <= 3 * 365:
                    r = failed[failed.electiondate == lf]
                    card("cap-failed", "cap", "Recent failed bond", "Moderate",
                         f"{len(r)} proposition{'s' if len(r) > 1 else ''} totaling {money(r.amount.sum())} failed in {lf:%B %Y}"
                         + (f" ({r.votesfor.sum()/(r.votesfor.sum()+r.votesagainst.sum())*100:.0f}% yes)." if (r.votesfor.sum() + r.votesagainst.sum()) else "."),
                         r.amount.sum(), "failed", f"{lf:%b %Y}", "District history",
                         "A failed bond often returns in a revised form; the district may be re-scoping needs.",
                         "What did the district learn from the last election, and how are you re-prioritizing the project list?",
                         "Texas Bond Review Board bond election results", value=None)
            if passed is not None and len(passed):
                if (today - last_pass).days <= 18 * 30:
                    r = passed[passed.electiondate == last_pass]
                    card("cap-passed", "cap", "Bond recently approved", "Moderate",
                         f"Voters approved {money(r.amount.sum())} in {last_pass:%B %Y} ({'; '.join(r.purposedescription.dropna().unique()[:3])}).",
                         r.amount.sum(), "approved", f"{last_pass:%b %Y}", "District history",
                         "Bond programs take years to deliver; design, commissioning and O&M planning follow the vote.",
                         "How are you planning commissioning, controls standards and long-term O&M for the new bond projects?",
                         "Texas Bond Review Board bond election results", value=None)
            isr = last_is.get(i, np.nan)
            pvm = med([pv_ps.get(p, np.nan) for p in peers_cap[i]])
            if not pd.isna(isr) and isr <= THRESH["cap_is_low"] and not pd.isna(pv_ps.get(i)) and pv_ps.get(i) >= pvm:
                card("cap-capacity", "cap", "Tax capacity for debt", "Weak",
                     f"The I&S (debt) tax rate is ${isr:.2f} per $100, ${0.50 - isr:.2f} below the $0.50 test for new bonds, "
                     f"and property value per student (${pv_ps.get(i)/1e3:,.0f}K) is at or above similar districts.",
                     None, "", f"Tax year {int(TX[i].fy.max()) - 1}", cmp_cap,
                     "Capacity isn't intent; voter appetite and board priorities decide whether it's used.",
                     "Is the board weighing a bond, and what would a facility condition assessment need to show to support it?",
                     "TEA adopted tax rates; Comptroller property values", value=0.50 - isr)

        # ---------- opportunity sizing (Upchurch model) ----------
        f51p = f51_ps.at[i, FY1]
        f51_peer = peer_med(f51_ps, i, peers_ops, FY1)
        ratio = f51p / f51_peer if f51_peer and not pd.isna(f51p) else np.nan
        high_cap = not pd.isna(cap_ps.get(i)) and cap_ps.get(i) >= cap_hi
        ine = SZ["inefficiency"]
        ineff = (ine["high_capital_factor"] if high_cap else 1.0) * clamp((ratio - ine["median_offset"]) / ine["span"]) if not pd.isna(ratio) else 0.0
        energy = (A["f51_utilities"].at[i, FY1] or 0) * SZ["energy_share"]["default"]
        es = SZ["esco"]
        bands = es["savings_bands_by_f51_ratio"]
        k_band = next((j for j, (lim, _) in enumerate(bands) if lim is None or (not pd.isna(ratio) and ratio <= lim)), 0)
        def esco_pct(k):
            k = min(max(k, 0), len(bands) - 1)
            return max(bands[k][1] - (es["high_capital_reduction"] if high_cap else 0), es["savings_floor"])
        sp = [esco_pct(k_band - 1), esco_pct(k_band), esco_pct(k_band + 1)]
        mult = band(e25, es["project_multiple_by_enrollment"])
        esco_sav = [p_ * energy for p_ in sp]
        esco_proj = [v * mult for v in esco_sav]
        gf_net = None
        if GF is not None and (i, FY1) in GF.index:
            g_ = GF.loc[(i, FY1)]
            gf_net = (g_["gf_revenue"] - g_["gf_opex"]) / e25 if e25 else None
        stress = clamp((es["budget_stress"]["target_surplus_per_student"] - gf_net) / es["budget_stress"]["scale"]) if gf_net is not None and not pd.isna(gf_net) else 0.0
        sav_idx = clamp((esco_sav[1] / e25 - es["savings_per_student_index"]["floor"]) / es["savings_per_student_index"]["span"]) if e25 else 0.0
        w = es["priority_weights"]
        esco_score = 100 * (w["budget_stress"] * stress + w["savings_per_student"] * sav_idx + w["inefficiency"] * ineff)

        uo = SZ["uptime_ops"]
        ops_base = addressable.at[i, FY1] if uo["base"] == "addressable" else (A["fn_51"].at[i, FY1] or 0)
        ops_rate = uo["savings_rate"]["base"] + uo["savings_rate"]["per_inefficiency"] * ineff
        fee_rate = uo["fee_rate"]["base"] + uo["fee_rate"]["per_inefficiency"] * ineff
        ops_sav, ops_fee = ops_rate * ops_base, fee_rate * ops_base
        ops_rng = [max(ops_rate - 0.03, 0) * ops_base, ops_sav, (ops_rate + 0.03) * ops_base]

        em = SZ["emaas"]
        em_ok = em["enrollment_min"] <= e25 <= em["enrollment_max"]
        em_pct = clamp(sp[1] - em["savings_offset_from_esco"], em["savings_min"], em["savings_max"])
        em_sav = em_pct * energy
        em_net = em_sav - em["annual_fee"]
        em_rng = [clamp(em_pct - 0.025, em["savings_min"], em["savings_max"]) * energy - em["annual_fee"], em_net,
                  clamp(em_pct + 0.025, em["savings_min"], em["savings_max"]) * energy - em["annual_fee"]]
        sizing = {
            "ratio": fnum(ratio, 3), "peerF51": fnum(f51_peer), "highCapital": bool(high_cap), "inefficiency": fnum(ineff, 3),
            "energy": fnum(energy), "gfNetPerStudent": fnum(gf_net),
            "esco": {"savingsPct": [round(x, 3) for x in sp], "savings": [fnum(v) for v in esco_sav], "multiple": mult,
                     "project": [fnum(v) for v in esco_proj], "score": fnum(esco_score, 1),
                     "components": {"budgetStress": round(stress, 3), "savingsIndex": round(sav_idx, 3), "inefficiency": round(ineff, 3)}},
            "ops": {"base": fnum(ops_base), "savingsRate": round(ops_rate, 3), "savings": [fnum(v) for v in ops_rng], "feeRate": round(fee_rate, 3),
                    "fee": fnum(ops_fee), "net": fnum(ops_sav - ops_fee)},
            "emaas": {"eligible": bool(em_ok), "savingsPct": round(em_pct, 3), "savings": fnum(em_sav), "fee": em["annual_fee"], "net": [fnum(v) for v in em_rng]},
        }

        # ---------- Energy Manager as a Service (EMaaS) lens ----------
        if em_ok and em_net > 0:
            strength = "Strong" if em_net >= 60000 else "Moderate" if em_net >= 30000 else "Weak"
            card("em-fit", "em", "Right-sized for a shared energy manager", strength,
                 f"With {e25:,.0f} students, a full-time energy manager is hard to justify, yet the district spent {money(energy)} on utilities in FY{FY1} "
                 f"({money(energy / e25)} per student). A shared energy manager focused on schedules, setpoints and bill audits typically pays for itself at this scale.",
                 energy, "/yr utilities", f"FY{FY1}", "District size and utility spend",
                 "Savings depend on current practices; a district that already manages schedules and bills closely will see less.",
                 "Who is responsible for energy management today, and how much of their time does it get?",
                 "TEA PEIMS actuals, Function 51 object 6259; Upchurch EMaaS sizing (internal)", value=em_net)
            if not pd.isna(dev) and dev >= 0.15 or (not pd.isna(g) and not pd.isna(pg) and g - pg >= 0.10):
                bits = []
                if not pd.isna(dev) and dev >= 0.15:
                    bits.append(f"{pct(dev, False)} above similar districts per student")
                if not pd.isna(g) and not pd.isna(pg) and g - pg >= 0.10:
                    bits.append(f"growing {((g - pg) * 100):.0f} points faster than peers since FY2019")
                card("em-utility", "em", "Utility costs worth managing", "Moderate" if len(bits) == 2 else "Weak",
                     f"Utility spending is {' and '.join(bits)}.", None, "", f"FY2019–FY{FY1}", cmp_ops,
                     "Could also reflect building type, climate or rate structure rather than management.",
                     "Which campuses use the most energy, and is anyone reviewing monthly bills?",
                     "TEA PEIMS actuals, Function 51 object 6259", value=dev if not pd.isna(dev) else None)
            if gf_net is not None and not pd.isna(gf_net) and gf_net < 0:
                card("em-budget", "em", "General-fund operating deficit", "Moderate" if gf_net < -250 else "Weak",
                     f"General-fund operating spending exceeded operating revenue by {money(-gf_net)} per student in FY{FY1} "
                     f"({money(-gf_net * e25)} in total).", -gf_net * e25, "operating gap", f"FY{FY1}", "District budget",
                     "One-year gaps can be planned uses of fund balance (including capital paid from the general fund); check the adopted budget. Many Texas districts ran deficits in FY2025.",
                     "What cost-reduction options is the board considering?",
                     "TEA PEIMS actuals, general fund", value=-gf_net)

        # ---------- mixed recent bond results ----------
        keys = {c["key"] for c in cards}
        if {"cap-failed", "cap-passed"} <= keys:
            rec = [b for b in (bd.itertuples() if bd is not None else []) if (today - b.electiondate).days <= 3 * 365 and b.result in ("Carried", "Defeated")]
            passed_amt = sum(b.amount for b in rec if b.result == "Carried"); failed_amt = sum(b.amount for b in rec if b.result == "Defeated")
            cards[:] = [c for c in cards if c["key"] not in ("cap-failed", "cap-passed")]
            card("cap-mixed", "cap", "Mixed recent bond results", "Moderate",
                 f"In the last three years voters approved {money(passed_amt)} and rejected {money(failed_amt)} across "
                 f"{len(rec)} propositions. See the bond record for each proposition.",
                 passed_amt + failed_amt, "on recent ballots", "Last 36 months", "District history",
                 "Different propositions or elections produced different outcomes; the failed items may return in revised form.",
                 "Which needs from the failed propositions are still unfunded?", "Texas Bond Review Board bond election results", value=None)

        # ---------- data-quality guards: flag, never silently drop ----------
        dq = []
        ew = E.loc[i, FY1 - 6:FY1]
        yoy = (ew / ew.shift(1) - 1).dropna()
        if len(yoy) and (yoy.abs() > 0.40).any() and ew.min() >= 150:
            yrs = [int(y) for y, v in yoy.items() if abs(v) > 0.40]
            dq.append(f"Enrollment changed more than 40% in one year (FY{', FY'.join(str(y) for y in yrs)}); possible restructuring, merger or virtual-program enrollment.")
        miss = [y for y in range(2016, FY1 + 1) if pd.isna(E.at[i, y]) or pd.isna(A["fn_51"].at[i, y])]
        if miss:
            dq.append(f"Missing financial or enrollment data for FY{', FY'.join(str(y) for y in miss)}.")
        for label, ser in (("utilities", util_ps.loc[i, 2016:FY1]), ("plant operations", ctrl_ps.loc[i, 2016:FY1])):
            sv = ser.dropna()
            if len(sv) >= 5 and sv.median() > 0:
                odd = [int(y) for y, v in sv.items() if v > 2.5 * sv.median() or v < 0.4 * sv.median()]
                if odd:
                    dq.append(f"Unusual {label} amount per student in FY{', FY'.join(str(y) for y in odd)} (more than 2.5× or under 0.4× the district's typical year).")
        for c in cards:
            g = GUIDE.get(c["key"], {})
            c["questions"] = g.get("questions", [c["question"]])  # full guidance ships once in meta.guide
            if dq:
                c["dq"] = True
                if c["strength"] == "Strong":
                    c["strength"] = "Moderate"
            if c["key"] == "cap-capacity":
                c["rate"] = fnum(isr, 4)

        if small:
            cards.clear()

        # ---------- per-lens radar summary ----------
        order = {"Strong": 3, "Moderate": 2, "Weak": 1}
        lens_summary = {}
        for lens in ("pc", "om", "cap", "em"):
            cs = [c for c in cards if c["lens"] == lens]
            top = max((order[c["strength"]] for c in cs), default=0)
            if not cs:
                ev = None
            elif top == 3 and len(cs) >= 2:
                ev = "Strong"
            elif top >= 2 or len(cs) >= 2:
                ev = "Moderate"
            else:
                ev = "Limited"
            if ev and e25 < 1000 and ev != "Limited":
                ev = {"Strong": "Moderate", "Moderate": "Limited"}[ev]
            near = any(c["key"] in ("om-budget", "cap-passed", "cap-failed", "cap-mixed") or (c["key"] == "cap-retire" and c["strength"] == "Strong") for c in cs)
            need = 3 if lens == "cap" else 2   # capital signals are common; ask for more agreement
            priority = bool(cs) and not dq and (ev == "Strong" or (len(cs) >= need and ev == "Moderate"))
            if lens == "em":  # fit must be Moderate+ (net >= $30K) and backed by a utility or budget signal
                fit = next((c for c in cs if c["key"] == "em-fit"), None)
                priority = bool(fit) and fit["strength"] != "Weak" and not dq and len(cs) >= 2
            lens_summary[lens] = {"keys": [c["key"] for c in cs], "evidence": ev, "priority": priority, "nearTerm": near}
        lens_summary["pc"]["magnitude"] = sizing["esco"]["project"][1]
        lens_summary["om"]["magnitude"] = sizing["ops"]["fee"]
        lens_summary["em"]["magnitude"] = sizing["emaas"]["net"][1] if sizing["emaas"]["eligible"] else None
        lens_summary["em"]["headline"] = fnum(energy / e25) if e25 else None
        lens_summary["em"]["pctl"] = None
        lens_summary["em"]["timing"] = None
        lens_summary["pc"]["score"] = sizing["esco"]["score"]
        lens_summary["cap"]["magnitude"] = fnum(dbt["retire5"]) if dbt else None
        lens_summary["pc"]["headline"] = fnum(u25)
        lens_summary["om"]["headline"] = fnum(c25)
        lens_summary["cap"]["headline"] = fnum(yrs_since, 1) if not pd.isna(yrs_since) else None
        lens_summary["pc"]["pctl"] = None
        lens_summary["om"]["pctl"] = None
        tl = []
        if not pd.isna(bchg):
            tl.append(f"FY{BUDGET_FY} plant budget {pct(bchg)}")
        lens_summary["pc"]["timing"] = tl[0] if tl else None
        lens_summary["om"]["timing"] = tl[0] if tl else None
        if bd is not None and len(bd):
            le = bd.iloc[-1]
            lens_summary["cap"]["timing"] = f"Last election {le.electiondate:%b %Y} · {'passed' if le.result == 'Carried' else le.result.lower()}"
        else:
            lens_summary["cap"]["timing"] = None

        def ser(t, nd=0):
            return [fnum(t.at[i, y], nd) if i in t.index else None for y in YEARS]

        tx = TX.get(i)
        districts_out.append({
            "id": i, "name": row["name"], "county": str(row["county"]).title().replace(" County", ""),
            "region": fnum(row["region"]), "locale": row.get("locale") if isinstance(row.get("locale"), str) else None,
            "localeDetail": row.get("locale_detail") if isinstance(row.get("locale_detail"), str) else None,
            "charter": is_ch, "campuses": fnum(row["campuses"]),
            "campusTypes": {k.replace("campuses_", ""): fnum(row[k]) for k in row.index if k.startswith("campuses_") and fnum(row[k])},
            "superintendent": row["superintendent"] if isinstance(row["superintendent"], str) else None,
            "website": row["website"] if isinstance(row["website"], str) else None,
            "rating": row.get("rating") if isinstance(row.get("rating"), str) else None,
            "lat": fnum(row["lat"], 4), "lon": fnum(row["lon"], 4),
            "s": {
                "enroll": ser(E), "f51": ser(A["fn_51"]), "staff": ser(A["f51_staff"]), "util": ser(A["f51_utilities"]),
                "repair": ser(A["f51_contract_repair"]), "services": ser(A["f51_contract_other"]), "supplies": ser(A["f51_supplies"]),
                "insurance": ser(A["f51_insurance"]), "otherOp": ser(A["f51_other_operating"]), "capital51": ser(A["f51_capital"]),
                "fn81": ser(A["fn_81"]), "capitalAll": ser(A["capital_all"]), "total": ser(A["total_exp"]),
                "transport": ser(A["fn_34"]), "security": ser(A["fn_52"]), "dataProc": ser(A["fn_53"]), "instruction": ser(A["fn_11"]),
            },
            "budget": {"f51": {str(y): fnum(B51.at[i, y]) for y in (FY1, BUDGET_FY) if i in B51.index and y in B51.columns and not pd.isna(B51.at[i, y])},
                       "services": {str(y): fnum(BSV.at[i, y]) for y in (FY1, BUDGET_FY) if i in BSV.index and y in BSV.columns and not pd.isna(BSV.at[i, y])}},
            "tax": {"fy": tx.fy.tolist(), "mo": [fnum(x, 4) for x in tx.mo_rate], "is": [fnum(x, 4) for x in tx.is_rate]} if tx is not None else None,
            "pv": {"taxYear": [int(y) for y in PVW.columns], "value": [fnum(PVW.at[i, y]) if i in PVW.index else None for y in PVW.columns]},
            "bonds": [{"date": f"{r.electiondate:%Y-%m-%d}", "amount": fnum(r.amount), "purpose": r.purposedescription if isinstance(r.purposedescription, str) else r.purpose,
                       "for": fnum(r.votesfor), "against": fnum(r.votesagainst), "result": r.result} for r in (bd.itertuples() if bd is not None else [])],
            "debt": ({"fy": DEBT_FY, "principal": fnum(dbt["principal"]), "interest": fnum(dbt["interest"]),
                      "retire1": fnum(dbt["retire1"]), "retire3": fnum(dbt["retire3"]), "retire5": fnum(dbt["retire5"]),
                      "profile": [[y, fnum(v)] for y, v in dbt["profile"]]} if dbt else None),
            "peers": {"ops": peers_ops[i], "cap": peers_cap[i]},
            "cards": cards,
            "tooSmall": bool(small),
            "dq": dq,
            "lens": lens_summary,
            "sizing": sizing,
            "tips": ({"since": TIPS.at[i, "tips_since"] if isinstance(TIPS.at[i, "tips_since"], str) else None,
                      "contacts": json.loads(TIPS.at[i, "tips_contacts"])} if i in TIPS.index else None),
            "_ops_raw": {"ineff": ineff, "f51ps": f51p, "benefit_ps": (ops_sav - ops_fee) / e25 if e25 else None},
            "_em_raw": {"net": em_net, "f51ps": f51p, "capps": cap_ps.get(i), "enr": e25} if em_ok else None,
        })

    # Uptime Ops and EMaaS model scores: workbook weights, normalized with 5th–95th percentile clipping (not min–max)
    def norm(vals):
        v = pd.Series([x for x in vals if x is not None and not pd.isna(x)])
        lo, hi = (v.quantile(0.05), v.quantile(0.95)) if len(v) else (0, 1)
        return lambda x: clamp((x - lo) / (hi - lo)) if x is not None and not pd.isna(x) and hi > lo else 0.0
    eligible = [x for x in districts_out if not x["tooSmall"]]
    nf = norm([x["_ops_raw"]["f51ps"] for x in eligible]); nb = norm([x["_ops_raw"]["benefit_ps"] for x in eligible])
    wo = SZ["uptime_ops"]["priority_weights"]
    for x in districts_out:
        r = x.pop("_ops_raw")
        x["sizing"]["ops"]["score"] = round(100 * (wo["inefficiency"] * r["ineff"] + wo["f51_per_student"] * nf(r["f51ps"]) + wo["benefit_per_student"] * nb(r["benefit_ps"])), 1)
        x["lens"]["om"]["score"] = x["sizing"]["ops"]["score"]
    ems = [x for x in districts_out if x["_em_raw"]]
    we = SZ["emaas"]["priority_weights"]
    n1, n2, n3, n4 = (norm([x["_em_raw"][k] for x in ems]) for k in ("net", "f51ps", "capps", "enr"))
    for x in districts_out:
        r = x.pop("_em_raw")
        x["sizing"]["emaas"]["score"] = round(100 * (we["net_benefit"] * n1(r["net"]) + we["f51_per_student"] * n2(r["f51ps"]) + we["capital_per_student"] * n3(r["capps"]) + we["enrollment"] * n4(r["enr"])), 1) if r else None
        x["lens"]["em"]["score"] = x["sizing"]["emaas"]["score"]
        x["lens"]["cap"]["score"] = None

    # percentile of headline vs ops peers
    byid = {x["id"]: x for x in districts_out}
    for x in districts_out:
        for lens in ("pc", "om"):
            v = x["lens"][lens]["headline"]
            pv_ = [byid[p]["lens"][lens]["headline"] for p in x["peers"]["ops"] if p in byid and byid[p]["lens"][lens]["headline"] is not None]
            if v is not None and pv_:
                x["lens"][lens]["pctl"] = round(100 * sum(1 for q in pv_ if q < v) / len(pv_))

    bundle = {
        "meta": {
            "built": dt.datetime.now().isoformat(timespec="seconds"),
            "years": YEARS, "budgetFy": BUDGET_FY, "debtFy": DEBT_FY, "kPeers": K_PEERS,
            "freshness": {
                "peims": f"PEIMS actuals FY{FY1}", "budget": f"PEIMS budget FY{BUDGET_FY}",
                "bonds": f"Bond elections through {bonds.electiondate.max():%b %Y}", "debt": f"Debt outstanding FY{DEBT_FY}",
                "tax": f"Tax rates {int(tax.fy.max())-1}-{str(int(tax.fy.max()))[2:]}",
                "pv": f"Property values TY{pv_latest_year} ({pv_status})", "campuses": "TEA campuses 2024-25",
                "rating": "TEA A–F 2026",
                "tips": TIPS_ASOF,
            },
            "thresholds": THRESH,
            "guide": GUIDE,
            "sizing": SZ,
        },
        "districts": districts_out,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bundle, separators=(",", ":"), allow_nan=False))
    n = len(districts_out)
    big = [x for x in districts_out if (x["s"]["enroll"][-1] or 0) >= 1000 and not x["charter"]]
    print(f"ISDs with 1,000+ students: {len(big)}")
    from collections import Counter as C2
    print("  per signal:", {k: f"{v} ({v/len(big)*100:.0f}%)" for k, v in C2(c["key"] for x in big for c in x["cards"]).most_common()})
    for lens in ("pc", "om", "cap", "em"):
        pr = sum(1 for x in districts_out if x["lens"][lens]["priority"])
        print(f"  {lens}: {pr} priority districts")
    print(f"  data-quality flags: {sum(1 for x in districts_out if x['dq'])} districts")
    for lens in ("pc", "om", "cap", "em"):
        fired = sum(1 for x in districts_out if x["lens"][lens]["keys"])
        strong = sum(1 for x in districts_out if x["lens"][lens]["evidence"] == "Strong")
        print(f"{lens}: {fired} of {n} districts with ≥1 signal ({strong} strong evidence)")
    from collections import Counter
    print(Counter(c["key"] for x in districts_out for c in x["cards"]))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
