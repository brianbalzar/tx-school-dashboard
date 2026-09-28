import { useMemo, useState, useEffect } from "react";
import { geoPath, geoConicConformal } from "d3-geo";
import { feature } from "topojson-client";
import { scaleQuantile } from "d3-scale";
import { LENSES, LENS_SIGNALS, SIGNAL_SHORT } from "../lib/data.js";
import { money, num, pct, title, REGION_NAMES } from "../lib/format.js";
import { Sparkline, StrengthIcon } from "./charts.jsx";
import { perStudent, controllable, scoreTip } from "../lib/data.js";

const BANDS = [["all", "All enrollment"], ["u1", "Under 1k"], ["1-5", "1k–5k"], ["5-10", "5k–10k"], ["10-25", "10k–25k"], ["25", "25k+"]];
const inBand = (e, b) => b === "all" || (b === "u1" && e < 1000) || (b === "1-5" && e >= 1000 && e < 5000) ||
  (b === "5-10" && e >= 5000 && e < 10000) || (b === "10-25" && e >= 10000 && e < 25000) || (b === "25" && e >= 25000);
const RAMP = ["#E5F2FF", "#B8DBFF", "#5CACFF", "#0082FF", "#004E99"];

export function signalValue(card) {
  if (!card || card.value == null) return card ? "✓" : "—";
  const v = card.value;
  switch (card.key) {
    case "utility-level": case "om-level": case "om-low": case "om-budget": case "cap-growth": return pct(v);
    case "utility-growth": case "om-shift": case "om-growth": return `${v > 0 ? "+" : ""}${Math.round(v * 100)} pts`;
    case "cap-since": return v >= 99 ? "none" : `${Math.floor(v)} yrs`;
    case "cap-retire": return `${Math.round(v * 100)}%`;
    case "cap-capacity": return `$${v.toFixed(2)} headroom`;
    case "em-fit": return `${money(v)}/yr`;
    case "em-utility": return pct(v);
    case "em-budget": return `${money(v)}/student`;
    default: return "✓";
  }
}

export function researchStatus(research, d) {
  const ds = d.cards.map((c) => research.disp[`${d.id}:${c.key}`]).filter(Boolean);
  if (ds.includes("include")) return ["In brief", "●"];
  if (ds.some((x) => x === "investigate" || x === "follow")) return ["Investigating", "◐"];
  if (ds.length) return ["Reviewed", "✓"];
  return ["Not reviewed", "○"];
}

function headlineSeries(d, lens) {
  if (lens === "pc" || lens === "em") return perStudent(d, "util");
  if (lens === "om") { const c = controllable(d); return c.map((v, i) => (v == null || !d.s.enroll[i] ? null : v / d.s.enroll[i])); }
  return d.s.enroll;
}

