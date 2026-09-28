---
title: Statewide explorer
---

<style>
:root {
  --series-1: #2a78d6;
  --context: #a3a29c;
  --context-strong: #6f6e69;
}
@media (prefers-color-scheme: dark) {
  :root {
    --series-1: #3987e5;
    --context: #62615c;
    --context-strong: #8f8e88;
  }
}
.hero h1 { margin: 1rem 0 0.25rem; font-size: 2rem; max-width: none; }
.hero p { margin: 0 0 1.25rem; color: var(--theme-foreground-muted); max-width: 72ch; }
.filters, .filters > div { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; margin-bottom: 1rem; }
.filters form { width: auto; margin: 0; }
.filters form > label { width: auto; margin-right: 0.4rem; }
.filters select, .filters input[type=number] { width: auto; min-width: 7rem; }
.kpi .big { font-variant-numeric: tabular-nums; }
.kpi .sub { color: var(--theme-foreground-muted); font-size: 0.85rem; }
.card h2 { margin-bottom: 0.25rem; }
.card h3 { margin-top: 0; }
.detail-head { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; }
.detail-head h2 { font-size: 1.4rem; margin: 0; }
.detail-head span { color: var(--theme-foreground-muted); }
</style>

```js
import {METRICS, PEER_BANDS, peerBand, fmt, titleCase} from "./components/metrics.js";
import {sparkline} from "./components/sparkline.js";

const NUMERIC = ["year", "enrollment", "revenue", "total_expense", "operating_expense", "payroll", "plant_maintenance",
  "security", "data_processing", "transport", "food_service", "capital_outlay", "debt_service", "region"];

const rows = (await FileAttachment("data/districts.csv").csv()).map((d) => {
  for (const k of NUMERIC) d[k] = d[k] === "" ? null : +d[k];
  d.display = titleCase(d.name);
  d.charter = !/\b(C?ISD|MSD|CSD)\b/.test(d.name);
  return d;
});
const geo = await FileAttachment("data/tx-counties.json").json();
const years = [...new Set(rows.map((d) => d.year))].sort((a, b) => a - b);
const byId = d3.group(rows, (d) => d.id);
```

<div class="hero">
  <h1>Texas school district finance</h1>
  <p>Compare facility, capital and operating spending for every Texas school district, ${years[0]}–${years.at(-1)}. Pick a metric to rank districts, then pick a row in the table to see how that district compares with its peers over time.</p>
</div>

<div class="filters">

```js
const year = view(Inputs.select(years.slice().reverse(), {label: "Fiscal year", format: (y) => `FY${y}`}));
const metric = view(Inputs.select(METRICS, {label: "Metric", format: (m) => m.label, value: METRICS[0]}));
const region = view(Inputs.select(["All", ...d3.range(1, 21)], {label: "ESC region", format: (r) => (r === "All" ? "All regions" : `Region ${r}`)}));
const band = view(Inputs.select(["All", ...PEER_BANDS.map((b) => b.label)], {label: "Enrollment", format: (b) => (b === "All" ? "All sizes" : b)}));
const minEnrollment = view(Inputs.number([0, Infinity], {label: "Min. enrollment", value: 500, step: 100}));
const includeCharters = view(Inputs.toggle({label: "Include charters", value: false}));
```

</div>

```js
// Everything for the selected year, before filters: needed for statewide peer percentiles.
const unit = metric.unit;
const fmtV = fmt[unit];
const yearRows = rows.filter((d) => d.year === year && d.enrollment > 0).map((d) => {
  const prior = byId.get(d.id).find((r) => r.year === year - 5);
  const v = metric.value(d);
  const v5 = prior ? metric.value(prior) : null;
  return {
    ...d,
    band: peerBand(d.enrollment),
    v,
    change: unit === "%" ? (v != null && v5 != null ? v - v5 : null) : (v5 ? v / v5 - 1 : null),
    enrollChange: prior?.enrollment ? d.enrollment / prior.enrollment - 1 : null
  };
});

// Percentile within the statewide peer band (same year, same size band, charters counted with their size band).
for (const [, group] of d3.group(yearRows.filter((d) => d.v != null), (d) => d.band)) {
  const sorted = group.map((d) => d.v).sort(d3.ascending);
  for (const d of group) d.pctl = d3.bisectRight(sorted, d.v) / sorted.length;
}

const filtered = yearRows
  .filter((d) => d.v != null && isFinite(d.v))
  .filter((d) => region === "All" || d.region === region)
  .filter((d) => band === "All" || d.band === band)
  .filter((d) => d.enrollment >= (minEnrollment ?? 0))
  .filter((d) => includeCharters || !d.charter)
  .sort((a, b) => d3.descending(a.v, b.v));
```

```js
const median = d3.median(filtered, (d) => d.v);
const top10 = d3.quantile(filtered.map((d) => d.v).sort(d3.ascending), 0.9);
const totalDollars = metric.total ? d3.sum(filtered, (d) => d[metric.total]) : null;
const students = d3.sum(filtered, (d) => d.enrollment);
```

