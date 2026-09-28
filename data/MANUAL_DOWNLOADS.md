# Manual downloads

These sources can't be downloaded by `scripts/fetch_data.py`. They sit behind interactive forms or web apps, or they need a one-time account step. Do each one once a year, save the file where it says, and use the file name shown so later transform scripts can find it.

*Last checked: September 2026. TEA reorganizes its site often, so if a link breaks, search the page title on tea.texas.gov.*

| Source | Cadence | Save to |
|---|---|---|
| [1. Census API key](#1-census-api-key-one-time) | once | environment variable |
| [2. A–F accountability ratings](#2-af-accountability-ratings) | yearly, August | `data/raw/accountability/` |
| [3. TAPR district data](#3-tapr-district-data) | yearly, winter | `data/raw/tapr/` |
| [4. School FIRST financial ratings](#4-school-first-financial-ratings) | yearly, fall | `data/raw/first_ratings/` |
| [5. District directory (AskTED)](#5-district-directory-askted-optional) | optional | `data/raw/reference/` |
| [6. Known gaps](#6-known-gaps) | — | — |

---

## 1. Census API key (one-time)

The script's `acs` source needs a free key. Without one it skips the Census data and says so.

1. Request a key at <https://api.census.gov/data/key_signup.html>. It arrives by email within a few minutes, and you have to click the activation link.
2. In PowerShell, run:
   ```powershell
   setx CENSUS_API_KEY "your-key-here"
   ```
3. Open a **new** terminal, since `setx` only affects new sessions, then run `python scripts/fetch_data.py acs`.

For the GitHub Action, add the key as a repository secret named `CENSUS_API_KEY`.

## 2. A–F accountability ratings

District and campus ratings, domain scores and distinction designations.

1. Go to **TEA Accountability Data Downloads**: <https://rptsvr1.tea.texas.gov/perfreport/account/acct_download>
2. Pick the **School Year**. It's labeled by school year: 2024-25 holds the 2025 ratings.
3. Set **Report Level** to **District** and select every data category. Download.
4. Repeat with **Report Level** set to **Campus**.
5. Save the files as:
   ```
   data/raw/accountability/<school-year>_district.<ext>    e.g. 2024-25_district.csv
   data/raw/accountability/<school-year>_campus.<ext>
   ```
6. Keep the variable listing (the data-elements icon next to each category) as `data/raw/accountability/<school-year>_layout.xlsx`.

Note: TEA says 2024 ratings were delayed by litigation and may change. Download that year again after any court update.

## 3. TAPR district data

Texas Academic Performance Report data: staff, students, class size, attendance and graduation rates.

1. Go to <https://rptsvr1.tea.texas.gov/perfreport/tapr/tapr_dd_download.html?year=2025>. Change `year=` for other years; 2025 means 2024-25.
2. Choose the **district** level and download **all districts** statewide. Don't use "Districts by Region" or "Districts by County", which download pieces.
3. Select all data sets offered and download.
4. Save as `data/raw/tapr/<school-year>/` and keep the original file names inside that folder.
5. Also save the TAPR Glossary PDF from the same page into that folder. It's the variable dictionary.

## 4. School FIRST financial ratings

TEA's Financial Integrity Rating System of Texas: a yearly A/B/C/F financial management grade with an indicator-by-indicator score. TEA has no statewide spreadsheet for these.

- Final 2024-25 ratings were released in November 2025 ([TEA release](https://tea.texas.gov/about-tea/news-and-multimedia/news-releases/news-2025/tea-releases-final-2024-2025-financial-accountability-ratings)). They can be viewed per district on <https://txschools.gov/?lng=en> and through TEA's School FIRST page: <https://tea.texas.gov/data-reports/financial-compliance/financial-integrity-rating-system-texas-first>

Try these in order:

1. On the School FIRST page, open the ratings application, choose the rating year and look for a **statewide / all districts** report. If there's an export, save it as `data/raw/first_ratings/<school-year>_first_ratings.<ext>`.
2. If there's only a per-district view, don't copy 1,200 districts by hand. Tell Claude, and it can look into scripting the per-district pages or getting the list another way (for example a public information request to TEA's Financial Compliance Division).
3. Charter FIRST ratings are on a separate page: <https://tea.texas.gov/data-reports/financial-accountability/financial-integrity-rating-system-texas-first/charter-first-rating-open-enrollment-charter-schools-and-charter-schools-operated-public-institution-higher-education-ihe>

## 5. District directory (AskTED, optional)

The dashboard currently uses a 2023 extract, `data/raw/reference/district_information.csv`, for county and region. The `geo` source in the script gets current district boundaries whose attributes should cover this, so only refresh AskTED if you need superintendent contacts or mailing addresses.

1. Go to **AskTED**: <https://tea4avholly.tea.state.tx.us/TEA.AskTED.Web/Forms/Home.aspx>, then **Download School and District File**.
2. Choose **District** directory, all districts, and download the CSV.
3. Save as `data/raw/reference/askted_district_directory_<YYYY-MM-DD>.csv`.

## 6. Known gaps

- **Property values, tax year 2009:** TEA's link for this file returns 404 (checked September 2026). The Comptroller's School District Property Value Study archive (<https://comptroller.texas.gov/taxes/property-tax/pvs/>) may still have the 2009 final values. If you find it, save it as `data/raw/property_values/cptd_2009_final.<ext>`. The dashboard doesn't need it; tax years 2010–2025 are complete.

---

## Covered by the script (for reference)

| Source | Script source name | Publisher |
|---|---|---|
| Summarized PEIMS actuals | `peims_summary` | TEA |
| PEIMS budget and actual detail (fund/function/object), district and charter, 1999–2000 onward | `peims_detail` | TEA |
| Adopted M&O and I&S tax rates; property values by tax year (final and preliminary) | `tax_values` | TEA / Comptroller PTAD |
| Bond elections: date, amount, purpose, votes for/against, pass/fail, estimated debt service | `bonds` | Texas Bond Review Board (via data.texas.gov) |
| Debt outstanding by issuance and year, with debt-to-value and debt-per-student ratios | `bonds` | Texas Bond Review Board (via data.texas.gov) |
| District boundaries, campus locations, ESC regions | `geo` | TEA School District Locator (ArcGIS) |
| Population, income, poverty, housing units, housing age and home value by school district | `acs` | U.S. Census Bureau |
| District and school directories (locale, coordinates, staff) and federal district finance survey | `nces` | NCES Common Core of Data via the Urban Institute API |

The Comptroller discontinued its own Bond Election Roundup and now points to the Bond Review Board database. The `bonds` source pulls that database.
