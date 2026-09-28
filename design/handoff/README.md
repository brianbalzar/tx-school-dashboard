# Handoff: Texas School District Opportunity Research (Upchurch)

## Overview
A research and briefing tool that helps Upchurch business development, energy engineers and facility consultants find Texas school districts with evidence-backed facilities hypotheses, investigate them, prepare discovery questions and export a district-specific one-page brief or chart. Three business lenses: **Performance Contracting**, **Facilities O&M**, **Capital Planning (FCA/Bond)**.

Product boundary (must stay visible in the UI and exports): *The dashboard identifies credible, evidence-backed hypotheses. It cannot diagnose building condition or guarantee savings without district-specific facility and utility data.*

Target codebase: `tx-school-dashboard` (Observable Framework, static site on GitHub Pages). Data sources and joins are documented in `docs/DATA_INVENTORY.md`; product rules in `docs/DESIGN_BRIEF.md`. This handoff follows both.

## About the Design Files
The files in this bundle are **design references created in HTML**: prototypes showing intended look and behavior, not production code to copy. Recreate them in the target codebase's environment (Observable Framework pages + Plot/D3 + plain JS components), using its patterns. The `.dc.html` files run in a design-tool runtime (`support.js`); read them for structure, copy, styles and logic, but don't ship them.

**All data in the prototype is fictional**, generated in `txr-data.js`. Keller ISD appears by name with illustrative numbers (TEA ID 220907 is real). Replace everything with the real pipeline described in `DATA_INVENTORY.md`. The signal rules and card copy templates in `txr-data.js` (`derive()` and `cards()`) are the intended logic; thresholds are starting points to tune against real distributions.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy and interactions, built on the Upchurch design system. Recreate closely. Exceptions noted under "Not final" below.

## Screens / Views

### 1. Unlock
- Centered card (max-width 380px, 1px `#E2E1DE` border, 4px radius, padding 48/40/40) on `#F7F7F6`.
- Upchurch centered logo (72px tall), "TEAM KEY" eyebrow label, password input (44px tall, 1px `#C9C7C2`, 2px radius), "Remember on this device" checkbox, full-width blue UNLOCK button (46px, 0 radius, 13px/700 uppercase, tracking .06em).
- Error text: "That key didn't work. Check it and try again." (`#B91D1D`, 13px).
- Nothing about districts is shown before unlock. Prototype accepts any key; production should use the encrypted-site key flow. Remember → localStorage, otherwise sessionStorage.

### 2. App shell (all screens after unlock)
- Sticky header, white, 1px bottom hairline `#E2E1DE`. Row min-height 60px, padding 0 32px, wraps on narrow widths.
  - Left: horizontal Upchurch logo (18px tall) | 1px divider | "District Research" (13px/600).
  - Nav: Opportunity Radar · Compare · Methodology (13.5px; active = 700 weight + 2px black bottom border).
  - District lookup input (34px, search icon) with dropdown results (name + county · region), "No district matches that name." empty state.
  - **Saved on this device** button → popover: storage explanation, last-saved timestamp, EXPORT FILE (black) / IMPORT FILE (outline) buttons for the JSON research file.
  - **BRIEF** button with blue count badge (number of pinned findings); toggles the Brief Builder tray.
- Standing sub-strip (`#F7F7F6`, 11.5px): "Per-student figures; district square footage isn't publicly available." (the prototype also shows an "Illustrative data" note; remove with real data).

