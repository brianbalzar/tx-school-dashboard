import { useEffect, useMemo, useRef, useState } from "react";
import { decryptBundle, savedKey, saveKey, forgetKey } from "./lib/crypto.js";
import { buildModel, LENSES, perStudent, seriesFn, medianSeries } from "./lib/data.js";
import { useResearch, useHashState, exportResearch, importResearch } from "./lib/state.js";
import { money, num, pct, title } from "./lib/format.js";
import Radar from "./components/Radar.jsx";
import District, { DISPOSITIONS } from "./components/District.jsx";
import { LineCompare, YoYBars, Stack100, DebtBars, BondTimeline, Sparkline } from "./components/charts.jsx";
import DistrictPicker from "./components/DistrictPicker.jsx";

function Unlock({ onUnlock }) {
  const [key, setKey] = useState(""); const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { document.body.classList.add("unlock"); return () => document.body.classList.remove("unlock"); }, []);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const b = await decryptBundle(key); saveKey(key, remember); onUnlock(b); }
    catch (x) { setErr(x.message === "bad-key" ? "That key didn't work. Check it and try again." : "Couldn't load the data. Check your connection and try again."); }
    setBusy(false);
  };
  return (
    <form className="unlock-card" onSubmit={submit}>
      <img src="brand/upchurch-vertical-black.png" alt="Upchurch" />
      <label className="eyebrow" htmlFor="k">Team key</label>
      <input id="k" type="password" autoFocus value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
      <label className="small"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device</label>
      <button className="btn primary" disabled={busy || !key}>{busy ? "Unlocking…" : "Unlock"}</button>
      {err && <div className="err" role="alert">{err}</div>}
    </form>
  );
}

function Lookup({ model, go }) {
  return <DistrictPicker model={model} onPick={(d) => go({ v: "district", d: d.id, tab: null })} />;
}