function TxMap({ model, rows, lens, onOpen }) {
  const [topo, setTopo] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { fetch("data/districts.topo.json").then((r) => r.json()).then(setTopo); }, []);
  const W = 272, H = 262;
  const geo = useMemo(() => topo && feature(topo, Object.values(topo.objects)[0]), [topo]);
  const proj = useMemo(() => geo && geoConicConformal().parallels([27.5, 35]).rotate([100, 0]).fitSize([W, H], geo), [geo]);
  const path = useMemo(() => proj && geoPath(proj), [proj]);
  const shown = new Map(rows.map((d) => [d.id, d]));
  const vals = rows.map((d) => d.lens[lens].headline).filter((v) => v != null);
  const q = scaleQuantile().domain(vals.length ? vals : [0, 1]).range(RAMP);
  if (!geo) return <div className="small muted">Loading map…</div>;
  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} role="img" aria-label="Map of Texas school districts">
        {geo.features.map((f) => {
          const id = String(f.properties.id).padStart(6, "0");
          const d = shown.get(id); const v = d?.lens[lens].headline;
          return <path key={id} d={path(f)} fill={d ? (v != null ? q(v) : "#EFEEEC") : "#F7F7F6"} stroke="#fff" strokeWidth={0.3}
            style={{ cursor: d ? "pointer" : "default" }} onMouseEnter={() => setHover(d ? { d, v } : null)} onMouseLeave={() => setHover(null)}
            onClick={() => d && onOpen(d.id)} />;
        })}
      </svg>
      {hover && <div className="small" style={{ minHeight: 34 }}><b>{title(hover.d.name)}</b><br />{LENSES.find((l) => l.key === lens).headline}: {lens === "cap" ? (hover.v != null ? `${hover.v} yrs` : "no passed bond on record") : money(hover.v)}</div>}
      {!hover && <div className="small muted" style={{ minHeight: 34 }}>Hover a district; click to open it.</div>}
      <div style={{ display: "flex", marginTop: 6 }}>{RAMP.map((c) => <i key={c} style={{ flex: 1, height: 8, background: c }} />)}</div>
      <div className="tiny muted" style={{ display: "flex", justifyContent: "space-between" }}>
        {q.quantiles().map((t) => <span key={t}>{lens === "cap" ? `${Math.round(t)}` : money(t)}</span>)}</div>
      <div className="tiny muted">Quintile breaks{lens === "cap" ? " (years)" : ""}.</div>
      <div className="tiny muted">Charters have no boundaries and aren't mapped. Gray = no value.</div>
    </div>
  );
}