<div class="grid grid-cols-4 kpi">
  <div class="card"><h2>Districts shown</h2><span class="big">${filtered.length.toLocaleString("en-US")}</span><div class="sub">${fmt.n(students)} students</div></div>
  <div class="card"><h2>Median ${unit === "$" ? "per student" : ""}</h2><span class="big">${fmtV(median)}</span><div class="sub">${metric.short}, FY${year}</div></div>
  <div class="card"><h2>Top 10% starts at</h2><span class="big">${fmtV(top10)}</span><div class="sub">${unit === "$" ? "per student" : metric.short}</div></div>
  <div class="card"><h2>${metric.total ? "Total spent" : "Total revenue"}</h2><span class="big">${fmt.money(metric.total ? totalDollars : d3.sum(filtered, (d) => d.revenue))}</span><div class="sub">by the districts shown</div></div>
</div>

```js
// County choropleth: median district value among the filtered districts.
const countyStats = d3.rollup(filtered, (g) => ({median: d3.median(g, (d) => d.v), n: g.length}),
  (d) => (d.county ?? "").toUpperCase().replace(/[^A-Z]/g, ""));

function countyMap(width) {
  return Plot.plot({
    width,
    height: Math.min(width * 0.95, 560),
    projection: {type: "conic-conformal", parallels: [27.5, 35], rotate: [100, 0], domain: geo.counties},
    color: {
      type: "quantile", n: 7, range: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
      legend: true, width: 380, label: `Median ${metric.short}${unit === "$" ? " per student" : ""}`,
      tickFormat: unit === "$" ? (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`) : fmtV
    },
    marks: [
      Plot.geo(geo.counties, {fill: "var(--theme-background-alt)", stroke: "var(--theme-background)", strokeWidth: 0.75}),
      Plot.geo(geo.counties.features.filter((f) => countyStats.has(f.properties.key)), Plot.centroid({
        fill: (f) => countyStats.get(f.properties.key).median,
        stroke: "var(--theme-background)", strokeWidth: 0.75,
        title: (f) => {
          const s = countyStats.get(f.properties.key);
          return `${f.properties.name} County\nMedian: ${fmtV(s.median)}\n${s.n} district${s.n > 1 ? "s" : ""}`;
        },
        tip: true
      })),
      Plot.geo(geo.outline, {stroke: "var(--theme-foreground-faint)", strokeWidth: 1})
    ]
  });
}

// Highest values among filtered districts; the selected district stays highlighted.
function topBars(width, highlightId) {
  const top = filtered.slice(0, 15);
  return Plot.plot({
    width,
    height: 30 + top.length * 26,
    marginLeft: Math.min(200, width * 0.42),
    x: {grid: true, label: null, tickFormat: fmtV, ticks: 4},
    y: {label: null, domain: top.map((d) => d.display)},
    marks: [
      Plot.barX(top, {
        x: "v", y: "display", rx: 2, insetTop: 3, insetBottom: 3,
        fill: (d) => (d.id === highlightId ? "var(--series-1)" : "var(--context)"),
        channels: {County: "county", Enrollment: (d) => fmt.n(d.enrollment)},
        tip: {format: {x: fmtV, y: true, fill: false}}
      }),
      Plot.ruleX([median], {stroke: "var(--theme-foreground-muted)", strokeDasharray: "3,3"}),
      Plot.text([median], {x: (d) => d, frameAnchor: "top", dy: -2, text: () => "median", fill: "var(--theme-foreground-muted)", textAnchor: "start", dx: 4}),
      Plot.ruleX([0])
    ]
  });
}
```

```js
// Ranked table. Selecting a row drives the district detail below.
const trendFor = (id) => byId.get(id).filter((r) => r.year > year - 10 && r.year <= year).map((r) => ({year: r.year, v: metric.value(r)}));

