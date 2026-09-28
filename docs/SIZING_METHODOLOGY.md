# Opportunity sizing methodology (internal)

Sizing ports the ESCO, Uptime Ops and EaaS logic from `texas_esco_priority.xlsx` into `scripts/build_app_data.py`. All assumptions live in `config/sizing.json`: edit that file and rerun `npm run data` and then `npm run encrypt`. Sizing ships only inside the encrypted bundle, and it never appears on the client-facing brief.

These are order-of-magnitude estimates for ranking and meeting prep. They are not quotes.

## Shared inputs (FY2025)

| Input | Definition |
|---|---|
| Plant O&M ratio | Function 51 per student ÷ median of the district's 20 operations peers. The workbook used a statewide mean, which tiny districts skew. |
| Inefficiency index | `clamp((ratio − 0.95) / 0.45, 0, 1)`, then × 0.9 if capital outlay per student is in the top quartile |
| Energy basis | PEIMS utilities (object 6259) × `energy_share` (1.0). This includes water, wastewater and telephone. NCES F-33 "energy" can't split it out because F-33 also counts vehicle fuel (it runs a median 17% above 6259). |
| General-fund margin | General-fund operating revenue − operating expenditures, per student. The workbook used all-funds totals, which include bond construction. |
| Addressable O&M | Plant staff (61xx) + contracted repair (6249) + other contracted services + supplies. Excludes utilities, insurance and capital. |

## ESCO project (Performance Contracting lens)

- **Savings rate by plant O&M ratio:** ≤0.90×: 10%; ≤1.05×: 15%; ≤1.20×: 20%; ≤1.40×: 25%; above that: 30%.
  - The low and high cases use the adjacent bands.
  - The rate drops 5 points if capital spending is high. The floor is 10%.
- **Project value** = annual savings × a multiple by enrollment: under 1,000: 10×; under 2,500: 12×; under 7,500: 14×; 7,500 and up: 15×.
- **Score (0–100)** = 45% budget stress + 35% savings per student + 20% inefficiency.
  - Budget stress = `clamp((250 − GF margin per student) / 1000)`.
  - Savings per student = `clamp((savings/student − 40) / 160)`.
- **Radar magnitude:** base-case project value.

## Uptime Ops (Facilities O&M lens)

- **Savings rate** = 8% + 14% × inefficiency, with a ±3-point range. **Fee** = 6% + 6% × inefficiency. Both apply to addressable O&M.
  - Set `uptime_ops.base` to `f51_total` to restore the workbook's all-of-Function-51 base.
- **Score** = 50% inefficiency + 30% Function 51 per student + 20% net benefit per student. Each input is rescaled between its 5th and 95th percentile.
- **Radar magnitude:** annual fee.

## Energy Manager as a Service (EMaaS lens)

This lens provides a shared or part-time energy manager to districts where a full-time hire doesn't pay off.

- **Eligible:** 1,000–3,000 students.
- **Savings** = ESCO base rate − 10 points, held between 5% and 10% of the energy basis, with a ±2.5-point range. **Net** = savings − $25,000 annual fee.
- **Signals:**
  - *Right-sized*: net > 0. Strong if net ≥ $60K, Moderate if net ≥ $30K.
  - Supporting signals fire only when right-sized fires:
    - *Utility costs worth managing*: ≥15% above peers per student, or growth ≥10 points faster than peers.
    - *General-fund deficit*.
- **Priority:** right-sized at Moderate or Strong, plus at least one supporting signal, and no data-continuity flags.
- **Score** = 40% net + 25% Function 51 per student + 20% capital per student + 15% enrollment (percentile-scaled).
- The client-facing finding cites utilities and district size, never the fee or net.

## Workbook issues fixed in the port

- The bond-failure lookup searched for "Failed", but the Bond Review Board records use "Defeated", so failed bonds were never detected.
- The UpTimeOps sheet's AF2 referenced column J instead of AF.
- Plant O&M was compared with a statewide mean, which tiny districts skew. It now uses a peer median.
- Budget stress used all-funds totals. It now uses general-fund operating figures.
- Uptime Ops was applied to all of Function 51, which overlapped the ESCO utility savings.
- Scores used min–max normalization, which outliers distort. They now use percentile clipping.
- The AE territory lens was dropped because the territories are out of date.

## TIPS

`build_reference.py` reads `data/raw/reference/tips_members_*.xlsx` and uses the newest file. It matches members by 6-digit TEA number first, then by unique normalized name (549 matched). It keeps the join date and up to 8 contacts, primary contact first.

TIPS contacts are whoever registered with TIPS, often not facilities or finance staff. The contacts are internal-only. On the brief, TIPS appears only as "TIPS member (cooperative purchasing available)".