export default function Radar({ model, research, update, hash, go }) {
  const lens = hash.lens || "pc";
  const L = LENSES.find((l) => l.key === lens);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState(hash.region || "all");
  const [band, setBand] = useState(hash.band || "all");
  const [locale, setLocale] = useState(hash.locale || "all");
  const [charters, setCharters] = useState(hash.charters === "1");
  const [sort, setSort] = useState({ key: "signals", dir: -1 });
  const [tier, setTier] = useState(hash.tier || "priority");   // priority | any | all
  const [minDollars, setMinDollars] = useState(0);
  const [nearOnly, setNearOnly] = useState(false);
  const [unreviewed, setUnreviewed] = useState(false);
  const [tipsOnly, setTipsOnly] = useState(false);
  const [topN, setTopN] = useState(0);
  const [showMap, setShowMap] = useState(true);
  const view = research.radarTable || "matrix";

  useEffect(() => { go({ region: region === "all" ? null : region, band: band === "all" ? null : band, locale: locale === "all" ? null : locale, charters: charters ? "1" : null }, { replace: true }); }, [region, band, locale, charters]);

  const base = useMemo(() => model.districts.filter((d) => !d.tooSmall
    && (charters || !d.charter)
    && (region === "all" || String(d.region) === region)
    && inBand(d.s.enroll.at(-1) || 0, band)
    && (locale === "all" || d.locale === locale)
    && (!q || d.name.toLowerCase().includes(q.toLowerCase()) || (d.county || "").toLowerCase().includes(q.toLowerCase()))), [model, charters, region, band, locale, q]);

  const withSignals = base.filter((d) => d.lens[lens].keys.length);
  const priority = withSignals.filter((d) => d.lens[lens].priority);
  const evOrder = { Strong: 3, Moderate: 2, Limited: 1 };
  const sorted = useMemo(() => {
    let src = tier === "all" ? base : tier === "any" ? withSignals : priority;
    src = src.filter((d) => (d.lens[lens].magnitude || 0) >= minDollars && (!nearOnly || d.lens[lens].nearTerm)
      && (!unreviewed || researchStatus(research, d)[0] === "Not reviewed") && (!tipsOnly || d.tips));
    const val = (d) => ({
      signals: d.lens[lens].keys.length * 1e13 + (d.lens[lens].magnitude || 0),
      name: d.name, magnitude: d.lens[lens].magnitude || 0, evidence: evOrder[d.lens[lens].evidence] || 0, pctl: d.lens[lens].pctl ?? -1, score: d.lens[lens].score ?? -1,
    })[sort.key];
    const out = src.slice().sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sort.key === "name" ? -sort.dir : sort.dir));
    return topN ? out.slice(0, topN) : out;
  }, [base, withSignals, priority, tier, sort, lens, minDollars, nearOnly, unreviewed, tipsOnly, topN, research]);
  useEffect(() => { setMinDollars(0); if (sort.key === "score" && lens === "cap") setSort({ key: "signals", dir: -1 }); }, [lens]);
  const hasScore = lens !== "cap";
  const MAG_OPTS = lens === "em" ? [[0, "Any"], [25000, "≥ $25K"], [50000, "≥ $50K"], [100000, "≥ $100K"]]
    : lens === "om" ? [[0, "Any"], [50000, "≥ $50K"], [150000, "≥ $150K"], [500000, "≥ $500K"], [1500000, "≥ $1.5M"]]
    : [[0, "Any"], [250000, "≥ $250K"], [1000000, "≥ $1M"], [5000000, "≥ $5M"], [20000000, "≥ $20M"]];
  const perYr = L.perYear ? "/yr" : "";
  const [limit, setLimit] = useState(60);

  const addressable = priority.reduce((a, d) => a + (d.lens[lens].magnitude || 0), 0);
  const cutoff = new Date("2026-09-28"); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const recent = base.flatMap((d) => d.bonds.filter((b) => new Date(b.date) >= cutoff && b.result !== "Cancelled"));
  const passedAmt = recent.filter((b) => b.result === "Carried").reduce((a, b) => a + (b.amount || 0), 0);
  const heads = base.map((d) => d.lens[lens].headline).filter((v) => v != null).sort((a, b) => a - b);
  const medHead = heads.length ? heads[Math.floor(heads.length / 2)] : null;
  const f = model.meta.freshness;
  const th = (key, label, cls = "") => (
    <th className={"sort " + cls} onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}>
      {label}{sort.key === key ? (sort.dir < 0 ? " ↓" : " ↑") : ""}</th>);
  const open = (id) => go({ v: "district", d: id, tab: null });
  const anyFilter = region !== "all" || band !== "all" || locale !== "all" || charters || q;

  return (
    <div className="page">
      <div className="eyebrow">Opportunity radar</div>
      <h1 className="display">Which districts surface under each business lens, and why.</h1>
      <div className="lenses" role="tablist">
        {LENSES.map((l) => (
          <button key={l.key} role="tab" aria-selected={l.key === lens} className={l.key === lens ? "on" : ""} onClick={() => go({ lens: l.key }, { replace: true })}>
            <b>{l.label}</b><span>{l.blurb}</span></button>))}
      </div>
      <div className="filters">
        <input type="search" placeholder="Search districts or counties" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search districts" />
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="ESC region">
          <option value="all">All ESC regions</option>
          {Object.entries(REGION_NAMES).map(([k, v]) => <option key={k} value={k}>Region {k} ({v})</option>)}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value)} aria-label="Enrollment">{BANDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label="Locale">
          <option value="all">All locales</option>{["Urban", "Suburban", "Town", "Rural"].map((x) => <option key={x}>{x}</option>)}</select>
        <label><input type="checkbox" checked={charters} onChange={(e) => setCharters(e.target.checked)} /> Include charters</label>
        {anyFilter && <button className="linkbtn" onClick={() => { setQ(""); setRegion("all"); setBand("all"); setLocale("all"); setCharters(false); }}>Clear filters</button>}
      </div>

      <div className="tiles">
        <div className="tile"><div className="lbl">Priority opportunities</div><div className="val">{num(priority.length)} <small>of {num(base.length)}</small></div><div className="sub">{num(withSignals.length)} have at least one signal</div><span className="fresh">{lens === "cap" ? f.bonds : f.peims}</span></div>
        <div className="tile"><div className="lbl">{{ cap: "Debt retiring by FY2030 (est.)", pc: "Est. ESCO project value", om: "Est. Uptime Ops fees", em: "Est. EMaaS net savings" }[lens]}</div><div className="val">{money(addressable)}{perYr && <small> {perYr}</small>}</div><div className="sub">{lens === "cap" ? "estimated principal, priority districts" : "base case, priority districts · internal estimate"}</div><span className="fresh">{lens === "cap" ? f.debt : f.peims}</span></div>
        <div className="tile"><div className="lbl">Recent bond activity</div><div className="val">{recent.length} <small>propositions</small></div><div className="sub">{recent.filter((b) => b.result === "Carried").length} passed, {money(passedAmt)} approved, last 12 months</div><span className="fresh">{f.bonds}</span></div>
        <div className="tile"><div className="lbl">Median {L.headline.toLowerCase()}</div><div className="val">{lens === "cap" ? (medHead != null ? `${medHead.toFixed(1)}` : "—") : money(medHead)}<small>{L.unit}</small></div><div className="sub">districts in current filter</div><span className="fresh">{lens === "cap" ? f.bonds : f.peims}</span></div>
      </div>

      <div className={"radar-body" + (showMap ? "" : " nomap")}>
        <div>
          <div className="toolbar">
            <span className="seg" role="radiogroup" aria-label="Which districts">
              {[["priority", "Priority opportunities"], ["any", "Any signal"], ["all", "All districts"]].map(([k, l]) =>
                <button key={k} className={tier === k ? "on" : ""} onClick={() => setTier(k)}>{l}</button>)}
            </span>
            <b>{num(sorted.length)}</b> <span>{tier === "priority" ? "priority districts" : tier === "any" ? "with any signal" : "districts in filter"}</span>
            <span className="seg" style={{ marginLeft: "auto" }}>
              <button className={view === "matrix" ? "on" : ""} onClick={() => update((s) => ({ ...s, radarTable: "matrix" }))}>Evidence matrix</button>
              <button className={view === "chips" ? "on" : ""} onClick={() => update((s) => ({ ...s, radarTable: "chips" }))}>Signal chips</button>
            </span>
            <button className="linkbtn" onClick={() => setShowMap((x) => !x)}>{showMap ? "Hide map" : "Show map"}</button>
          </div>
          <div className="filters" style={{ marginBottom: 10 }}>
            <select value={minDollars} onChange={(e) => setMinDollars(+e.target.value)} aria-label="Minimum magnitude">
              {MAG_OPTS.map(([v, l]) => <option key={v} value={v}>{l} {L.magnitude}</option>)}</select>
            <select value={topN} onChange={(e) => setTopN(+e.target.value)} aria-label="Show top">
              {[[0, "All ranked"], [25, "Top 25"], [50, "Top 50"], [100, "Top 100"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <label><input type="checkbox" checked={nearOnly} onChange={(e) => setNearOnly(e.target.checked)} /> Near-term timing only</label>
            <label><input type="checkbox" checked={unreviewed} onChange={(e) => setUnreviewed(e.target.checked)} /> Not yet reviewed</label>
            <label title="Member of The Interlocal Purchasing System (TIPS) cooperative"><input type="checkbox" checked={tipsOnly} onChange={(e) => setTipsOnly(e.target.checked)} /> TIPS members only</label>
          </div>
          <div className="tablewrap">
            <table className="data sticky1">
              <thead><tr>
                {th("name", "District")}
                {view === "matrix" ? LENS_SIGNALS[lens].map((k) => <th key={k}>{SIGNAL_SHORT[k]}</th>) : th("signals", "Why surfaced")}
                {th("magnitude", "Magnitude", "r")}{hasScore && th("score", "Model score", "r")}{th("evidence", "Evidence")}<th>Timing</th><th>Trend</th>
                {view === "chips" && th("pctl", "Peer pctl", "r")}<th>Research status</th>
              </tr></thead>
              <tbody>
                {sorted.slice(0, limit).map((d) => {
                  const lz = d.lens[lens]; const cards = Object.fromEntries(d.cards.map((c) => [c.key, c]));
                  const [st, icon] = researchStatus(research, d);
                  return (
                    <tr key={d.id} className="click" tabIndex={0} onClick={() => open(d.id)} onKeyDown={(e) => e.key === "Enter" && open(d.id)}>
                      <td><div className="dname">{title(d.name)}</div><div className="dmeta">{d.county} County · Region {d.region} · {num(d.s.enroll.at(-1))} students{d.tips && <span className="tips-tag" title={`TIPS member since ${d.tips.since?.slice(0, 4) || "?"}`}>TIPS</span>}</div>{d.dq?.length > 0 && <div className="dq-tag" title={d.dq.join(" ")}>⚠ Review data continuity</div>}</td>
                      {view === "matrix" ? LENS_SIGNALS[lens].map((k) => (
                        <td key={k} className="num" style={{ whiteSpace: "nowrap" }}><span className={"mark" + (cards[k] ? " on" : "")} />{cards[k] ? signalValue(cards[k]) : <span className="muted">—</span>}</td>
                      )) : <td>{lz.keys.map((k) => <span key={k} className="chip on">{SIGNAL_SHORT[k]}</span>)}{!lz.keys.length && <span className="muted small">No signals</span>}</td>}
                      <td className="r num"><b>{lz.magnitude != null ? money(lz.magnitude) + (lz.magnitude ? perYr : "") : "—"}</b><div className="dmeta">{lens === "em" && lz.magnitude == null ? "outside size band" : L.magnitude}</div></td>
                      {hasScore && <td className="r num" title={scoreTip(d, lens)}>{lz.score != null ? Math.round(lz.score) : "—"}</td>}
                      <td>{lz.evidence ? <StrengthIcon level={lz.evidence} /> : <span className="muted">—</span>}</td>
                      <td className="small timing">{lz.timing || <span className="muted">—</span>}</td>
                      <td><Sparkline values={headlineSeries(d, lens).slice(-10)} /></td>
                      {view === "chips" && <td className="r num">{lz.pctl ?? "—"}</td>}
                      <td className="small" style={{ whiteSpace: "nowrap" }}>{icon} {st}</td>
                    </tr>);
                })}
                {!sorted.length && <tr><td colSpan={12} className="empty">No districts match these filters. {tier === "priority" ? "Try “Any signal”, or widen the region or enrollment band." : "Try widening the region or enrollment band."}</td></tr>}
              </tbody>
            </table>
          </div>
          {sorted.length > limit && <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setLimit((l) => l + 100)}>Show more ({num(sorted.length - limit)} remaining)</button>}
          <p className="footnote"><b>Priority</b> = {lens === "em" ? "a Moderate or Strong “right-sized” fit (net ≥ $30K/yr) backed by a utility or budget signal" : <>Strong evidence, or {lens === "cap" ? "three" : "two"}+ agreeing signals with Moderate evidence</>}, and no data-continuity flags. Each row lists the signals that fired and why.{hasScore && " Model score (0–100) and magnitude come from Upchurch's internal sizing assumptions; use them to rank, not to quote."} Data year: FY2025 actuals, FY2026 budgets. Districts under 500 students are excluded because per-student figures swing too much.
            Evidence reflects how strong and persistent the signals are. <a href="#v=methodology">Methodology</a></p>
        </div>
        {showMap && (
          <aside className="mapcard">
            <h3>{L.headline}{lens !== "cap" ? ", FY2025" : ""}</h3>
            <div className="small muted" style={{ marginBottom: 8 }}>Districts in the current filter, quintiles.</div>
            <TxMap model={model} rows={base} lens={lens} onOpen={open} />
          </aside>
        )}
      </div>
    </div>
  );
}