function Header({ model, hash, go, research, update, toast }) {
  const [pop, setPop] = useState(false); const file = useRef(null);
  const v = hash.v || "radar";
  return (
    <header className="hdr">
      <div className="hdr-row">
        <a className="hdr-brand" href="#v=radar" style={{ color: "inherit" }}><img src="brand/upchurch-horizontal-black.png" alt="Upchurch" /><span className="div" />District Research</a>
        <nav>{[["radar", "Opportunity Radar"], ["compare", "Compare"], ["methodology", "Methodology"]].map(([k, l]) =>
          <a key={k} href={`#v=${k}`} className={v === k || (k === "radar" && v === "district") ? "on" : ""}>{l}</a>)}</nav>
        <span className="spacer" />
        <Lookup model={model} go={go} />
        <button className="saved" onClick={() => setPop((p) => !p)}>▣ Saved on this device</button>
        <button className="btn" onClick={() => go({ tray: hash.tray ? null : "1" })}>Brief<span className="badge">{research.pins.length}</span></button>
      </div>
      <div className="substrip">Per-student figures; district square footage isn't publicly available. Findings are hypotheses from public data, not facility condition assessments.</div>
      {pop && (
        <div className="popover">
          <b>Your research is saved in this browser only.</b>
          <p className="small">Pins, dispositions, notes and document links stay on this device. Export a research file to move them to another computer or share with a colleague. Shared team notes come with company sign-in (v2).</p>
          <p className="small muted">Last saved: {research.savedAt ? new Date(research.savedAt).toLocaleString() : "nothing yet"}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn dark" onClick={() => exportResearch(research)}>Export file</button>
            <button className="btn" onClick={() => file.current.click()}>Import file</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
              try { const data = await importResearch(e.target.files[0]); update((s) => ({ ...s, ...data })); toast("Research file imported"); } catch (x) { toast(x.message); }
              e.target.value = "";
            }} />
          </div>
          <hr style={{ border: 0, borderTop: "1px solid #E2E1DE", margin: "12px 0" }} />
          <button className="linkbtn small" onClick={() => { forgetKey(); location.reload(); }}>Lock and forget the team key on this device</button>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
const TEMPLATES = [
  ["pc", "Performance Contracting Opportunity Brief"], ["om", "Facilities O&M Brief"],
  ["cap", "FCA & Bond Planning Brief"], ["em", "Energy Management Brief"], ["gen", "General District Research Brief"],
];
// Short label under each key number (so the lead doesn't repeat the finding title)
const KEY_LABEL = {
  "utility-level": "utilities per student vs peer median", "utility-growth": "utility growth vs peers since FY2019",
  "om-level": "plant operations per student vs peers", "om-low": "plant operations vs peers", "om-shift": "shift toward contracted services",
  "om-growth": "cost growth beyond enrollment, vs peers", "om-budget": "FY2026 plant budget vs FY2025 actual",
  "cap-since": "since last passed bond", "cap-growth": "enrollment growth, 5 years", "cap-retire": "of principal retires within 5 years (est.)",
  "cap-failed": "failed on a recent ballot", "cap-passed": "approved on a recent ballot", "cap-mixed": "on recent ballots (mixed results)", "cap-capacity": "I&S headroom per $100",
  "em-fit": "annual utilities, FY2025", "em-utility": "utilities per student vs peers", "em-budget": "general-fund operating gap per student",
};
const CHART_OPTIONS = [
  ["utilPeers", "Utilities per student vs similar districts"], ["utilYoY", "Year-over-year utility change"],
  ["opsMix", "Plant maintenance & operations spending mix"], ["opsPeers", "Plant operations per student vs peers"],
  ["debt", "Estimated principal outstanding by year"], ["bonds", "Bond election history"], ["enroll", "Enrollment trend vs peers"],
];
const DEFAULT_CHARTS = { pc: ["utilPeers", "utilYoY"], om: ["opsMix", "opsPeers"], cap: ["debt", "bonds"], em: ["utilPeers", "utilYoY"] };
const LENS_CHART = { pc: "utilPeers", om: "opsPeers", cap: "debt", em: "utilYoY" };

export function pinnedFor(model, research, did) {
  return research.pins.filter((p) => p.startsWith(did + ":")).map((p) => {
    const d = model.byId.get(did); const c = d?.cards.find((x) => `${did}:${x.key}` === p);
    if (!c) return null;
    const qs = (c.questions || [c.question]).map((q, k) => research.qEdits[`${p}#${k}`] ?? (k === 0 ? research.qEdits[p] ?? q : q));
    return { id: p, c, text: research.edits[p] ?? c.finding, qs, disp: research.disp[p] || "" };
  }).filter(Boolean);
}

function briefCharts(research, did, tpl, items) {
  const saved = research.briefCharts?.[`${did}:${tpl}`];
  if (saved) return saved;
  if (tpl !== "gen") return DEFAULT_CHARTS[tpl];
  const lenses = [...new Set(items.map((it) => it.c.lens))];
  if (lenses.length >= 2) return [LENS_CHART[lenses[0]], LENS_CHART[lenses[1]]];
  if (lenses.length === 1) return DEFAULT_CHARTS[lenses[0]];
  return ["utilPeers", "opsPeers"];
}

function Tray({ model, research, update, go }) {
  const districtsWithPins = [...new Set(research.pins.map((p) => p.split(":")[0]))];
  const did = research.briefDistrict && districtsWithPins.includes(research.briefDistrict) ? research.briefDistrict : districtsWithPins[0];
  const items = did ? pinnedFor(model, research, did) : [];
  const tpl = research.briefTemplate || "gen";
  const inc = items.filter((x) => x.disp === "include").slice(0, 3);
  const chartKeys = did ? briefCharts(research, did, tpl, inc) : [];
  const setChart = (k, v) => update((s) => ({ ...s, briefCharts: { ...s.briefCharts, [`${did}:${tpl}`]: Object.assign([...chartKeys], { [k]: v }) } }));
  const move = (id, dir) => update((s) => { const a = s.pins.slice(); const i = a.indexOf(id); const j = i + dir; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, pins: a }; });
  const meta = research.briefMeta?.[did] || {};
  const setMeta = (patch) => update((s) => ({ ...s, briefMeta: { ...s.briefMeta, [did]: { ...(s.briefMeta?.[did] || {}), ...patch } } }));
  useEffect(() => { document.body.classList.add("tray-open"); const k = (e) => e.key === "Escape" && go({ tray: null }); addEventListener("keydown", k);
    return () => { document.body.classList.remove("tray-open"); removeEventListener("keydown", k); }; }, []);
  return (
    <aside className="tray" aria-label="Brief builder">
      <div className="tray-head"><b>Brief builder</b><button className="linkbtn" onClick={() => go({ tray: null })}>Close ✕</button></div>
      <div className="tray-body">
        {!did && <p className="small muted">Pin findings from a district page to start a brief.</p>}
        {did && <>
          <label className="small">District <select value={did} onChange={(e) => update((s) => ({ ...s, briefDistrict: e.target.value }))} style={{ width: "100%", height: 32 }}>
            {districtsWithPins.map((x) => <option key={x} value={x}>{title(model.byId.get(x)?.name)} (TEA {x})</option>)}</select></label>
          <label className="small">Template <select value={tpl} onChange={(e) => update((s) => ({ ...s, briefTemplate: e.target.value }))} style={{ width: "100%", height: 32, marginBottom: 8 }}>
            {TEMPLATES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="small">Prepared for (optional)<input value={meta.preparedFor || ""} onChange={(e) => setMeta({ preparedFor: e.target.value })} placeholder="e.g. Jane Smith, CFO · Oct 14 meeting" style={{ width: "100%", height: 32, border: "1px solid #C9C7C2", marginBottom: 8 }} /></label>
          <div className="eyebrow" style={{ margin: "8px 0" }}>Pinned findings</div>
          {items.map((it, k) => (
            <div key={it.id} className="pinned">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b className="small">{it.c.title}</b>
                <span className="small"><button className="linkbtn" onClick={() => move(it.id, -1)} aria-label="Move up">↑</button> <button className="linkbtn" onClick={() => move(it.id, 1)} aria-label="Move down">↓</button> <button className="linkbtn" onClick={() => update((s) => ({ ...s, pins: s.pins.filter((p) => p !== it.id) }))}>Unpin</button></span></div>
              <textarea value={it.text} onChange={(e) => update((s) => ({ ...s, edits: { ...s.edits, [it.id]: e.target.value } }))} />
              <select value={it.disp} onChange={(e) => update((s) => ({ ...s, disp: { ...s.disp, [it.id]: e.target.value } }))} style={{ height: 28, marginTop: 4 }}>
                {DISPOSITIONS.map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}</select>
              <span className="small muted" style={{ marginLeft: 8 }}>{it.disp === "include" ? (inc.includes(it) ? "In export" : "Included, but only the first 3 fit on the page") : "Not in export"}</span>
            </div>))}
          <div className="eyebrow" style={{ margin: "16px 0 8px" }}>What we think may be happening (optional)</div>
          <textarea value={meta.story || ""} onChange={(e) => setMeta({ story: e.target.value })} placeholder="Two or three sentences in your own words. Printed below the findings when filled in." />
          <div className="eyebrow" style={{ margin: "16px 0 8px" }}>Charts (two)</div>
          {[0, 1].map((k) => (
            <select key={k} value={chartKeys[k] || ""} onChange={(e) => setChart(k, e.target.value)} style={{ width: "100%", height: 30, marginBottom: 6 }}>
              {CHART_OPTIONS.map(([v, l]) => <option key={v} value={v}>{k === 0 ? "Primary: " : "Secondary: "}{l}</option>)}</select>))}
          <div className="eyebrow" style={{ margin: "16px 0 8px" }}>Questions worth exploring</div>
          {inc.flatMap((it) => it.qs.map((q, k) => (
            <textarea key={it.id + k} value={q} onChange={(e) => update((s) => ({ ...s, qEdits: { ...s.qEdits, [`${it.id}#${k}`]: e.target.value } }))} style={{ marginBottom: 6, minHeight: 44 }} />))).slice(0, 5)}
          {!inc.length && <p className="small muted">Mark findings “Include in brief” to seed questions.</p>}
          <div className="eyebrow" style={{ margin: "16px 0 8px" }}>Meeting notes (internal, not printed)</div>
          <textarea value={research.briefNotes?.[did] || ""} onChange={(e) => update((s) => ({ ...s, briefNotes: { ...s.briefNotes, [did]: e.target.value } }))} />
          <button className="btn primary" style={{ width: "100%", marginTop: 16 }} onClick={() => { update((s) => ({ ...s, briefDistrict: did })); go({ v: "brief", tray: null }); }}>Preview at letter size</button>
        </>}
      </div>
    </aside>
  );
}

function BriefPage({ model, research, update, go }) {
  const [detailFoot, setDetailFoot] = useState(false);
  const did = research.briefDistrict; const d = did && model.byId.get(did);
  if (!d) return <div className="page"><p>Pick a district and pin findings first. <a href="#v=radar">Go to the radar</a></p></div>;
  const tpl = research.briefTemplate || "gen";
  const items = pinnedFor(model, research, did).filter((x) => x.disp === "include").slice(0, 3);
  const fallback = items.length ? items : d.cards.filter((c) => tpl === "gen" || c.lens === tpl).slice(0, 3)
    .map((c) => ({ id: `${did}:${c.key}`, c, text: c.finding, qs: c.questions || [c.question] }));
  const meta = research.briefMeta?.[did] || {};
  const docs = (research.docFindings?.[did] || []).slice(0, 2);
  const Y = model.years, last = Y.length - 1, e = d.s.enroll, name = title(d.name);
  const util = perStudent(d, "util"), uPeer = medianSeries(model, d.peers.ops, seriesFn("util"));
  const ctrl = seriesFn("ctrl")(d), cPeer = medianSeries(model, d.peers.ops, seriesFn("ctrl"));
  const i16 = Y.indexOf(2016);
  const keyNum = (c) => {
    if (c.key === "em-fit") return money(c.dollars);
    if (c.key === "em-budget") return money(c.value);
    if (c.value == null) return c.dollars != null ? money(c.dollars) : "—";
    if (["utility-growth", "om-shift", "om-growth"].includes(c.key)) return `+${Math.round(c.value * 100)} pts`;
    if (c.key === "cap-since") return c.value >= 99 ? "None" : `${Math.floor(c.value)} yrs`;
    if (c.key === "cap-retire") return `${Math.round(c.value * 100)}%`;
    if (c.key === "cap-capacity") return `$${c.value.toFixed(2)}`;
    return pct(c.value);
  };
  const chartFor = (k) => ({
    utilPeers: <LineCompare years={Y} fromYear={2016} height={190} series={[{ label: name, short: "District", values: util, kind: "district" }, { label: "Peer median", short: "Peers", values: uPeer, kind: "peer" }]} />,
    utilYoY: <YoYBars years={Y} values={util} height={160} />,
    opsMix: <Stack100 years={Y} d={d} height={190} />,
    opsPeers: <LineCompare years={Y} fromYear={2016} height={190} series={[{ label: name, short: "District", values: ctrl, kind: "district" }, { label: "Peer median", short: "Peers", values: cPeer, kind: "peer" }]} />,
    debt: d.debt ? <DebtBars profile={d.debt.profile} principal={d.debt.principal} highlightThrough={d.debt.fy + 5} height={180} /> : <div className="small muted">No outstanding debt on record.</div>,
    bonds: <BondTimeline bonds={d.bonds} height={190} />,
    enroll: <LineCompare years={Y} fromYear={2016} height={190} yFmt={(v) => v.toFixed(2)} series={[{ label: name, short: "District", values: e.map((v) => (v && e[i16] ? v / e[i16] : null)), kind: "district" }, { label: "Peer median", short: "Peers", values: medianSeries(model, d.peers.ops, (x) => x.s.enroll.map((v) => (v && x.s.enroll[i16] ? v / x.s.enroll[i16] : null))), kind: "peer" }]} />,
  })[k];
  const chartKeys = briefCharts(research, did, tpl, fallback);
  const qs = fallback.flatMap((it) => it.qs).filter(Boolean).slice(0, 4);
  const profile = tpl === "cap" ? [
    ["Outstanding debt", money(d.debt?.principal)], ["Retiring by FY2030 (est.)", money(d.debt?.retire5)], ["I&S tax rate", d.tax?.is.at(-1) != null ? `$${d.tax.is.at(-1).toFixed(2)}` : "—"],
    ["Property value / student", money(d.pv.value.at(-1) / e[last])], ["Bonds passed, 20 yrs", `${d.bonds.filter((b) => b.result === "Carried" && +b.date.slice(0, 4) >= 2006).length} of ${d.bonds.filter((b) => b.result !== "Cancelled" && +b.date.slice(0, 4) >= 2006).length}`],
  ] : [
    ["Plant M&O per student", money(d.s.f51[last] / e[last])], ["Utilities per student", money(util[last])], ["Utilities share of plant M&O", pct(d.s.util[last] / d.s.f51[last], { signed: false })],
    ["Campuses per 1,000 students", (d.campuses / (e[last] / 1000)).toFixed(2)], ["FY2026 plant budget", d.budget.f51?.["2026"] ? pct(d.budget.f51["2026"] / d.s.f51[last] - 1) + " vs FY25" : "—"],
  ];
  const sources = [...new Set(fallback.map((it) => it.c.source.split(",")[0]))];
  if (chartKeys.some((k) => k === "debt")) sources.push("Texas Bond Review Board debt outstanding");
  return (
    <div style={{ background: "#EFEEEC", minHeight: "100vh", padding: "24px 0" }}>
      <div className="no-print" style={{ maxWidth: 816, margin: "0 auto 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={tpl} onChange={(e) => update((s) => ({ ...s, briefTemplate: e.target.value }))} style={{ height: 36 }}>{TEMPLATES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn" onClick={() => go({ tray: "1", v: "district", d: did })}>Edit in tray</button>
        <button className="btn primary" onClick={() => print()}>Print / PDF</button>
        <label className="small"><input type="checkbox" checked={detailFoot} onChange={(e) => setDetailFoot(e.target.checked)} /> Detailed sources & caveats</label>
        {!items.length && <span className="small muted">No findings marked Include; showing top findings for this template.</span>}
      </div>
      <article className="brief-page">
        <div className="brief-top"><img src="brand/upchurch-horizontal-black.png" alt="Upchurch" style={{ height: 20 }} /><span className="eyebrow" style={{ fontSize: 10 }}>{TEMPLATES.find((t) => t[0] === tpl)[1]}</span><span className="eyebrow" style={{ fontSize: 10 }}>Prepared {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span></div>
        {meta.preparedFor && <div className="tiny muted" style={{ marginTop: 8 }}>Prepared for {meta.preparedFor}</div>}
        <h1 className="serif" style={{ fontSize: 42, fontWeight: 600, margin: "14px 0 2px", letterSpacing: "-.02em" }}>{name}</h1>
        <div className="small muted">TEA {d.id} · {d.county} County · ESC Region {d.region} · {num(e[last])} students ({pct(e[last] / e[last - 5] - 1, { digits: 1 })}, 5 yr) · {d.campuses} campuses{d.tips ? " · TIPS member (cooperative purchasing available)" : ""}</div>
        <div className="eyebrow brief-h">Why we're looking</div>
        {fallback.map((it) => (
          <div key={it.id} className="brief-find"><div><div className="serif" style={{ fontSize: 26, color: "#004E99", fontWeight: 600 }}>{keyNum(it.c)}</div><div className="tiny muted">{KEY_LABEL[it.c.key] || ""}</div></div>
            <div><b>{it.c.title}</b><div style={{ fontSize: 13.5 }}>{it.text}</div><div className="tiny muted">{it.c.compare} · {it.c.period}</div></div></div>))}
        {docs.map((x, i) => (
          <div key={"doc" + i} className="brief-find"><div className="tiny muted" style={{ paddingTop: 4 }}>▤ From district documents</div>
            <div className="doc-find"><div style={{ fontSize: 13.5 }}>{x.text}</div>{x.source && <div className="tiny muted">{x.source}</div>}</div></div>))}
        {meta.story && <p style={{ fontSize: 13.5, margin: "12px 0 0" }}><b>What we think may be happening. </b>{meta.story}</p>}
        <div className="brief-charts">{chartKeys.map((k, i) => <div key={i}><b className="small">{CHART_OPTIONS.find((c) => c[0] === k)?.[1]}</b>{chartFor(k)}</div>)}</div>
        <div className="eyebrow brief-h">{tpl === "cap" ? "Capital context" : "Facilities operating profile"}</div>
        <div className="brief-metrics">{profile.map(([l, v]) => <div key={l}><div className="tiny muted">{l}</div><b style={{ fontSize: 17 }}>{v}</b></div>)}</div>
        <div className="eyebrow brief-h">Questions worth exploring</div>
        <ol className="serif" style={{ fontSize: 15, paddingLeft: 20, margin: 0 }}>{qs.map((q, k) => <li key={k} style={{ marginBottom: 6 }}>{q}</li>)}</ol>
        <div className="brief-foot">
          {detailFoot ? <>
            <p><b>Sources.</b> {sources.join("; ")}. Enrollment: TEA PEIMS FY2025.</p>
            <p><b>Peers.</b> {d.peers.ops.length} districts matched on enrollment, locale, location and campuses per 1,000 students. Medians, not averages.</p>
            <p><b>Caveats.</b> Per-student figures; district square footage isn't publicly available. Findings are observations from public data, offered with possible explanations. Not a facility condition assessment.</p>
          </> : <p>Sources: {sources.join("; ")}. Peers: {d.peers.ops.length} similar districts (medians). Based on public data; not a facility condition assessment.</p>}
          <p>Prepared by Upchurch · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
      </article>
    </div>
  );
}

function Compare({ model, research, update, go }) {
  const ids = research.compareIds.filter((id) => model.byId.has(id));
  const ds = ids.map((id) => model.byId.get(id));
  const Y = model.years, last = Y.length - 1;
  const rows = [
    ["Enrollment", [["Students, FY2025", (d) => num(d.s.enroll[last])], ["5-yr change", (d) => pct(d.s.enroll[last] / d.s.enroll[last - 5] - 1, { digits: 1 })], ["Campuses", (d) => d.campuses]]],
    ["Plant M&O and utilities", [["Plant M&O per student", (d) => money(d.s.f51[last] / d.s.enroll[last])], ["Utilities per student", (d) => money(perStudent(d, "util")[last])], ["Utilities share of plant M&O", (d) => pct(d.s.util[last] / d.s.f51[last], { signed: false })], ["Utility growth FY19–25", (d) => pct(d.s.util[last] / d.s.util[Y.indexOf(2019)] - 1)]]],
    ["Tax base and rates", [["Property value per student", (d) => money(d.pv.value.at(-1) / d.s.enroll[last])], ["M&O rate", (d) => (d.tax?.mo.at(-1) != null ? `$${d.tax.mo.at(-1).toFixed(4)}` : "Not available (charter)")], ["I&S rate", (d) => (d.tax?.is.at(-1) != null ? `$${d.tax.is.at(-1).toFixed(4)}` : "Not available (charter)")]]],
    ["Debt and bonds", [["Outstanding principal", (d) => (d.debt ? money(d.debt.principal) : d.charter ? "Not available (charter)" : "$0")], ["Retiring by FY2030 (est.)", (d) => money(d.debt?.retire5)], ["Last bond", (d) => { const b = d.bonds.filter((x) => x.result !== "Cancelled").at(-1); return b ? `${b.date.slice(0, 7)} · ${b.result === "Carried" ? "passed" : "failed"} · ${money(b.amount)}` : "None on record"; }]]],
    ["Opportunity sizing (internal)", [["Est. ESCO project (base)", (d) => money(d.sizing?.esco.project[1])], ["Est. Uptime Ops fee /yr", (d) => money(d.sizing?.ops.fee)],
      ["Est. EMaaS net /yr", (d) => (d.sizing?.emaas.eligible ? money(d.sizing.emaas.net[1]) : "Outside size band")], ["TIPS member", (d) => (d.tips ? `Yes${d.tips.since ? `, since ${d.tips.since.slice(0, 4)}` : ""}` : "No")]]],
    ["Peer percentiles", LENSES.slice(0, 2).map((l) => [l.headline, (d) => (d.lens[l.key].pctl != null ? `${d.lens[l.key].pctl}th` : "—")])],
    ["Trend", [["Utilities per student, 10 yrs", (d) => <Sparkline values={perStudent(d, "util").slice(-10)} />], ["Enrollment, 10 yrs", (d) => <Sparkline values={d.s.enroll.slice(-10)} />]]],
  ];
  const suggest = () => { if (!ds[0]) return; update((s) => ({ ...s, compareIds: [ds[0].id, ...ds[0].peers.ops.slice(0, 3)] })); };
  return (
    <div className="page narrow">
      <div className="eyebrow">Compare districts</div>
      <h1 className="display">Side by side</h1>
      <div className="filters">
        <DistrictPicker model={model} placeholder={ds.length >= 4 ? "Four districts maximum" : "Add a district"} exclude={ids}
          onPick={(d) => update((s) => ({ ...s, compareIds: [...new Set([...s.compareIds, d.id])].slice(0, 4) }))} />
        <button className="btn" disabled={!ds.length} onClick={suggest}>Suggest similar districts</button>
        {!!ds.length && <button className="linkbtn" onClick={() => update((s) => ({ ...s, compareIds: [] }))}>Clear</button>}
      </div>
      {!ds.length ? <p className="muted">Add up to four districts, or use “Compare” on a district page.</p> : (
        <div className="tablewrap"><table className="data"><thead><tr><th style={{ width: 220 }} />{ds.map((d, i) => <th key={d.id} style={i === 0 ? { background: "#F7F7F6" } : null}>
          <a href={`#v=district&d=${d.id}`}>{title(d.name)}</a><div className="dmeta" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{d.county} Co. · Region {d.region} · TEA {d.id}</div> <button className="linkbtn" onClick={() => update((s) => ({ ...s, compareIds: s.compareIds.filter((x) => x !== d.id) }))} aria-label="Remove">×</button></th>)}</tr></thead>
          <tbody>{rows.map(([grp, rs]) => [<tr key={grp}><td colSpan={ds.length + 1} className="eyebrow" style={{ paddingTop: 18 }}>{grp}</td></tr>,
            ...rs.map(([lbl, fn]) => <tr key={grp + lbl}><td className="small">{lbl}</td>{ds.map((d, i) => <td key={d.id} className="num" style={i === 0 ? { background: "#F7F7F6" } : null}>{fn(d)}</td>)}</tr>)])}</tbody></table></div>)}
    </div>
  );
}

function Methodology({ model }) {
  const t = model.meta.thresholds, S = model.meta.sizing;
  return (
    <div className="page narrow" style={{ maxWidth: 860 }}>
      <div className="eyebrow">Methodology</div>
      <h1 className="display">How findings are made</h1>
      <blockquote className="serif" style={{ fontSize: 20, borderLeft: "2px solid #0082FF", paddingLeft: 16, margin: "0 0 24px" }}>The dashboard identifies credible, evidence-backed hypotheses. It cannot diagnose building condition or guarantee savings without district-specific facility and utility data.</blockquote>
      <h3>Language rules</h3>
      <ul><li><b>“Utilities”</b> means PEIMS object 6259: electricity, gas, water, wastewater and telephone combined. It's never labeled “energy.”</li>
        <li>Fiscal years end in June: FY2025 is the 2024-25 school year. FY2020 includes spring 2020 COVID closures, so it's never used as a baseline.</li>
        <li><b>“Plant operations”</b> means Function 51 excluding property insurance (market-driven) and capital outlay.</li>
        <li>All comparisons use medians. All costs are per enrolled student, since square footage isn't public.</li></ul>
      <h3>Peers</h3>
      <p>Each district gets two peer sets of the {model.meta.kPeers} nearest districts (charters only match charters). <b>Operations peers</b> are matched on enrollment (log scale, double weight), locale, location (a climate proxy) and campuses per 1,000 students. <b>Capital peers</b> are matched on enrollment, 5-year growth, property value per student, locale, debt per student and I&S rate.</p>
      <h3>Signals</h3>
      <p>Districts with fewer than {t.min_enrollment} students get no signals. Strength combines size and persistence: “Strong” needs a large gap that has held in at least 3 of the last 4 years.</p>
      <table className="data"><thead><tr><th>Signal</th><th>Rule</th></tr></thead><tbody>
        <tr><td>Utility-cost level</td><td>Utilities per student ≥ {t.pc_level * 100}% above operations-peer median (Strong ≥ {t.pc_level_strong * 100}% and persistent)</td></tr>
        <tr><td>Utility growth outpacing peers</td><td>FY2019→FY2025 growth in utilities per student ≥ {t.pc_growth_pts * 100} points above the peer median (Strong ≥ {t.pc_growth_strong * 100})</td></tr>
        <tr><td>Plant operations cost level</td><td>Plant operations per student ≥ {t.om_level * 100}% above peers</td></tr>
        <tr><td>Spending well below peers</td><td>≥15% below peers in 3 of 4 years and ≥{Math.abs(t.om_low) * 100}% below in FY2025</td></tr>
        <tr><td>Operating-model shift</td><td>Contracted services' share of non-utility plant operations up ≥ {t.om_shift_pts * 100} points (FY2017–19 vs FY2023–25 averages)</td></tr>
        <tr><td>Costs rising faster than enrollment</td><td>(Plant operations growth − enrollment growth) since FY2019 exceeds the peer median by ≥ {t.om_growth_pts * 100} points</td></tr>
        <tr><td>Plant M&O budget increase</td><td>FY2026 adopted Function 51 budget ≥ {t.budget_jump * 100}% above FY2025 actual</td></tr>
        <tr><td>Time since last passed bond</td><td>≥ {t.cap_years} years and enrollment not down more than 5%</td></tr>
        <tr><td>Enrollment growth</td><td>≥ {t.cap_growth * 100}% over five years</td></tr>
        <tr><td>Debt capacity freeing up</td><td>≥ {t.cap_retire * 100}% of outstanding principal retires within 5 years (straight-line estimate)</td></tr>
        <tr><td>Recent failed / approved bond</td><td>Failed within 36 months / passed within 18 months</td></tr>
        <tr><td>Tax capacity for debt</td><td>I&S rate ≤ ${t.cap_is_low.toFixed(2)} and property value per student at or above capital peers</td></tr>
        <tr><td>Right-sized for a shared energy manager</td><td>{num(S.emaas.enrollment_min)}–{num(S.emaas.enrollment_max)} students and estimated EMaaS savings exceed the {money(S.emaas.annual_fee)} fee (Strong ≥ $60K net/yr, Moderate ≥ $30K)</td></tr>
        <tr><td>Utility costs worth managing</td><td>Only with the fit signal: utilities per student ≥ 15% above peers, or growth ≥ 10 points above peers since FY2019</td></tr>
        <tr><td>General-fund operating deficit</td><td>Only with the fit signal: FY2025 general-fund operating expenditures exceed operating revenue (Moderate when the gap is over $250/student)</td></tr>
      </tbody></table>
      <h3>Evidence and magnitude</h3>
      <p>Evidence per lens is <b>Strong</b> when a Strong signal fires alongside another signal, <b>Moderate</b> with any Moderate signal or two signals, otherwise <b>Limited</b>. It's downgraded one step for districts under 1,000 students. Magnitude uses the internal sizing below: estimated ESCO project value (performance contracting), estimated annual Uptime Ops fee (O&M), estimated EMaaS savings net of fee (energy manager), or estimated debt retiring within five years (capital).</p>
      <h3>Priority opportunities</h3>
      <p>The radar opens on <b>priority opportunities</b>: Strong evidence, or at least two agreeing signals (three for capital planning, where signals are common) with Moderate evidence. For Energy Manager as a Service, the “right-sized” signal must be Moderate or Strong and backed by a utility or budget signal. Districts with data-continuity flags are excluded from priority lists. “Any signal” and “All districts” remain one click away.</p>
      <h3>Data-continuity guards</h3>
      <p>Records are flagged, never dropped, when enrollment moves more than 40% in a single year (restructuring, mergers or virtual-program enrollment), when financial or enrollment years are missing, or when utilities or plant operations per student in any year fall outside 0.4–2.5× the district's typical year. Flagged districts show “Review data continuity,” their signals are capped at Moderate, and they don't appear in priority lists.</p>
      <h3>Opportunity sizing (internal)</h3>
      <p>Sizing applies Upchurch's current commercial assumptions to public data. It ranks and prepares; it isn't a quote, and it never appears on the brief.</p>
      <ul>
        <li><b>Inefficiency index</b> (0–1): plant O&M per student ÷ ops-peer median, scaled from {S.inefficiency.median_offset}× (0) to {(S.inefficiency.median_offset + S.inefficiency.span).toFixed(2)}× (1), then × {S.inefficiency.high_capital_factor} when recent capital spending per student is in the top quartile.</li>
        <li><b>ESCO project</b>: energy basis = FY2025 utilities × {S.energy_share.default}. Savings rate from the plant O&M ratio ({S.esco.savings_bands_by_f51_ratio.map(([t, r]) => `${t == null ? "above" : "≤" + t + "×"}: ${Math.round(r * 100)}%`).join(", ")}), adjacent bands for low/high, −{Math.round(S.esco.high_capital_reduction * 100)} pts for high capital, floor {Math.round(S.esco.savings_floor * 100)}%. Project = annual savings × {S.esco.project_multiple_by_enrollment.map(([, m]) => m).join("/")} by enrollment band. Score = {S.esco.priority_weights.budget_stress * 100}% budget stress + {S.esco.priority_weights.savings_per_student * 100}% savings per student + {S.esco.priority_weights.inefficiency * 100}% inefficiency.</li>
        <li><b>Uptime Ops</b>: base = {S.uptime_ops.base === "addressable" ? "plant staff, contracted repair, other contracted services and supplies (no utilities, insurance or capital, so it doesn't double-count ESCO savings)" : "all of Function 51"}. Savings = {Math.round(S.uptime_ops.savings_rate.base * 100)}% + {Math.round(S.uptime_ops.savings_rate.per_inefficiency * 100)}% × inefficiency; fee = {Math.round(S.uptime_ops.fee_rate.base * 100)}% + {Math.round(S.uptime_ops.fee_rate.per_inefficiency * 100)}% × inefficiency.</li>
        <li><b>Energy Manager as a Service</b>: for {num(S.emaas.enrollment_min)}–{num(S.emaas.enrollment_max)} students, where a full-time energy manager is hard to justify. Savings = ESCO base rate − {Math.round(S.emaas.savings_offset_from_esco * 100)} pts, held to {Math.round(S.emaas.savings_min * 100)}–{Math.round(S.emaas.savings_max * 100)}% of utilities; net = savings − {money(S.emaas.annual_fee)}/yr fee.</li>
        <li>Uptime Ops and EMaaS scores (0–100) rescale each input between its 5th and 95th percentile so a few extreme districts don't compress everyone else.</li>
      </ul>
      <p className="small muted">“Utilities” include water and telephone, so energy-only savings are somewhat overstated; lower the energy share in config/sizing.json to adjust.</p>
      <h3>Procurement</h3>
      <p>TIPS (The Interlocal Purchasing System) membership comes from the TIPS member list, matched by TEA district number and then by name ({model.districts.filter((d) => d.tips).length} districts and charters matched). Membership means the district can buy through TIPS cooperative contracts. TIPS contacts are whoever registered with TIPS and may not be facilities or finance staff.</p>
      <h3>Sources and freshness</h3>
      <ul>{Object.values(model.meta.freshness).map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="small muted">Data built {new Date(model.meta.built).toLocaleString()}.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function App() {
  const [model, setModel] = useState(null);
  const [boot, setBoot] = useState("checking");
  const [research, update] = useResearch();
  const [hash, go] = useHashState();
  const [toastMsg, setToast] = useState(null);
  const toast = (m) => { setToast(m); clearTimeout(window.__t); window.__t = setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    const k = savedKey();
    if (!k) { setBoot("locked"); return; }
    decryptBundle(k).then((b) => { setModel(buildModel(b)); setBoot("ready"); }).catch(() => { forgetKey(); setBoot("locked"); });
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [hash.v, hash.d]);

  if (boot === "checking") return <div className="loading">Loading…</div>;
  if (boot === "locked") return <Unlock onUnlock={(b) => { setModel(buildModel(b)); setBoot("ready"); }} />;

  const v = hash.v || "radar";
  const d = hash.d && model.byId.get(hash.d);
  if (v === "brief") return <BriefPage model={model} research={research} update={update} go={go} />;
  return (
    <>
      <Header model={model} hash={hash} go={go} research={research} update={update} toast={toast} />
      <main className="main">
        {v === "radar" && <Radar model={model} research={research} update={update} hash={hash} go={go} />}
        {v === "district" && (d ? <District model={model} d={d} research={research} update={update} hash={hash} go={go} toast={toast} /> : <div className="page">District not found. <a href="#v=radar">Back to the radar</a></div>)}
        {v === "compare" && <Compare model={model} research={research} update={update} go={go} />}
        {v === "methodology" && <Methodology model={model} />}
      </main>
      {hash.tray && <Tray model={model} research={research} update={update} go={go} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
