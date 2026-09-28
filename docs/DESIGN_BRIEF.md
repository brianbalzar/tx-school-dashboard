# Design brief: Texas School District Opportunity Research

*For Claude Design. Covers the web app, chart exports and one-page briefs. Prepared September 2026. Data details: `docs/DATA_INVENTORY.md`.*

---

## 1. What we're building

> **An evidence-backed research and briefing system that helps Upchurch identify a Texas school district's likely facilities challenge, investigate it responsibly, prepare intelligent discovery questions, and export a polished, district-specific story for a meeting.**

Upchurch sells three services to school districts:

1. **Performance contracting**: infrastructure upgrades paid for by operating (mostly utility) savings.
2. **Facilities O&M**: operations and maintenance services.
3. **Facility condition assessments (FCA)**, often ahead of a bond election.

**Why it matters:** a district business official once told us she chose Upchurch because we had researched her district and came in trying to solve a problem they actually had. The product exists to make that the normal way we show up. Every screen should be judged by one test:

> *Could someone use this, with its title and source note, in a conversation with a district tomorrow?*

If not, it's exploratory clutter.

## 2. The boundary (make this visible in the product)

> **The dashboard identifies credible, evidence-backed hypotheses. It cannot diagnose building condition or guarantee savings without district-specific facility and utility data.**

What that means for design and copy:

- Findings are phrased as **observations + possible explanations + a question**, never as conclusions.
  - Right: "Utility costs grew faster than peers. This may reflect equipment condition, controls, rates, schedules or new campuses."
  - Wrong: "This district has inefficient HVAC."
- The bond/FCA lens is called **"Capital-planning signals"**, never "facility condition". No public dataset has building age, square footage or system condition.
- Every chart and brief carries a short caveat where one is needed, plus a methodology link.
- Missing data states plainly that it's missing. Never show a zero or a blank where the data doesn't exist.

## 3. Users and core workflow

**Users:** Upchurch business development, energy engineers and facility consultants, ~5–20 people. They're comfortable with data but short on time, and they often prepare the evening before a meeting.