### 3. Opportunity Radar (landing)
Max-width 1440, padding 32. Top to bottom:
- Eyebrow "OPPORTUNITY RADAR" + serif H1 (Source Serif 4, 36px/600, -0.02em).
- **Lens switcher**: 3-column grid, 1px black outer border. Active = black fill/white text. Each shows label (14px/700) + one-line description (12px).
- **Filter row** (flex-wrap, gap 10): search, ESC region, enrollment band (Under 1k, 1k–5k, 5k–10k, 10k–25k, 25k+), locale (Urban/Suburban/Town/Rural), fiscal year, Include charters checkbox, "Clear filters" link when any filter is set.
- **Summary tiles** (4, top border black): Districts with signals (x of n) · Addressable dollars for the lens · Recent bond activity (last 12 months, passed + $ approved) · Median of the lens headline metric. Each tile has a freshness badge.
- **Opportunity table** (primary element) + collapsible **map** aside (296px) to the right.
  - Toolbar: row count, **table view toggle "Evidence matrix / Signal chips"** (default Evidence matrix; persisted per device), "Show all n districts", "Hide map".
  - Columns (Evidence matrix): District (name + county · region · enrollment) · one column per lens signal with a square marker (filled blue = fires, hollow gray = doesn't) and the value · Magnitude · Evidence (3-bar strength icon + label) · Timing · Trend sparkline · Research status.
  - Columns (Signal chips): District · Why surfaced (up to 3 chips) · Magnitude · Evidence · Timing · Trend · Peer percentile · Research status.
  - Sortable headers (District, Why surfaced/default, Magnitude, Evidence, Peer pctl). Default sort: number of signals, then magnitude. Rows are focusable; Enter or click opens District Research.
  - Research status derives from saved dispositions: In brief / Investigating / Reviewed / Not reviewed (icon + label).
  - No composite score is shown. Footnote explains this and links to Methodology.
  - Map: schematic ESC-region tiles with a 5-step single-hue blue ramp (`#E5F2FF #B8DBFF #5CACFF #0082FF #004E99`), hatched = no districts in filter; clicking a region filters. **Production: replace with real district boundaries** (`school_districts_2026.geojson`, simplified) colored by the lens headline metric; hover details; click opens district.
  - Empty state: "No districts match these filters. Try widening the region or enrollment band."

### 4. District Research (core page)
Max-width 1280. Reads as a call-prep brief.
- Breadcrumb → **Header strip**: eyebrow, serif H1 44px, meta line "TEA 220907 · Tarrant County · ESC Region 11 (Fort Worth) · Suburban". Buttons: ADD TO BRIEF (blue), COMPARE, EXPORT (outline black).
- Stat grid (auto-fit ≥150px, left hairline per stat): Enrollment (+5-yr change) · Campuses (elem · middle · high · other) · Plant M&O budget FY2026 · Annual utilities · Most recent bond (date, result, % yes) · Outstanding debt (+ per student) · Superintendent (as-of date).
- **Opportunity hypotheses**, grouped by lens (active lens first, then others, then "From district documents"). Boundary statement + Methodology link at top right.
  - **Hypothesis Card, Compact (default)**: one row per finding: strength (bars + label) · title + finding sentence · dollars + period · disposition dropdown + Pin to brief · expand chevron. Expanded: caveat callout (`#F7F7F6`, italic), "ASK" question (serif), freshness badge, peer group link, Evidence chart, Add note.
  - **Hypothesis Card, Ledger** (alternate, behind the `cardStyle` prop): full card with segmented disposition control and actions footer. Keep available; Compact is the default.
  - Fields per card: title, finding sentence with numbers, strength (Strong/Moderate/Weak, icon + label), dollars, period, comparison group (links to Peers tab), source + freshness, caveat/possible explanations, suggested question, disposition (Include · Investigate · Explained by district · Not relevant · Follow up), pin, evidence chart, add note.
  - Empty per lens: "No signals fire under this lens with current peers and data." Charters under capital: "Debt and bond data are not available for charter schools."
- **Tabs** (wrap onto multiple lines at narrow widths; active = 700 + 2px black underline):
  1. **Facilities operating profile**: 6 metric tiles (utilities/student vs peers, utilities share of Function 51, 10-yr utility growth vs enrollment growth, FY2026 utility budget vs FY2025 actual, campuses per 1,000, property insurance shown separately). Charts: 100% stacked Function 51 composition FY2016–FY2025 (full width), utilities per student vs peer/region/state medians, Function 51 per student vs medians, utility YoY change bars.
  2. **Capital & bond profile**: four-dimension grid (Possible need · Fiscal capacity · Timing · Community support); **Bond record by period** table (last 5/10/20 years: passed, failed, pass rate, amount passed; cancelled excluded) + last-election line; charts: bond election timeline (full width; passed = filled blue above axis with check, failed = hollow black below with ×, size = amount, hover = vote margin), debt retirement profile (bars, through FY2031 highlighted), property value per student vs peers, M&O rate and I&S rate as two separate small charts (I&S shows $0.50 cap line). Charter: dashed empty state.
  3. **Budget & enrollment**: 5 tiles (Transportation, Security & monitoring, Capital outlay, Plant M&O, Total expense; $/student FY2025, change since FY2016, peer median, total $, sparkline). Campus portfolio panel (elementary/middle/high/other bars). Accountability ratings (A–F) panel: "Ratings not yet loaded" state until TAPR is downloaded; context only. Charts: spending per student by function (ranked horizontal bars, plant M&O highlighted, black tick = peer median), total spending per student vs peers, enrollment trend vs peer growth.
  4. **Peers**: Operations / Capital peer-set toggle; criteria sentence; member list with remove (×) and "Added" tag; "Add a comparable district…" select; "Reset to automatic". Right: district vs peer median vs ESC region vs statewide table (medians only).
  5. **Research further**: 10 documents (Adopted budget, Annual financial report, Facility master plan, Capital improvement plan, Bond website, Bond proposition language, Board agendas, Energy management plan, Recent RFQs/RFPs, Strategic plan), each with status (Not checked · Found · Not available), URL and note. Progress line. Side panel: "Add a document-sourced finding" (text + source) → creates a finding card in the "From district documents" group.
  6. **Notes**: dated notes, labeled "Saved on this device only. Shared team notes arrive with company sign-in (v2)."
  7. **Data & sources**: table of source · contents · freshness · join used · known gaps for this district (amber `#B8740B` for gaps). "LATER" callout reserving the district-provided data mode.
- **Every chart** is a figure card (1px hairline, 4px radius, padding 18/22): plain-language finding title (15px/700), metric definition + units, freshness badge, **Table** toggle (accessible data table view), **Export** menu (PNG · SVG · Copy image · CSV · Copy source citation; 16:9 slide / Letter width; transparent background), legend, caveat, peer definition + source line.

### 5. Compare Districts
Two to four districts in columns (first column shaded `#F7F7F6`), 220px label column. Rows grouped: Enrollment · Plant M&O and utilities · Operating mix FY2025 · Tax base and rates · Debt burden and retirement · Bond history · Peer percentiles · Trend direction (with sparklines). Actions: Add a district, **Suggest similar districts** (uses ops peers of the first district), CSV, Export graphic. Missing values say "Not available" with the reason (e.g. charter).

### 6. Brief Builder tray + preview
- Tray: fixed right panel, 420px, 1px black left border; main content pads right when open. Esc closes.
  - District select (districts with pins) + template select (4 templates).
  - Pinned findings: reorder (up/down), unpin, editable text, disposition dropdown, "In export"/"Not in export" (only **Include** exports). First three appear on the brief.
  - Questions worth exploring: editable, seeded from included findings' suggested questions; "+ Add a question".
  - Charts (at most two): primary/secondary selects.
  - Meeting notes (internal, not printed).
  - PREVIEW AT LETTER SIZE.
- Preview screen: template select, Layout A/B toggle (A default), EDIT IN TRAY, PRINT / PDF. Letter page 816×1056 on `#EFEEEC`.

### 7. One-page brief (letter portrait), `One Page Brief.dc.html`
**Layout A (default, consulting memo)**, padding 48/60/36:
- Header rule (1px black): horizontal logo 20px | template title + "Prepared Sept 2026" (10px eyebrows).
- District name (serif 42px/600) + meta line: TEA ID · county · region · enrollment (5-yr change) · campuses (elementary, middle, high).
- WHY WE'RE LOOKING: up to 3 findings; 120px left column with key number (serif 27px, `#004E99`) + label, right column title/sentence/comparison · period.
- Two charts side by side, each with title, definition, legend.
- FACILITIES OPERATING PROFILE or CAPITAL CONTEXT: 5-metric row. FCA template includes "Bonds passed, last 20 years" (e.g. "2 of 3 · 67% · last May 2017").
- QUESTIONS WORTH EXPLORING: 3 numbered serif questions.
- Footer: Sources · Peers · Caveats incl. "Based on public data; not a facility condition assessment." · "Prepared by Upchurch · [date]".
**Layout B** (alternate, keep behind a toggle): black header band, 3 key-number columns, full-width primary chart, secondary chart + profile list, gray questions block.
Templates: Performance Contracting (charts: utilities vs peers, utility YoY) · Facilities O&M (composition, F51 vs peers) · FCA & Bond (debt retirement, bond timeline) · General (utilities, debt retirement). No office address.

### 8. Chart export frames, see `Exports and Briefs.dc.html`
16:9 slide (1280×720) and letter width (816×600). Each carries: district + freshness eyebrow, finding title (serif), definition + period, chart, legend, peer definition, source + retrieval date, caveat, Upchurch logo + "Prepared by Upchurch · [date]".

### 9. Methodology
Stub in the prototype: boundary quote (serif 20px, 2px blue left border), language rules, peer criteria. Build out with definitions, formulas, sources/retrieval dates, gaps. Every caveat and ⓘ links here.

## Interactions & Behavior
- **URL state**: `#v=<screen>&lens=&region=&band=&locale=&charters=&q=&d=<district>&tab=&ids=<compare ids>`. Restore on load.
- **Pin to brief** auto-sets disposition to Include if unset; toast "Pinned "<title>" to the brief". ADD TO BRIEF pins the top 3 findings for the active lens and opens the tray.
- **Dispositions** drive Radar research status and brief inclusion.
- Peer overrides (remove/add) recompute medians, percentiles, card text and charts everywhere, and are shown in chart peer lines.
- Toasts: black, bottom-center, 3.2s.
- Esc closes tray, menus and lookup.
- Hover: primary buttons `#0082FF` → `#0068CC`; table rows `#F7F7F6`; cards get `0 4px 16px rgba(0,0,0,.06)`. Focus-visible: 2px `#0082FF` outline, 2px offset. No other animation.
- Responsive: header and tabs wrap; tables scroll horizontally with min-widths; grids use auto-fit/minmax.

## State Management (v1, all device-local)
Persist to localStorage (key `upchurch-txr-research-v1`) and include in the Export/Import research file (`{format:"upchurch-district-research",version:1,...}`):
`radarTable, disp{cardId:key}, pins[cardId], edits{cardId:text}, qEdits{cardId:text}, extraQs{districtId:[]}, notes{districtId:[{text,date}]}, research{districtId:{item:{status,url,note}}}, docFindings{districtId:[]}, peerOv{"districtId:ops|cap":{removed[],added[]}}, compareIds[], briefNotes, briefCharts{"districtId:template":[k1,k2]}, briefDistrict, briefTemplate, briefVariant`.
Card IDs are `districtId:signalKey` (e.g. `keller:utility-pressure`); keep them stable across data refreshes. v2 moves this to a server with company sign-in.

## Signal logic (from `txr-data.js`, tune on real data)
- Performance contracting: utilities/student ≥ 12% above ops-peer median; utility growth FY21–25 ≥ 6 pts above peers; FY2026 utility budget ≥ +5% vs FY2025 actual.
- O&M: contracted repair (6249/6299) growth ≥ 50% with staff growth < 6%; Function 51/student ≥ 10% above peers; capital outlay in Function 51 ≥ +30%.
- Capital: ≥ 7 years since passed bond; enrollment 5-yr ≥ +6%; principal retiring by FY2031 ≥ 20% of outstanding; I&S rate ≤ $0.30; bond failed within 36 months.
- Evidence = count of firing signals (3+ Strong, 2 Moderate, 1 Limited).
- Peers: ops = enrollment band, locale, ESC region, campus count, campuses per 1,000; capital = enrollment + growth, property value per student, locale, debt burden, I&S rate. Default 8 nearest; always medians.

## Design Tokens (Upchurch design system)
- Color: black `#000000`, Upchurch Blue `#0082FF` (hover `#0068CC`, press `#004E99`), blue scale `#E5F2FF #B8DBFF #8AC3FF #5CACFF #0082FF #0068CC #004E99 #003566`. Neutrals: `#FFFFFF #F7F7F6 #EFEEEC #E2E1DE #C9C7C2 #9C9A95 #6E6C68 #4A4845 #2D2C2A #161514`. Status (internal only): warning `#B8740B`, danger `#B91D1D`. Green `#009500` reserved; not used as a series color.
- Data-viz: selected district = blue solid 2.5px with end dot; peer median `#4A4845` dashed 6/4; ESC region `#6E6C68` dotted; statewide `#9C9A95` solid. Status never color-only (icon + label). No dual axes.
- Type: Inter (UI/body), Source Serif 4 (display, key numbers, questions). Eyebrows 12px/600 uppercase +0.12em. H1 36–44px serif 600 -0.02em. Body 13–15px. Table headers 11px/600 uppercase +0.06em.
- Radius: 0 (buttons), 2px (inputs, chips), 4px (cards) max. Borders 1px hairlines. Shadow: `0 4px 16px rgba(0,0,0,.06)` hover, `0 8px 28px rgba(0,0,0,.10)` popovers/tray.
- Spacing: 4px base (4, 8, 12, 16, 24, 32, 48, 64).
- Icons: Lucide-style 1.5–2px stroke line icons, currentColor.

## Assets
- `assets/upchurch-centered.png`: official centered black logo (from the user).
- `assets/upchurch-horizontal.png`: horizontal lockup **assembled from the centered logo** (mark beside wordmark). Replace with an official horizontal file if one exists; reversed variant is currently a CSS invert.

## Not final / known gaps
- Methodology page, component sheet and research packet not designed.
- PNG/SVG/copy-image export and PDF are stubs (CSV and citation copy work).
- Map is schematic.
- Unlock accepts any key.

## Files
- `District Research App.dc.html`: the full app prototype (all screens, tray, state).
- `One Page Brief.dc.html`: brief component (props: `variant` A/B, `template` pc/om/cap/gen, `districtId`, `findings`, `questions`, `chartKeys`, `peerOverrides`).
- `Exports and Briefs.dc.html`: brief layouts × templates, chart export frames.
- `txr-data.js`: fictional data generator, peer logic, signal rules, card copy templates, SVG chart builders (line, bars, YoY, 100% stack, bond timeline, horizontal bars, sparkline).
- `support.js`: design-tool runtime needed to open the `.dc.html` files in a browser; not for production.
