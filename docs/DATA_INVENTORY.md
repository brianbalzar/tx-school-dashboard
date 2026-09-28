# Data inventory: Texas school district opportunity intelligence

*What's downloaded in `data/raw/` as of September 28, 2026, what each source can show, and what it can't. It's written so Codex and Claude Design can plan views and exports without opening the raw files.*

**Product goal:** help Upchurch arrive at a district meeting with a specific, evidence-backed hypothesis for **performance contracting**, **facilities O&M**, or **facility condition assessment (FCA) / bond planning**, and export it as a one-pager or individual graphics.

---

## At a glance

| # | Dataset | Unit of data | Years | Lens it feeds most |
|---|---|---|---|---|
| 1 | PEIMS summarized actuals | district × year | FY2009–FY2025 | all (baseline spending, enrollment) |
| 2 | **PEIMS detail actuals** | district × fund × function × object × org × year | FY2000–FY2025 | **Perf. contracting, O&M** |
| 3 | PEIMS detail budgets | same as #2 | FY2000–FY2026 | all (this year's plan versus history) |
| 4 | Adopted tax rates (M&O, I&S) | district × year | school years 2005-06 → 2023-24 | FCA / bond |
| 5 | Property values (Comptroller) | district × tax year | 2010–2024 final, 2025 preliminary | FCA / bond |
| 6 | **Bond elections** | proposition | 1958 → May 2026 | **FCA / bond** |
| 7 | **Debt outstanding** | debt issue × fiscal year | FY2016–FY2025 | **FCA / bond** |
| 8 | Campus locations + directory | campus | 2024-25 | all (portfolio size, maps, contacts) |
| 9 | District boundaries | district polygon | 2026 | maps |
| 10 | Education service center (ESC) regions | region polygon | 2024 | maps, regional medians |
| 11 | Federal district directory (NCES) | district | 2024 | peer grouping (urban/rural), staffing |
| 12 | Federal school directory (NCES) | campus | 2024 | campus level, enrollment, school-lunch share |
| 13 | Federal district finance (NCES F-33) | district | FY2020 | **energy utilities, separate from other utilities** |
| — | Census demographics (ACS) | district | not pulled yet | growth context (needs API key) |
| — | A–F accountability, TAPR, School FIRST | district / campus | manual, not pulled yet | context only |

---

## 1. PEIMS summarized actual financial data (TEA)
`data/raw/peims_summary/peims_summarized_2009-2025.xlsx` · ~20.6k rows

- **Unit of data:** one row per district per fiscal year. ~1,200 districts plus charters; FY = school year end (FY2025 = 2024-25).
- **Fields:** ~140 columns; every measure appears as General Fund and All Funds. The dashboard uses All Funds.
  - Revenue: local M&O tax, state, federal, total.
  - Spending by object: payroll, contracted services, supplies, other operating, debt service, capital projects.
  - Spending by function: instruction, transportation (34), food service (35), **plant maintenance & operations (51)**, security (52), data processing (53), and others.
  - Spending by program.
  - Fall enrollment.
- **Already in the current dashboard** through `src/data/districts.csv.py`.
- **Caveat:** function totals only. Function 51 lumps utilities, custodial, maintenance labor, contracts and insurance together; source #2 breaks that out.

## 2–3. PEIMS detail, actuals and budgets (TEA) — the key source for performance contracting and O&M
`data/raw/peims_detail/{actual,budget}/{district,charter}_{actual,budget}_fy####.(zip|csv)` · ~5.3M rows per year (district actuals)

- **Unit of data:** district × fund × function × object × organization × program × year, with an amount.
- **Columns:** `DISTRICT, FUND, FUNDYEAR, FUNCTION, OBJECT, FIN_UNIT, PROGRAM_INTENT, ACTAMT` (budgets use `BUDGAMT`). Charter files use `CS_NONPROF_*` column names.
- **Object codes are rolled up to 3 digits plus 9** in the public file. So `6259` = all utilities (object group 625x: electricity, gas, water/wastewater, telephone), **not electricity alone**. Verified on FY2025: no district reports 6257 (electricity) on its own.

FY2025 statewide Function 51 (plant maintenance & operations), all funds, districts only = **$7.0B**:

| Object | What it is | FY2025 statewide |
|---|---|---|
| 6129 | Support-staff salaries (custodial, maintenance, grounds) | $1.97B |
| **6259** | **Utilities (all types combined)** | **$1.56B** |
| 6429 | Insurance and bonding (property/casualty) | $0.81B |
| 6249 | Contracted maintenance and repair | $0.64B |
| 6319 | Maintenance and operations supplies | $0.39B |
| 6299 | Miscellaneous contracted services | $0.30B |
| 614x | Payroll benefits (TRS, health, workers' comp) | ~$0.43B |
| 66xx | Capital outlay charged to Function 51 | ~$0.34B |

- 99% of all utility dollars are coded to Function 51, so "utilities per student" is clean.
- **Organization (`FIN_UNIT`) = campus or department,** but only ~30% of Function 51 is attributed to a campus. 68% sits in 999 (district-wide). Treat campus-level facilities cost as partial and not comparable across districts.
- **Budget files run through FY2026 (the current school year),** so we can show "planned versus historical": "FY2026 facilities budget is up 9% over FY2025 actuals."
- **Gaps:** FY2003 charter budget file (link label not matched; retry pending). Charters have much less history.
- **Volume:** ~900 MB zipped for all years. Git-ignored and re-downloaded with `scripts/fetch_data.py peims_detail`. It needs pre-aggregation to a small district × year × function × object-group table before the site can use it.

**What this unlocks, by lens**
- *Performance contracting:* utility spend per student and trend; utilities as a share of Function 51; addressable annual utility dollars (the savings base).
- *O&M:* in-house labor (6129 + 614x) versus contracted repair (6249/6299) mix and trend; supplies; insurance cost growth; Function 51 volatility.
- *FCA:* capital outlay inside Function 51 (patch-and-repair spending), plus capital projects fund (fund 6xx) spending by year.

## 4. Adopted tax rates (TEA)
`data/raw/tax_rates/adopted_tax_rates_2006-2024.xlsx` · 1,015 districts

- **Unit of data:** district; wide format with M&O and I&S rate per school year, **2005-06 through 2023-24**. The file name says 2024, but the last column is the 2023-24 school year.
- **Uses:** I&S rate level and trend (debt-service tax headroom; the bond-election cap is $0.50 for new debt), and M&O compression history.
- **Gap:** no 2024-25 or 2025-26 rates yet. TEA hasn't posted them in this file.

## 5. Property values (Comptroller Property Tax Assistance Division, via TEA)
`data/raw/property_values/cptd_{year}_{final|preliminary}.(xlsx|xls)` · ~1,015 districts per year

- **Unit of data:** district × tax year; 2010–2024 final, 2025 preliminary. **2009 is missing** (dead TEA link).
- **Fields:** several taxable-value definitions (T1–T8), local roll value, value used for school funding. Use **T2** (after homestead exemption) for M&O and **T8** for I&S debt capacity.
- **Uses:** property value per student (tax base, bond capacity), value growth, debt-to-value ratio (with #7).
- **Caveat:** the layout changed over the years (`.xls` before 2019, different header rows), so it needs a per-year parser.

## 6. Bond elections (Texas Bond Review Board, via data.texas.gov)
`data/raw/bonds/bond_elections_isd.csv` · 5,059 propositions, school districts only

- **Unit of data:** one row per proposition. Election dates 1958 → **May 2, 2026**.
- **Fields:** `governmentname, county, electiondate, amount, purpose, purposedescription, propnumber, votesfor, votesagainst, result, estimatedtotaldebtservice, estimatedinterest, minimumannualdebtservice`.
- **Results:** Carried 3,587 · Defeated 1,405 · Cancelled 59.
- **Purpose:** Building 3,302 · Other 1,431 · Renovations 209 · Refund 101. `purposedescription` is free text, e.g. "School Building," "Athletic Facilities," "Technology."
- **Uses:** years since last passed bond; recent failures; vote margin; amount per student; peer bond activity; failed-then-passed patterns.
- **Caveat:** joins by district *name*, not number. It needs a name-matching crosswalk (Cayuga ISD ↔ 001902).

## 7. Debt outstanding by issuance (Texas Bond Review Board, via data.texas.gov)
`data/raw/bonds/debt_outstanding_by_issuance_isd.csv` · 39,882 rows, 947 districts

- **Unit of data:** debt issue × fiscal year, FY2016–FY2025 (~4,000 issues per year).
- **Fields:** issue name, purpose (Educational facilities/equipment versus refunding), closing date, **maturity date, last principal payment**, pledge type (GO / limited tax / revenue).
  - Principal, interest and total debt service outstanding.
  - The district's M&O, I&S and total tax rate; taxable value; budgeted expenditures; student headcount.
  - Average daily attendance and its 5-year growth.
  - Precomputed ratios: GO debt ÷ taxable value, debt per student, debt service ÷ expenditures.
- **Uses:**
  - Debt burden versus peers.
  - **Debt roll-off: when existing issues mature, which frees I&S capacity for a new bond without a rate increase.** This is the strongest bond-timing signal we have.
  - Also a cross-check on tax rate and value data.
- **Caveat:** name-based join like #6. Only 947 of ~1,020 districts carry any debt; the rest are debt-free, which is itself a signal.

## 8. Campus locations + directory (TEA School District Locator)
`data/raw/geo/campuses_2025.geojson` · 9,739 campuses, 2024-25

- **Fields:**
  - Campus number and name; district number and name; point location (geocoded).
  - Site address; grade range; school type (elementary/middle/high).
  - Instruction type; charter/magnet/alternative-education/residential flags.
  - **Enrollment as of October.**
  - **Superintendent and principal names; phone; email; web address.**
- **Uses:** campus count per district, facility portfolio mix, geographic spread (drive distance between campuses as an O&M complexity proxy), campus map on the district page, and contacts for outreach.
- **Caveat:** ~20 extra geocoder columns are noise and get dropped in the transform. Contact names are public directory data but go stale; always show the as-of date.

## 9–10. District boundaries and ESC regions (TEA)
`data/raw/geo/school_districts_2026.geojson` (1,017 districts; charters have no boundaries) · `data/raw/geo/esc_regions_2024.geojson` (20 regions)

- **Fields:** district number, name, Census geography ID, NCES district ID.
- **Uses:** a real district-level choropleth instead of today's county medians, and regional medians.
- **Caveat:** 42 MB at full resolution; needs simplifying to about 1–2 MB for the web.

## 11–12. Federal district and school directories (NCES Common Core of Data, via Urban Institute API)
`data/raw/nces/ccd_district_directory_2024.csv` (1,243 rows, 69 columns) · `ccd_school_directory_2024.csv` (9,774 rows, 52 columns)

- **District fields:**
  - **urban-centric locale** (city/suburb/town/rural × size), metro area.
  - Number of schools, enrollment.
  - Staff FTEs by type, teachers, English learners, special ed.
  - Coordinates.
- **School fields:** locale, level, enrollment, teachers, free/reduced-price lunch, Title I, virtual/magnet/charter.
- **Uses:** **peer grouping** (enrollment band + locale + region is a far better "similar districts" definition than enrollment alone); staffing ratios.
- **Join:** `state_leaid` ↔ TEA district number.

## 13. Federal district finance survey (NCES F-33)
`data/raw/nces/ccd_district_finance_2020.csv` · 1,237 districts, 163 columns, FY2020 only

- **Has `exp_utilities_energy`, energy utilities split from telephone and water,** which PEIMS detail can't do. Also has operation-of-plant spending, capital construction spending and long-term debt issued/retired.
- **Uses:** measure what share of PEIMS 6259 is actually energy for each district, rather than assuming.
- **Options:** pull more F-33 years (the API goes back decades) for a trend. The federal data runs about 4 years behind.

---

## Not yet pulled

| Source | Status | What it would add |
|---|---|---|
| Census demographics (ACS) | needs free API key (`data/MANUAL_DOWNLOADS.md` §1) | population and housing growth, median income, median housing age (a proxy for community age, not school buildings) |
| A–F accountability ratings | manual download | context for the district conversation; not a facilities signal |
| TAPR district data | manual download | staffing, class size; minor for facilities |
| School FIRST financial rating | no statewide export | financial management grade; supports "can they take on a performance contract" |

## What public data can't tell us

- **Building age, square footage, system condition (roof, HVAC, controls), energy use in kWh/therms.** No statewide public source exists. Per-student spending is the stand-in, and every brief should say so. These are the natural discovery questions for the meeting.
- **Electricity versus gas versus water separately in PEIMS** (rolled up to 6259). F-33 gives energy-only for one year per pull.
- **Which campuses a bond will touch.** The bond purpose text is general.

---

## Joins (the transform step has to handle these)

| Key | Sources |
|---|---|
| TEA 6-digit district number (`001902`) | PEIMS summary/detail, tax rates, property values, campuses, boundaries, NCES `state_leaid` (after stripping the prefix) |
| District **name** only | bond elections, debt outstanding → needs a name crosswalk (normalize "ISD"/"CISD", punctuation; hand-fix the rest) |
| TEA 9-digit campus number | campuses ↔ PEIMS `FIN_UNIT` (campus suffix) ↔ NCES school `seasch` |
| Fiscal year vs tax year vs school year | FY2025 = school year 2024-25 = tax year 2024. Align everything to FY. |

## Candidate metrics for the three lenses

**Performance contracting**

- Utilities (6259) $/student, 5- and 10-year change, peer percentile
- Utilities as a share of Function 51
- Addressable annual utility dollars
- FY2026 budget versus FY2025 actual for utilities
- Campus count

**O&M**

- Function 51 $/student and peer percentile
- In-house facilities payroll versus contracted repair mix and trend
- Supplies and insurance trend
- Year-to-year volatility
- Campuses per 1,000 students
- Enrollment change versus Function 51 change

**FCA / bond planning**

- Years since last passed bond; recent defeated bonds
- Debt $/student, debt ÷ property value
- **Debt retiring in the next 1/3/5 years**
- I&S rate and trend
- Property value per student and growth
- Capital outlay trend (low = possible deferred investment)
- Enrollment growth
- Peer districts' recent bonds

**Timing flags** (for any lens)

- Bond election in the last 12 months (passed → spending money; failed → rethinking plan)
- Budget jump in FY2026
- Debt retiring soon

---

## Build notes (September 28, 2026)

Processed tables live in `data/processed/` (built by `scripts/build_reference.py` and `scripts/build_peims_detail.py`).

- **Budget files stop at 2-digit object groups** (6100 payroll, 6200 purchased services, 6300 supplies, 6400 other, 6600 capital). **Utilities can't be separated in budgets**, so there is no "FY2026 utility budget". The budget comparison available is Function 51 total and Function 51 purchased services (62xx, which includes utilities).
- **Detail versus summary:** Function 51 totals from the detail files match the summarized file within 0.5% statewide, but differ by a median ~1% per district (25% of districts differ by more than 5%). Use detail consistently for Function 51 components. Don't mix the two sources in one chart.
- **FY2020 is the COVID-disrupted year** (spring 2020 closures). FY2021 (2020-21) utilities were near normal: statewide median growth FY2019→FY2025 is 22.7% versus 21.9% for FY2021→FY2025. Avoid FY2020 as a baseline; FY2019 or FY2021 are both fine.
- **Bond elections matched to TEA IDs:** 5,054 of 5,059 propositions; the 5 unmatched are pre-2010 elections of consolidated districts. Debt joins directly via the BRB `govid` (= TEA county-district number).
- **Debt retirement:** BRB data has each issue's outstanding principal and final maturity, **not an annual amortization schedule**. "Principal on issues fully retired by year X" understates retirement. A straight-line estimate between now and final maturity is closer. Label it as an estimate.
- **Summary file IDs** now carry a leading apostrophe (`'001902`); strip it before joining.
- **Locale** comes from NCES and sometimes surprises (Keller ISD is coded "City: large"). Use it as one peer input, not the only one.

### Calibration snapshot (FY2025, ISDs with 1,000+ students, n = 510)

| Measure | P10 | P25 | Median | P75 | P90 |
|---|---|---|---|---|---|
| Utilities per student | $244 | $279 | $333 | $398 | $469 |
| Plant M&O (Function 51) per student | $1,137 | $1,274 | $1,521 | $1,809 | $2,226 |

- Utilities are a median **22%** of Function 51.
- **29%** of these districts sit ≥12% above their enrollment-band × locale peer median on utilities per student. The Claude Design threshold would surface too many; start nearer the top quartile of peer deviation.