**Primary workflow (the product's spine):**

```
1. Find        → Opportunity Radar: which districts surface under a business lens, and why
2. Understand  → District Research: the evidence behind each signal
3. Investigate → Operating profile, capital/bond profile, peers, district documents
4. Save        → Pin findings; mark each Include / Investigate / Explained / Not relevant / Follow up
5. Ask         → Turn findings into discovery questions
6. Export      → One-page brief, or individual graphics
```

Secondary: compare two to four districts side by side; look up a district by name straight from search.

## 4. Constraints the design has to respect

| Constraint | Design implication |
|---|---|
| Static site on GitHub Pages, **unlocked with a shared team key**; the site is encrypted and shows only a key prompt until unlocked | Design the unlock screen. Nothing about districts is visible before unlock. |
| **v1 has no server.** Notes, pins, dispositions and brief drafts are saved in the user's own browser only. | Show an honest "Saved on this device" indicator. Provide **Export / Import research file** (JSON) so work can be moved or shared. Shared team notes come in v2 (server with company sign-in). Design the notes UI now, but label its storage. |
| All costs are **per student**, not per square foot | Units on every number. A standing note: "Per-student figures; district square footage isn't publicly available." |
| Data freshness varies by source (FY2025 actuals, FY2026 budgets, bonds through May 2026, federal energy data FY2020) | A **freshness badge** on every chart and card, e.g. "PEIMS actuals FY2025". |
| ~1,200 districts × 17+ years; the table is the main analytical instrument | Dense, sortable, filterable tables with good keyboard use. The map supports geographic discovery; it doesn't dominate. |
| Shareable state | URLs keep the lens, filters, selected district and peer set. |

## 5. Pages

### 5.1 Unlock
Simple branded key prompt with a "Remember on this device" checkbox. It says nothing else about the site.

### 5.2 Opportunity Radar (landing page)
Answers "which districts should we look at, and why?"

- **Lens switcher** (prominent, one active at a time): Performance Contracting · Facilities O&M · Capital Planning (FCA/Bond).
- **Filters**, one row: search district · ESC region · enrollment band · locale (urban/suburban/town/rural) · fiscal year · include charters.
- **Summary tiles** for the current filter:
  - Districts with signals
  - Addressable dollars (e.g. total annual utility spend in the filtered set)
  - Recent bond activity (last 12 months)
  - Median of the lens's headline metric
- **Opportunity table** (primary element). Columns:
  - District (with county and region)
  - **Why surfaced**: 2–3 plain-language signal chips
  - **Magnitude**: dollars or portfolio scale
  - **Evidence**: strength of the data behind the signals
  - **Timing**: e.g. "bond passed 4 mo ago", "debt retiring 2027"
  - Trend sparkline
  - Peer percentile
  - Research status (from saved dispositions)
- **Map**, secondary and collapsible: district boundaries colored by the lens's headline metric, with hover details. Clicking a district opens District Research.
- An optional sort-convenience score may exist, but it is **never shown without its components** and never replaces the "why surfaced" text.

### 5.3 District Research (the core page)
Reads like a **call-preparation brief**. It's a focused page, not a panel appended to the statewide view.

**Header strip:**

- District name
- County · ESC region · locale
- Enrollment and 5-year growth
- Campus count
- Plant maintenance & operations (Function 51) budget
- Annual utilities spend
- Most recent bond (date, amount, result)
- Outstanding debt
- Superintendent (as of date)
- Buttons: **Add to brief** · **Compare** · **Export**

**Opportunity hypotheses:** one **Hypothesis Card** per signal that fires, grouped by lens (spec in §6).

**Tabs or sections below:**

1. **Facilities Operating Profile.** Plant maintenance & operations composition and trends (§5.4).
2. **Capital & Bond Profile.** Elections, debt retirement, tax rates, property values, capital investment (§5.5).
3. **Peers.** The automatic peer group, shown explicitly (§7), with add/remove controls, plus a district-versus-peer-median table for all headline metrics.
4. **Research Further.** A checklist and link list for district documents: adopted budget, annual financial report, facility master plan, capital improvement plan, bond website, bond proposition language, board agendas, energy management plan, recent RFQs/RFPs, strategic plan.
   - Each item has a status (Not checked · Found · Not available), a URL field and a note.
   - Users can write a **document-sourced finding**, e.g. "FY2026 budget names HVAC replacement and controls standardization as priorities (Adopted Budget p. 42)". It becomes a finding card like any other.
5. **Notes.** Dated internal notes, e.g. "District opened two campuses in FY2023; likely explains the utility increase." They're visible to anyone who later opens this district (v2; device-only in v1).
6. **Data & sources.** Freshness per source, joins used and known gaps for this district.

### 5.4 Facilities Operating Profile
Function 51 = plant maintenance & operations. Components from the PEIMS object detail:

| Component | Contents | Controllable? |
|---|---|---|
| In-house staff | Salaries + benefits of custodial, maintenance, grounds | yes |
| Contracted maintenance & repair | | yes |
| Other contracted services | | yes |
| **Utilities** | Electricity, gas, water, wastewater, telephone **combined** | yes |
| Supplies | | yes |
| Insurance | Property/casualty | **separate: market-driven, not a facilities-management signal** |
| Capital purchases charged to Function 51 | | patch-and-repair indicator |

Key visuals:

- **Composition over time as a 100% stacked area/bar.** It shows how the operating model has shifted (e.g. contracted repair growing while in-house staff is flat).
- Per-student trend for each component, with the district versus its peer median.
- Utilities: per student, share of Function 51, 5/10-year growth versus enrollment growth, **FY2026 budget versus FY2025 actual**.
- Complexity context: campuses per 1,000 students, campus spread on a small map.
- Volatility: year-over-year change, so one-time spikes read differently from persistent levels.

### 5.5 Capital & Bond Profile
Four dimensions (not one score):

| Dimension | Shows |
|---|---|
| **Possible need** | Enrollment growth, low sustained capital investment per student, rising repair spending |
| **Fiscal capacity** | Property value per student and growth, I&S (debt) tax rate versus the $0.50 cap, debt per student, debt ÷ property value |
| **Timing** | **Debt principal retiring in 1/3/5 years**, years since last passed bond, FY2026 capital budget |
| **Community support** | Past propositions, vote margins, passed/failed pattern, peer districts' recent bonds |

Key visuals:

- **Bond election timeline:** each proposition as a mark sized by amount and colored passed/failed, with vote margin on hover.
- **Debt retirement profile:** principal outstanding by year going forward, showing when capacity frees up.
- Tax rate history: M&O and I&S, two small charts (never a dual axis).
- Property value per student trend versus peers.
- Capital investment per student, 5-year rolling, versus peers.

### 5.6 Compare Districts
Two to four districts in columns, with a **"Suggest similar districts"** button that uses the peer logic in §7. Rows:

- Enrollment and growth
- Plant maintenance & operations and utilities per student
- Operating mix
- Tax base and rates
- Debt burden and retirement
- Bond history
- Peer percentiles
- Trend direction

Exportable as a graphic and a CSV.

### 5.7 Brief Builder
Always reachable: a **persistent tray or side panel** with a count badge that fills as the user pins findings and charts from any page.

- Pick a template (§8.2).
- Reorder, hide and edit findings. **All generated text is editable.**
- Add discovery questions (suggested questions per finding, editable) and free-text notes.
- Choose which charts appear.
- Preview at letter size, then export PDF, or print.
- Each finding shows its disposition. Only **Include** items appear in the export by default.

### 5.8 Methodology
Definitions, formulas, sources and retrieval dates, peer-group logic, known gaps, and the product boundary statement from §2. Every "ⓘ" tooltip and caveat links here.

## 6. Core components

**Hypothesis Card**, the signature component. It contains:

- **Title** (the signal name, e.g. "Utility-cost pressure")
- **Finding sentence** with the numbers in it
- **Signal strength** (e.g. strong / moderate / weak, shown with icon + label, never color alone)
- **Dollars involved**
- **Period**
- **Comparison group** (links to the peer definition)
- **Source + freshness**
- **Caveat / possible explanations**
- **Suggested discovery question**
- **Disposition control:** Include · Investigate · Explained by district · Not relevant · Follow up
- Actions: pin to brief, open evidence chart, add note

Illustrative copy (not real data):

> **Utility-cost pressure** · Strong · $2.4M/yr · FY2020–FY2025 · vs 38 similar districts
> Utility spending is 34% above the median for similar districts and has increased 22% since FY2021, compared with 9% for peers.
> *May reflect equipment age, controls, rate structure, schedules or added square footage.*
> **Ask:** "What's driven the utility increase since 2021, and have you had an energy audit recently?"

> **Operating-model shift** · Moderate · FY2021–FY2025
> Contracted maintenance spending has doubled in four years while facilities payroll has remained flat.

> **Capital-planning timing** · Strong
> No bond has passed in nine years, enrollment is up 14%, and $38M of existing principal retires within five years.

Other components:

- **Signal chip:** compact version of a card, used in tables.
- **Metric tile:** value + unit + delta + sparkline + freshness.
- **Peer group chip/editor:** "vs 38 similar districts ▾" opens the member list, the criteria and add/remove controls.
- **Freshness badge:** e.g. "FY2025 actuals".
- **Caveat callout:** quiet styling, never alarming.
- **Chart export menu** on every chart (§8.1).
- **Disposition control:** segmented control or dropdown with icons.
- **Saved-on-this-device indicator** + Export/Import research file.
- **Empty and missing-data states**, e.g. "No bond elections on record since 1990", "Debt data not available for charter schools".

## 7. Peer groups (visible and editable)

Different questions need different peers. **Every chart and export states how its peers were chosen.**

| Used for | Peer criteria |
|---|---|
| Performance contracting, O&M | Enrollment band · locale (urban/suburban/town/rural) · ESC region or climate zone · campus count · campuses per 1,000 students |
| Capital planning | Enrollment and growth · property value per student · locale · debt burden · I&S rate |

Users can remove poor matches and add known comparables. Default comparisons on charts: **district · peer median · ESC region median · statewide median**. Always medians, never averages.

## 8. Exports (first-class products)

### 8.1 Individual chart export
Formats: PNG · SVG · copy image · CSV of underlying data · copy source citation. Options: transparent background; **16:9 slide** or **letter-width** aspect ratios.

Every exported chart **carries its own context** (it must stand alone when pasted into an email or deck):

- District name + plain-language title stating the finding (e.g. "Utility spending has grown faster than peers since FY2021")
- Metric definition and units
- Time period
- Peer definition
- Source + retrieval date
- Short caveat where relevant
- Upchurch logo/wordmark + "Prepared by Upchurch · [date]"

### 8.2 One-page brief (letter, portrait, print-ready)
Four templates share one skeleton and differ in which findings and charts they lead with:

1. Performance Contracting Opportunity Brief
2. Facilities O&M Brief
3. FCA & Bond Planning Brief
4. General District Research Brief

Skeleton:

```
[Upchurch]  DISTRICT NAME                                   Prepared Sept 2026
County · ESC Region · Enrollment (5-yr change) · Campuses

WHY WE'RE LOOKING
2–3 editable findings, each with its key number and comparison group

[ Primary chart ]                  [ Secondary chart ]

FACILITIES OPERATING PROFILE  or  CAPITAL CONTEXT   (template-dependent)
Compact metrics row

QUESTIONS WORTH EXPLORING
3 tailored discovery questions

Sources · peer definition · caveats · "Based on public data; not a facility condition assessment."
```

It should look like thoughtful consulting work, not a system printout. Generous white space, strong hierarchy, at most two charts.

### 8.3 Research packet (later)
Three to five pages: executive summary, operating-cost analysis, peer comparison, capital and bond history, campus portfolio, methodology. Design the cover and one interior page to establish the system; full build comes later.

## 9. Language and content rules

- **"Utilities", never "energy"**, for PEIMS utility spending (it includes water, wastewater and telephone). The federal FY2020 energy-only figure is labeled "federal energy estimate (FY2020)".
- **Units everywhere**: $, $/student, %, percentage points (pts), and FY labels. FY2025 = the 2024-25 school year.
- **Neutral, respectful tone about districts.** "Signals", not "worst districts". These briefs may be handed to the people they describe.
- Findings = observation + comparison + period. Explanations are offered as possibilities, and each ends with a question.
- Plain language first, with the technical term in a tooltip ("Plant maintenance & operations (Function 51)").

## 10. Visual direction

- **A serious research product.** Restrained, credible, dense enough for analysts, with strong hierarchy. Closer to a consulting report or a Federal Reserve data tool than a marketing site.
- **Brand: Upchurch.** Use the Upchurch design system (`upchurch.design`) for type, color, logo and document styling, especially on exports and one-pagers. Nothing from the old Centrix branding.
- **Data-viz color rules:**
  - Emphasis is the default. The selected district is in the brand accent; peers, region and state are in neutral grays with different line styles.
  - Sequential single-hue ramps for maps.
  - Passed/failed and signal strength always carry an icon + label, never color alone.
  - Status colors are reserved for status, not reused as series colors.
  - No dual-axis charts.
- **Light theme is primary**, since exports and print are light. Dark mode is optional for the app.
- Accessible: WCAG AA contrast, keyboard-navigable tables, table views behind charts.

## 11. What to design now vs later

**Now (v1):**

- Unlock
- Opportunity Radar
- District Research (with Operating Profile, Capital & Bond, Peers, Research Further, Notes)
- Compare
- Brief Builder
- Chart export frame (slide + letter variants)
- 4 one-pager templates
- Methodology
- Component sheet: Hypothesis Card and all states, chips, tiles, peer editor, disposition control, freshness badge, empty states

**Later (design lightly or note placement only):**

- Shared team workspace (accounts, assignments, pursuit status): v2 with company sign-in
- Research packet (multi-page)
- **District-provided data mode:** once a district shares utility bills and a campus inventory (square footage, build year, HVAC/roof/controls), the same District page shifts to preliminary analysis:
  - Energy use intensity and cost per square foot
  - Weather-normalized use, baseload and anomalies
  - Rough opportunity sizing

  Reserve a clear visual distinction between "public data" and "district-provided data."
- Weather-normalized comparisons (heating/cooling degree days)

## 12. Data at a glance (details in `DATA_INVENTORY.md`)

| Available | Years |
|---|---|
| District spending by function (incl. Function 51) and enrollment | FY2009–FY2025 |
| **Function 51 detail** (staff, utilities, contracted repair, supplies, insurance, capital) | FY2000–FY2025 actuals; **FY2026 budgets** |
| M&O and I&S tax rates | 2005-06 → 2023-24 |
| Property values | tax years 2010–2025 |
| **Bond elections** (amount, purpose, votes, result) | 1958 → May 2026 |
| **Debt outstanding by issue, with maturity dates** | FY2016–FY2025 |
| Campuses: locations, grades, enrollment, superintendent/principal contacts | 2024-25 |
| District boundaries, ESC regions | 2026 / 2024 |
| Locale (urban/rural), staffing, school-level data (NCES) | 2024 |
| Energy-only utility spending (federal F-33) | FY2020 |

**Not available publicly:** building age, square footage, system condition, kWh/therms, and electricity versus gas split in state data.