const table = Inputs.table(filtered, {
  columns: ["display", "county", "region", "enrollment", "v", "pctl", "change", "id"],
  header: {
    display: "District", county: "County", region: "Region", enrollment: "Enrollment",
    v: unit === "$" ? `${metric.short} / student` : metric.short,
    pctl: "Peer pctl", change: unit === "%" ? "5-yr Δ (pts)" : "5-yr change", id: "10-yr trend"
  },
  format: {
    county: (c) => (c ? titleCase(c) : "—"),
    enrollment: fmt.n,
    v: fmtV,
    pctl: (p) => (p == null ? "—" : `${Math.round(p * 100)}`),
    change: (c) => (c == null ? "—" : unit === "%" ? `${c > 0 ? "+" : ""}${(c * 100).toFixed(1)}` : fmt.pct(c)),
    id: (id) => sparkline(trendFor(id))
  },
  width: {display: 240, v: 150, id: 100},
  align: {region: "right", pctl: "right"},
  multiple: false,
  required: false,
  rows: 14.5,
  maxWidth: 1400
});
const selection = Generators.input(table);
```

```js
const current = selection ?? filtered[0];
```

<div class="grid grid-cols-2">
  <div class="card">
    <h2>${metric.short} by county</h2>
    <h3>Median across the districts shown in each county · FY${year}</h3>
    ${resize((width) => countyMap(width))}
  </div>
  <div class="card">
    <h2>Highest ${metric.short.toLowerCase()}${unit === "$" ? " per student" : ""}</h2>
    <h3>Top 15 of the districts shown · FY${year}</h3>
    ${resize((width) => topBars(width, current?.id))}
  </div>
</div>

<div class="card" style="padding:0">
  <div style="padding: 1rem 1rem 0"><h2>All districts shown</h2><h3>Pick a row to see that district's history. Peer percentile compares each district with all Texas districts in the same enrollment band.</h3></div>
  ${table}
</div>

```js
// Per-year medians for the selected district's peer band and statewide (non-charter ISDs + charters, all sizes).
const history = current ? byId.get(current.id).map((r) => ({year: r.year, v: metric.value(r), enrollment: r.enrollment})) : [];
const bandOf = current ? current.band : null;
const medians = d3.rollups(
  rows.filter((r) => r.enrollment > 0),
  (g) => ({
    state: d3.median(g, metric.value),
    peer: d3.median(g.filter((r) => peerBand(r.enrollment) === bandOf), metric.value)
  }),
  (r) => r.year
).map(([year, m]) => ({year, ...m})).sort((a, b) => a.year - b.year);

const series = [
  ...medians.map((d) => ({year: d.year, v: d.state, series: "Texas median"})),
  ...medians.map((d) => ({year: d.year, v: d.peer, series: `Peer median (${bandOf})`})),
  ...history.map((d) => ({year: d.year, v: d.v, series: current?.display}))
].filter((d) => d.v != null && isFinite(d.v));

function trendChart(width) {
  const last = series.filter((d) => d.year === d3.max(series, (s) => s.year));
  return Plot.plot({
    width,
    height: 320,
    marginRight: 110,
    marginLeft: 56,
    x: {label: null, tickFormat: "d", ticks: Math.min(10, years.length)},
    y: {grid: true, label: null, tickFormat: fmtV, zero: unit !== "%"},
    color: {legend: true, domain: [current?.display, `Peer median (${bandOf})`, "Texas median"], range: ["var(--series-1)", "var(--context-strong)", "var(--context)"]},
    marks: [
      Plot.ruleY(unit === "%" ? [0] : []),
      Plot.line(series, {x: "year", y: "v", stroke: "series", strokeWidth: (d) => (d.series === current?.display ? 2.5 : 1.75),
        strokeDasharray: (d) => (d.series === "Texas median" ? "4,3" : null), curve: "monotone-x"}),
      Plot.dot(series.filter((d) => d.series === current?.display), {x: "year", y: "v", r: 2.5, fill: "var(--series-1)"}),
      Plot.text(last.filter((d) => d.series === current?.display), {x: "year", y: "v", text: "series", fill: "var(--theme-foreground-muted)", textAnchor: "start", dx: 8, lineWidth: 12}),
      Plot.ruleX(series, Plot.pointerX({x: "year", stroke: "var(--theme-foreground-faint)"})),
      Plot.tip(series, Plot.pointer({x: "year", y: "v", title: (d) => `${d.series}\nFY${d.year}: ${fmtV(d.v)}`}))
    ]
  });
}
```

<div class="card">
  <div class="detail-head">
    <h2>${current ? current.display : "No district selected"}</h2>
    <span>${current ? `${current.county ? titleCase(current.county) + " County · " : ""}Region ${current.region ?? "—"} · ${current.band} students · District ${current.id}` : ""}</span>
  </div>
  <div class="grid grid-cols-4 kpi" style="margin: 1rem 0 0.5rem">
    <div><h3>Enrollment</h3><span class="big">${fmt.n(current?.enrollment)}</span><div class="sub">${fmt.pct(current?.enrollChange)} over 5 years</div></div>
    <div><h3>${metric.short}${unit === "$" ? " / student" : ""}</h3><span class="big">${fmtV(current?.v)}</span><div class="sub">peer median ${fmtV(medians.find((m) => m.year === year)?.peer)}</div></div>
    <div><h3>Peer percentile</h3><span class="big">${current?.pctl == null ? "—" : Math.round(current.pctl * 100)}</span><div class="sub">vs. ${current?.band} districts statewide</div></div>
    <div><h3>Net margin</h3><span class="big">${fmt["%"](current?.revenue ? (current.revenue - current.total_expense) / current.revenue : null)}</span><div class="sub">revenue − disbursements, FY${year}</div></div>
  </div>
  ${resize((width) => trendChart(width))}
</div>
