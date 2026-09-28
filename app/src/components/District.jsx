import { useMemo, useState, useEffect } from "react";
import { LENSES, medianSeries, perStudent, controllable, regionIds, stateIds, seriesFn } from "../lib/data.js";
import { money, num, pct, title, REGION_NAMES, fy, campusLabel } from "../lib/format.js";
import Figure from "./Figure.jsx";
import { LineCompare, Stack100, YoYBars, BondTimeline, DebtBars, SmallLine, StrengthIcon, STACK_PARTS } from "./charts.jsx";

export const DISPOSITIONS = [
  ["", "Set disposition"], ["include", "Include in brief"], ["investigate", "Investigate"],
  ["explained", "Explained by district"], ["irrelevant", "Not relevant"], ["follow", "Follow up later"],
];
const TABS = [["ops", "Facilities operating profile"], ["cap", "Capital & bond profile"], ["budget", "Budget & enrollment"],
  ["peers", "Peers"], ["sizing", "Sizing & procurement"], ["research", "Research further"], ["notes", "Notes"], ["sources", "Data & sources"]];
const DOCS = ["Adopted budget", "Annual financial report", "Facility master plan", "Capital improvement plan", "Bond website",
  "Bond proposition language", "Board agendas & presentations", "Energy management plan", "Recent RFQs/RFPs", "Strategic plan"];

function HypCard({ d, c, research, update, toast, go, guide }) {
  const id = `${d.id}:${c.key}`;
  const [open, setOpen] = useState(false);
  const disp = research.disp[id] || "";
  const pinned = research.pins.includes(id);
  const text = research.edits[id] ?? c.finding;
  const setDisp = (v) => update((s) => ({ ...s, disp: { ...s.disp, [id]: v } }));
  const pin = () => {
    update((s) => ({ ...s, pins: pinned ? s.pins.filter((p) => p !== id) : [...s.pins, id],
      disp: !pinned && !s.disp[id] ? { ...s.disp, [id]: "include" } : s.disp }));
    toast(pinned ? `Unpinned "${c.title}"` : `Pinned "${c.title}" to the brief`);
  };
  return (
    <div className="hcard">
      <div className="hrow">
        <StrengthIcon level={c.strength} />
        <div><div className="t">{c.title}</div><div className="f">{text}</div></div>
        <div className="dol">{c.dollars != null ? `${money(c.dollars)}${c.dollarsLabel?.startsWith("/") ? c.dollarsLabel : " " + (c.dollarsLabel || "")}` : ""}<span>{c.period}</span></div>
        <div>
          <select value={disp} onChange={(e) => setDisp(e.target.value)} aria-label={`Disposition for ${c.title}`}>
            {DISPOSITIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className={"pin" + (pinned ? " on" : "")} onClick={pin}>{pinned ? "✓ Pinned to brief" : "Pin to brief"}</button>
        </div>
        <button className="chev" aria-expanded={open} aria-label="Show details" onClick={() => setOpen((o) => !o)}>{open ? "▴" : "▾"}</button>
      </div>
      {open && (
        <div className="hexp">
          <div />
          <div>
            <div className="caveat">{c.caveat}</div>
            {(c.questions || [c.question]).map((q, k) => <div key={k} className="ask"><b>ASK</b>{research.qEdits[`${id}#${k}`] ?? (k === 0 ? research.qEdits[id] ?? q : q)}</div>)}
            {guide && (
              <div className="guide">
                <div><h4>Why this may matter</h4><p>{guide.why}</p></div>
                <div><h4>Possible explanations</h4><ul>{guide.explanations.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><h4>What would confirm or rule it out</h4><ul>{guide.requests.map((x) => <li key={x}>{x}</li>)}</ul></div>
                <div><h4>Who to ask</h4><p>{guide.who}</p><h4 style={{ marginTop: 10 }}>Suggested next step</h4><p>{guide.next}</p></div>
              </div>)}
            <div className="small muted">
              <span className="fresh">{c.source}</span> · {c.compare}{c.compare.startsWith("vs") && <> (<button className="linkbtn small" onClick={() => go({ tab: "peers" })}>see peers</button>)</>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, delta, sub, fresh, children }) {
  return (<div className="mtile"><div className="lbl">{label}</div><div className="val num">{value}{delta && <small>{delta}</small>}</div>
    {sub && <div className="sub">{sub}</div>}{children}{fresh && <span className="fresh">{fresh}</span>}</div>);
}

export default function District({ model, d, research, update, hash, go, toast }) {
  const tab = hash.tab || "ops";
  const lens = hash.lens || "pc";
  const f = model.meta.freshness;
  const Y = model.years, last = Y.length - 1, i19 = Y.indexOf(2019);
  const name = title(d.name);
  const e = d.s.enroll;
  const eg5 = e[last] / e[last - 5] - 1;
  const ops = d.peers.ops, cap = d.peers.cap;
  const reg = useMemo(() => regionIds(model, d), [model, d]);
  const st = useMemo(() => stateIds(model, d), [model, d]);
  const ms = (ids, fn) => medianSeries(model, ids, fn);
  const utilFn = seriesFn("util"), ctrlFn = seriesFn("ctrl");
  const util = utilFn(d), ctrlps = ctrlFn(d);
  const utilPeer = useMemo(() => ms(ops, utilFn), [d]);
  const utilReg = useMemo(() => ms(reg, utilFn), [d]);
  const utilState = useMemo(() => ms(st, utilFn), [d]);
  const ctrlPeer = useMemo(() => ms(ops, ctrlFn), [d]);
  const ctrlReg = useMemo(() => ms(reg, ctrlFn), [d]);
  const ctrlState = useMemo(() => ms(st, ctrlFn), [d]);
  const peerDef = `Peers: ${ops.length} districts matched on enrollment, locale, location and campuses per 1,000 students. Medians, not averages.`;
  const capPeerDef = `Peers: ${cap.length} districts matched on enrollment, growth, property value per student, locale, debt and I&S rate.`;
  const lastBond = d.bonds.filter((b) => b.result !== "Cancelled").at(-1);
  const b26 = d.budget.f51?.["2026"], a25 = d.s.f51[last];
  const campusesPerK = d.campuses / (e[last] / 1000);
  const peerCpk = medianSeries(model, ops, (x) => [x.campuses / ((x.s.enroll.at(-1) || 1) / 1000)])[0];

  const cardsByLens = LENSES.map((l) => ({ ...l, cards: d.cards.filter((c) => c.lens === l.key) }));
  const orderedLenses = [...cardsByLens.filter((l) => l.key === lens), ...cardsByLens.filter((l) => l.key !== lens)];
  const docFindings = research.docFindings?.[d.id] || [];
  const guideFor = (k) => model.meta.guide?.[k];
  const [showFindings, setShowFindings] = useState(!hash.tab);
  useEffect(() => { setShowFindings(!hash.tab); }, [d.id]);
  const rank = { Strong: 3, Moderate: 2, Weak: 1 };
  const primary = [...d.cards].sort((a, b) => (b.lens === lens) - (a.lens === lens) || rank[b.strength] - rank[a.strength] || (b.dollars || 0) - (a.dollars || 0))[0];

  const csvLine = (rows) => [["Fiscal year", ...rows.map((r) => r.label)], ...Y.map((y, i) => [fy(y), ...rows.map((r) => (r.values[i] == null ? "" : Math.round(r.values[i] * 100) / 100))])];

  return (
    <div className="page narrow">
      <div className="crumb"><a href="#v=radar">Opportunity Radar</a> / {name}</div>
      <div className="dhead">
        <div>
          <div className="eyebrow">District research</div>
          <h1 className="display xl">{name}</h1>
          <div className="muted">TEA {d.id} · {d.county} County · ESC Region {d.region} ({REGION_NAMES[d.region]}){d.localeDetail ? ` · ${d.localeDetail}` : ""}{d.charter ? " · Charter" : ""}
            {d.tips && <button className="tips-tag linkbtn" style={{ fontSize: 11 }} onClick={() => go({ tab: "sizing" }, { replace: true })} title="See TIPS contacts">TIPS member{d.tips.since ? ` since ${d.tips.since.slice(0, 4)}` : ""}</button>}</div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => {
            const top = d.cards.filter((c) => c.lens === lens).slice(0, 3).map((c) => `${d.id}:${c.key}`);
            if (!top.length) { toast("No findings under this lens to add"); return; }
            update((s) => ({ ...s, pins: [...new Set([...s.pins, ...top])], disp: { ...Object.fromEntries(top.map((t) => [t, "include"])), ...s.disp }, briefDistrict: d.id }));
            go({ tray: "1" }); toast(`Added ${top.length} findings to the brief`);
          }}>Add to brief</button>
          <button className="btn" onClick={() => { update((s) => ({ ...s, compareIds: [...new Set([d.id, ...s.compareIds])].slice(0, 4) })); go({ v: "compare" }); }}>Compare</button>
          <button className="btn" onClick={() => { update((s) => ({ ...s, briefDistrict: d.id })); go({ v: "brief" }); }}>Brief</button>
        </div>
      </div>
      {primary && (
        <div className="primary-hyp">
          <div><div className="eyebrow" style={{ fontSize: 11 }}>Primary hypothesis · {LENSES.find((l) => l.key === primary.lens).label}</div>
            <div className="t">{primary.title}</div><div className="small">{research.edits[`${d.id}:${primary.key}`] ?? primary.finding}</div></div>
          <div style={{ maxWidth: 360 }}><div className="eyebrow" style={{ fontSize: 11 }}>Suggested next step</div><div className="nx">{guideFor(primary.key)?.next}</div></div>
        </div>)}
      {d.dq?.length > 0 && <div className="dq-banner"><b>Review data continuity.</b> {d.dq.join(" ")} Signals for this district are capped at Moderate and it's excluded from priority lists until checked.</div>}
      <div className="statgrid">
        <div><div className="lbl">Enrollment</div><div className="val">{num(e[last])}</div><div className="sub">{pct(eg5, { digits: 1 })} over 5 years</div></div>
        <div><div className="lbl">Campuses</div><div className="val">{d.campuses}</div><div className="sub">{Object.entries(d.campusTypes).map(([k, v]) => `${v} ${campusLabel(k)}`).join(" · ")}</div></div>
        <div><div className="lbl">Plant M&O budget, FY2026</div><div className="val">{money(b26)}</div><div className="sub">Function 51{b26 && a25 ? ` · ${pct(b26 / a25 - 1)} vs FY25 actual` : ""}</div></div>
        <div><div className="lbl">Annual utilities</div><div className="val">{money(d.s.util[last])}</div><div className="sub">FY2025 actual</div></div>
        <div><div className="lbl">Most recent bond</div><div className="val">{lastBond ? money(lastBond.amount) : "None on record"}</div>
          <div className="sub">{lastBond ? `${new Date(lastBond.date + "T12:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })} · ${lastBond.result === "Carried" ? "Passed" : "Failed"}${lastBond.for + lastBond.against ? `, ${Math.round((lastBond.for / (lastBond.for + lastBond.against)) * 100)}% yes` : ""}` : ""}</div></div>
        <div><div className="lbl">Outstanding debt</div><div className="val">{d.debt ? money(d.debt.principal) : d.charter ? "n/a" : "$0"}</div><div className="sub">{d.debt ? `${money(d.debt.principal / e[last])} per student` : ""}</div></div>
        <div><div className="lbl">Superintendent</div><div className="val" style={{ fontSize: 14 }}>{d.superintendent ? title(d.superintendent) : "—"}</div><div className="sub">TEA directory 2024-25</div></div>
        <div><div className="lbl">A–F rating, 2026</div><div className="val">{d.rating || "—"}</div><div className="sub">Context only</div></div>
      </div>

      <div className="hyp-head">
        <h2 className="section">Opportunity hypotheses</h2>
        <p>Evidence-backed hypotheses from public data. They cannot diagnose building condition or guarantee savings without district-specific facility and utility data. <a href="#v=methodology">Methodology</a></p>
      </div>
      {d.tooSmall && <div className="caveat">This district has fewer than 500 students, so per-student comparisons aren't reliable enough to generate signals. The charts below still show its data.</div>}
      {!showFindings ? (
        <div className="findings-summary">
          <b>Opportunity summary:</b>
          {cardsByLens.map((l) => <span key={l.key} className="small">{l.cards.length} {l.label}</span>)}
          <button className="btn ghost" onClick={() => setShowFindings(true)}>Expand findings</button>
        </div>
      ) : (<>
        {orderedLenses.filter((l) => l.cards.length).map((l) => (
          <div key={l.key} className="lensgroup">
            <span className="eyebrow">{l.label} <span className="muted" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{l.cards.length} hypothes{l.cards.length === 1 ? "is" : "es"}</span></span>
            {l.cards.map((c) => <HypCard key={c.key} d={d} c={c} research={research} update={update} toast={toast} go={go} guide={guideFor(c.key)} />)}
          </div>
        ))}
        {orderedLenses.some((l) => !l.cards.length) && (
          <div className="nosig">No signals under {orderedLenses.filter((l) => !l.cards.length).map((l) => l.label).join(" or ")}
            {d.charter && orderedLenses.find((l) => l.key === "cap" && !l.cards.length) ? " (debt and bond data aren't available for charters)" : ""} with current peers and data.
            {tab && <button className="linkbtn" style={{ marginLeft: 12 }} onClick={() => setShowFindings(false)}>Collapse findings</button>}</div>)}
      </>)}
      {!!docFindings.length && (
        <div className="lensgroup"><span className="eyebrow">From district documents</span>
          {docFindings.map((x, i) => <div key={i} className="hcard"><div className="hrow" style={{ gridTemplateColumns: "110px 1fr" }}><span className="strength">▤ Document</span><div className="doc-find"><div className="f">{x.text}</div><div className="small muted">{x.source}{x.date ? ` · added ${x.date}` : ""}</div></div></div></div>)}
        </div>)}

      <div className="tabs" role="tablist">{TABS.map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { go({ tab: k }, { replace: true }); setShowFindings(false); }}>{v}</button>)}</div>

      {tab === "ops" && (
        <>
          <div className="mtiles">
            <Tile label="Utilities per student" value={money(util[last])} delta={utilPeer[last] ? pct(util[last] / utilPeer[last] - 1) + " vs peers" : ""} sub={`Peer median ${money(utilPeer[last])}`} fresh={f.peims} />
            <Tile label="Utilities share of plant M&O" value={pct(d.s.util[last] / d.s.f51[last], { signed: false })} sub="Utilities combine electricity, gas, water, wastewater and telephone" fresh={f.peims} />
            <Tile label="Utility growth vs enrollment, FY2019–FY2025" value={pct(d.s.util[last] / d.s.util[i19] - 1)} delta={`enrollment ${pct(e[last] / e[i19] - 1)}`} sub="Total utility dollars vs students" fresh={f.peims} />
            <Tile label="FY2026 plant M&O budget vs FY2025 actual" value={b26 && a25 ? pct(b26 / a25 - 1, { digits: 1 }) : "—"} sub={`${money(b26)} budgeted vs ${money(a25)} actual. Budgets don't separate utilities.`} fresh={f.budget} />
            <Tile label="Campuses per 1,000 students" value={campusesPerK.toFixed(2)} delta={peerCpk ? `peers ${peerCpk.toFixed(2)}` : ""} sub={`${d.campuses} campuses; more campuses per student usually means more building area to operate`} fresh={f.campuses} />
            <Tile label="Property insurance per student" value={money(d.s.insurance[last] / e[last])} sub="Shown separately: market-driven, not a facilities-management signal" fresh={f.peims} />
          </div>
          <div className="figs">
            <Figure full district={name} toast={toast} title="How the plant maintenance & operations budget is spent" def="Share of plant maintenance & operations (Function 51) spending by component, excluding property insurance"
              freshness={f.peims} source="TEA PEIMS actuals, Function 51 by object code" caveat={`Insurance (${money(d.s.insurance[last] / e[last])}/student) is excluded: premiums are market-driven, not a facilities-management signal.`}
              peers="District only; no peer comparison"
              csv={[["Fiscal year", ...STACK_PARTS.map((p) => p.label)], ...Y.map((y, i) => [fy(y), ...STACK_PARTS.map((p) => d.s[p.key][i] ?? "")])]}>
              <Stack100 years={Y} d={d} />
            </Figure>
            <Figure district={name} toast={toast} title={`Utility spending per student vs similar districts`} def="Utilities per student (electricity, gas, water, wastewater and telephone combined), nominal $"
              freshness={f.peims} source="TEA PEIMS actuals, Function 51 object 6259" peers={peerDef} caveat="Per-student figures; district square footage isn't publicly available."
              csv={csvLine([{ label: name, values: util }, { label: "Peer median", values: utilPeer }, { label: "ESC region median", values: utilReg }, { label: "Statewide median", values: utilState }])}>
              <LineCompare years={Y} fromYear={2016} series={[
                { label: name, short: name.replace(/ ISD| CISD/, ""), values: util, kind: "district" },
                { label: "Peer median", short: "Peers", values: utilPeer, kind: "peer" },
                { label: "ESC region median", short: "Region", values: utilReg, kind: "region" },
                { label: "Statewide median", short: "State", values: utilState, kind: "state" }]} />
            </Figure>
            <Figure district={name} toast={toast} title="Plant operations spending per student vs similar districts" def="Plant maintenance & operations (Function 51) excluding insurance and capital, per student, nominal $"
              freshness={f.peims} source="TEA PEIMS actuals, Function 51" peers={peerDef} caveat="Per-student figures; district square footage isn't publicly available."
              csv={csvLine([{ label: name, values: ctrlps }, { label: "Peer median", values: ctrlPeer }, { label: "ESC region median", values: ctrlReg }, { label: "Statewide median", values: ctrlState }])}>
              <LineCompare years={Y} fromYear={2016} series={[
                { label: name, short: name.replace(/ ISD| CISD/, ""), values: ctrlps, kind: "district" },
                { label: "Peer median", short: "Peers", values: ctrlPeer, kind: "peer" },
                { label: "ESC region median", short: "Region", values: ctrlReg, kind: "region" },
                { label: "Statewide median", short: "State", values: ctrlState, kind: "state" }]} />
            </Figure>
            <Figure district={name} toast={toast} title="Year-over-year change in utility spending per student" def="Change from the prior year, %. Darker bars mark changes of 8% or more."
              freshness={f.peims} source="TEA PEIMS actuals, Function 51 object 6259" peers="District only" caveat="FY2020 includes spring 2020 COVID closures."
              csv={csvLine([{ label: "Utilities per student", values: util }])}>
              <YoYBars years={Y} values={util} />
            </Figure>
          </div>
        </>
      )}

      {tab === "cap" && <CapitalTab model={model} d={d} name={name} toast={toast} capPeerDef={capPeerDef} />}
      {tab === "budget" && <BudgetTab model={model} d={d} name={name} toast={toast} ops={ops} peerDef={peerDef} />}
      {tab === "peers" && <PeersTab model={model} d={d} reg={reg} st={st} go={go} />}
      {tab === "sizing" && <SizingTab model={model} d={d} />}
      {tab === "research" && <ResearchTab d={d} research={research} update={update} toast={toast} />}
      {tab === "notes" && <NotesTab d={d} research={research} update={update} />}
      {tab === "sources" && <SourcesTab model={model} d={d} />}
    </div>
  );
}

function CapitalTab({ model, d, name, toast, capPeerDef }) {
  const f = model.meta.freshness, Y = model.years, last = Y.length - 1, e = d.s.enroll;
  if (d.charter) return <div className="caveat" style={{ fontStyle: "normal", border: "1px dashed #C9C7C2", background: "#fff" }}>Debt, bond and tax-rate data are not available for charter schools; charters don't levy property taxes or hold bond elections.</div>;
  const bonds = d.bonds.filter((b) => b.result !== "Cancelled");
  const since = (yrs) => bonds.filter((b) => new Date(b.date) >= new Date(2026 - yrs, 8, 28));
  const lastPass = bonds.filter((b) => b.result === "Carried").at(-1);
  const pvYears = d.pv.taxYear, pvps = pvYears.map((ty, k) => { const fyi = Y.indexOf(ty + 1); const en = fyi >= 0 ? e[fyi] : e[last]; return d.pv.value[k] && en ? d.pv.value[k] / en : null; });
  const peerPv = pvYears.map((ty, k) => {
    const vals = d.peers.cap.map((id) => model.byId.get(id)).filter(Boolean).map((x) => { const fyi = Y.indexOf(ty + 1); const en = fyi >= 0 ? x.s.enroll[fyi] : x.s.enroll.at(-1); return x.pv.value[k] && en ? x.pv.value[k] / en : null; }).filter((v) => v != null).sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : null;
  });
  const lastIs = d.tax?.is.at(-1), lastMo = d.tax?.mo.at(-1);
  const cap5 = d.s.capitalAll.slice(-5).reduce((a, v) => a + (v || 0), 0) / e[last];
  const debt = d.debt;
  const yes = (b) => (b.for + b.against ? b.for / (b.for + b.against) : null);
  return (
    <>
      <div className="dims">
        <div><div className="eyebrow">Possible need</div><table><tbody>
          <tr><td>Enrollment, 5 yr</td><td className="r">{pct(e[last] / e[last - 5] - 1, { digits: 1 })}</td></tr>
          <tr><td>Capital spending, last 5 yrs</td><td className="r">{money(cap5)}/student</td></tr>
          <tr><td>Contracted repair, FY19–25</td><td className="r">{d.s.repair[Y.indexOf(2019)] ? pct(d.s.repair[last] / d.s.repair[Y.indexOf(2019)] - 1) : "—"}</td></tr></tbody></table></div>
        <div><div className="eyebrow">Fiscal capacity</div><table><tbody>
          <tr><td>Property value per student</td><td className="r">{money(pvps.at(-1))}</td></tr>
          <tr><td>I&S rate vs $0.50 cap</td><td className="r">{lastIs != null ? `$${lastIs.toFixed(2)}` : "—"}</td></tr>
          <tr><td>Debt per student</td><td className="r">{debt ? money(debt.principal / e[last]) : "$0"}</td></tr>
          <tr><td>Debt ÷ property value</td><td className="r">{debt && d.pv.value.at(-1) ? pct(debt.principal / d.pv.value.at(-1), { signed: false, digits: 1 }) : "—"}</td></tr></tbody></table></div>
        <div><div className="eyebrow">Timing</div><table><tbody>
          <tr><td>Principal retiring, 1 yr (est.)</td><td className="r">{money(debt?.retire1)}</td></tr>
          <tr><td>Principal retiring, 3 yrs (est.)</td><td className="r">{money(debt?.retire3)}</td></tr>
          <tr><td>Principal retiring, 5 yrs (est.)</td><td className="r">{money(debt?.retire5)}</td></tr>
          <tr><td>Years since passed bond</td><td className="r">{lastPass ? Math.floor((new Date(2026, 8, 28) - new Date(lastPass.date)) / 3.156e10) : "—"}</td></tr></tbody></table></div>
        <div><div className="eyebrow">Community support</div><table><tbody>
          <tr><td>Propositions on record</td><td className="r">{bonds.length}</td></tr>
          <tr><td>Passed / failed</td><td className="r">{bonds.filter((b) => b.result === "Carried").length} / {bonds.filter((b) => b.result === "Defeated").length}</td></tr>
          <tr><td>Last margin</td><td className="r">{bonds.at(-1) && yes(bonds.at(-1)) != null ? `${yes(bonds.at(-1)) >= 0.5 ? "+" : ""}${Math.round((yes(bonds.at(-1)) * 2 - 1) * 100)} pts` : "—"}</td></tr></tbody></table></div>
      </div>
      <h3 style={{ fontSize: 15, margin: "8px 0" }}>Bond record by period</h3>
      <table className="data" style={{ marginBottom: 6 }}><thead><tr><th>Period</th><th className="r">Passed</th><th className="r">Failed</th><th className="r">Pass rate</th><th className="r">Amount passed</th></tr></thead>
        <tbody>{[5, 10, 20].map((n) => { const s = since(n), p = s.filter((b) => b.result === "Carried"); return (
          <tr key={n}><td><b>Last {n} years</b></td><td className="r">{p.length}</td><td className="r">{s.length - p.length}</td><td className="r">{s.length ? pct(p.length / s.length, { signed: false }) : "No elections"}</td><td className="r"><b>{money(p.reduce((a, b) => a + b.amount, 0))}</b></td></tr>); })}</tbody></table>
      <p className="small muted" style={{ marginTop: 0 }}>Cancelled elections are excluded. <span className="fresh">{f.bonds}</span></p>
      <div className="figs">
        <Figure full district={name} toast={toast} title={lastPass ? `Last passed bond: ${money(lastPass.amount)} in ${new Date(lastPass.date + "T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "No passed bond on record"}
          def="Bond propositions by election date; circle area shows amount. Hover for vote margin." freshness={f.bonds} source="Texas Bond Review Board bond election results" peers="District only"
          csv={[["Date", "Amount", "Purpose", "For", "Against", "Result"], ...d.bonds.map((b) => [b.date, b.amount, b.purpose, b.for, b.against, b.result])]}>
          <BondTimeline bonds={d.bonds} />
        </Figure>
        {debt && <Figure district={name} toast={toast} title={`${money(debt.retire5)} of principal retires by FY${debt.fy + 5} (est.)`} def="Outstanding principal at the start of each fiscal year, existing issues only"
          freshness={f.debt} source={`Texas Bond Review Board debt outstanding, FY${debt.fy}`} peers="District only"
          caveat="Straight-line estimate from each issue's final maturity; excludes future issuance and refunding."
          csv={[["Fiscal year", "Estimated principal retired"], ...debt.profile.map(([y, v]) => [`FY${y}`, v])]}>
          <DebtBars profile={debt.profile} principal={debt.principal} startFy={debt.fy} highlightThrough={debt.fy + 5} />
        </Figure>}
        <Figure district={name} toast={toast} title="Property value per student vs similar districts" def="Taxable value (T2, after homestead exemption) per student, nominal $"
          freshness={f.pv} source="Comptroller Property Tax Assistance Division via TEA" peers={capPeerDef}
          caveat="The 2023 homestead exemption increase lowered taxable values statewide."
          csv={[["Tax year", name, "Peer median"], ...pvYears.map((ty, k) => [ty, pvps[k], peerPv[k]])]}>
          <LineCompare years={pvYears} xFmt={(y) => `TY${String(y).slice(2)}`} series={[{ label: name, short: name.replace(/ ISD| CISD/, ""), values: pvps, kind: "district" }, { label: "Peer median", short: "Peers", values: peerPv, kind: "peer" }]} />
        </Figure>
        {d.tax && <Figure district={name} toast={toast} title="Maintenance & operations (M&O) tax rate" def="$ per $100 of taxable value, by school year" freshness={f.tax}
          source="TEA adopted tax rates" peers="District only" caveat="State-mandated compression drove most M&O declines since 2019."
          csv={[["School year ending", "M&O", "I&S"], ...d.tax.fy.map((y, k) => [y, d.tax.mo[k], d.tax.is[k]])]}>
          <SmallLine xs={d.tax.fy} values={d.tax.mo} yFmt={(v) => `$${v.toFixed(2)}`} />
        </Figure>}
        {d.tax && <Figure district={name} toast={toast} title={lastIs != null ? `I&S (debt) tax rate: $${lastIs.toFixed(2)}, $${Math.max(0, 0.5 - lastIs).toFixed(2)} below the $0.50 test` : "I&S (debt) tax rate"}
          def="Interest & sinking tax rate, $ per $100 of taxable value" freshness={f.tax} source="TEA adopted tax rates" peers="District only"
          caveat="The $0.50 test applies to new debt at issuance.">
          <SmallLine xs={d.tax.fy} values={d.tax.is} yFmt={(v) => `$${v.toFixed(2)}`} refLine={0.5} refLabel="$0.50 test" />
        </Figure>}
      </div>
    </>
  );
}

function BudgetTab({ model, d, name, toast, ops, peerDef }) {
  const f = model.meta.freshness, Y = model.years, last = Y.length - 1, e = d.s.enroll, i16 = Y.indexOf(2016);
  const items = [["transport", "Transportation"], ["security", "Security & monitoring"], ["capitalAll", "Capital outlay"], ["f51", "Plant M&O"], ["total", "Total expense"]];
  const enrPeer = medianSeries(model, ops, (x) => x.s.enroll.map((v, i) => (v && x.s.enroll[i16] ? v / x.s.enroll[i16] : null)));
  const enrIdx = e.map((v) => (v && e[i16] ? v / e[i16] : null));
  return (
    <>
      <div className="mtiles">{items.map(([k, lbl]) => {
        const ps = perStudent(d, k); const pm = medianSeries(model, ops, (x) => perStudent(x, k));
        return <Tile key={k} label={`${lbl} per student`} value={money(ps[last])} delta={pm[last] ? pct(ps[last] / pm[last] - 1) + " vs peers" : ""}
          sub={`${pct(ps[last] / ps[i16] - 1)} since FY2016 · ${money(d.s[k][last])} total`} fresh={f.peims} />;
      })}</div>
      <div className="figs">
        <Figure district={name} toast={toast} title="Enrollment trend vs similar districts" def="Enrollment indexed to FY2016 = 1.00" freshness={f.peims} source="TEA PEIMS fall enrollment" peers={peerDef}
          csv={[["Fiscal year", name, "Peer median"], ...Y.map((y, i) => [fy(y), e[i], enrPeer[i]])]}>
          <LineCompare years={Y} fromYear={2016} yFmt={(v) => v.toFixed(2)} series={[{ label: name, short: name.replace(/ ISD| CISD/, ""), values: enrIdx, kind: "district" }, { label: "Peer median", short: "Peers", values: enrPeer, kind: "peer" }]} />
        </Figure>
        <div className="fig"><h3 className="fig-title">Campus portfolio</h3><p className="fig-def">{d.campuses} campuses, TEA directory 2024-25</p>
          {Object.entries(d.campusTypes).map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "160px 1fr 40px", gap: 8, alignItems: "center", margin: "6px 0" }}>
              <span className="small">{campusLabel(k)}</span>
              <span style={{ height: 12, background: "#0082FF", width: `${(v / d.campuses) * 100}%` }} /><span className="small num">{v}</span></div>))}
          <div className="fig-foot">Accountability rating (context only): <b>{d.rating ? `${d.rating} (2026)` : "not rated"}</b></div>
        </div>
      </div>
    </>
  );
}

function PeersTab({ model, d, reg, st, go }) {
  const [set, setSet] = useState("ops");
  const ids = d.peers[set];
  const Y = model.years, last = Y.length - 1;
  const metrics = [
    ["Utilities per student", (x) => perStudent(x, "util")[last], money],
    ["Plant operations per student (ex. insurance, capital)", (x) => seriesFn("ctrl")(x)[last], money],
    ["Enrollment, 5-yr change", (x) => x.s.enroll[last] / x.s.enroll[last - 5] - 1, (v) => pct(v, { digits: 1 })],
    ["Campuses per 1,000 students", (x) => x.campuses / (x.s.enroll[last] / 1000), (v) => (v == null ? "—" : v.toFixed(2))],
    ["Debt per student", (x) => (x.debt ? x.debt.principal / x.s.enroll[last] : x.charter ? null : 0), money],
  ];
  const medOf = (list, fn) => { const v = list.map((id) => model.byId.get(id)).filter(Boolean).map(fn).filter((x) => x != null && isFinite(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(360px,1.3fr)", gap: 24 }}>
      <div>
        <span className="seg"><button className={set === "ops" ? "on" : ""} onClick={() => setSet("ops")}>Operations peers</button><button className={set === "cap" ? "on" : ""} onClick={() => setSet("cap")}>Capital peers</button></span>
        <p className="small muted">{set === "ops" ? "Matched on enrollment, locale (urban/suburban/town/rural), location and campuses per 1,000 students." : "Matched on enrollment and growth, property value per student, locale, debt per student and I&S rate."} {ids.length} nearest districts. Editing peers arrives in the next release.</p>
        <table className="data"><tbody>{ids.map((id) => { const x = model.byId.get(id); return x && (
          <tr key={id} className="click" onClick={() => go({ d: id, tab: null })}><td><div className="dname">{title(x.name)}</div><div className="dmeta">{x.county} County · Region {x.region} · {num(x.s.enroll[last])} students · {x.locale}</div></td></tr>); })}</tbody></table>
      </div>
      <div>
        <table className="data"><thead><tr><th>Metric, FY2025</th><th className="r">{title(d.name)}</th><th className="r">Peer median</th><th className="r">ESC region</th><th className="r">Statewide</th></tr></thead>
          <tbody>{metrics.map(([lbl, fn, fmt]) => <tr key={lbl}><td>{lbl}</td><td className="r"><b>{fmt(fn(d))}</b></td><td className="r">{fmt(medOf(ids, fn))}</td><td className="r">{fmt(medOf(reg, fn))}</td><td className="r">{fmt(medOf(st, fn))}</td></tr>)}</tbody></table>
        <p className="small muted">Medians only. Region and statewide exclude districts under 500 students{d.charter ? "" : " and charters"}.</p>
      </div>
    </div>
  );
}

function ResearchTab({ d, research, update, toast }) {
  const r = research.research?.[d.id] || {};
  const set = (item, patch) => update((s) => ({ ...s, research: { ...s.research, [d.id]: { ...(s.research?.[d.id] || {}), [item]: { ...(s.research?.[d.id]?.[item] || {}), ...patch } } } }));
  const [text, setText] = useState(""); const [src, setSrc] = useState("");
  const done = DOCS.filter((x) => r[x]?.status && r[x].status !== "unchecked").length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(420px,2fr) minmax(260px,1fr)", gap: 24 }}>
      <div>
        <p className="small muted">{done} of {DOCS.length} documents checked. Public financial data finds the thread; district documents often reveal the actual issue.{d.website && <> District site: <a href={`https://${d.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">{d.website}</a></>}</p>
        <table className="data"><thead><tr><th>Document</th><th>Status</th><th>Link</th><th>Note</th></tr></thead><tbody>
          {DOCS.map((x) => (
            <tr key={x}><td><b>{x}</b></td>
              <td><select value={r[x]?.status || "unchecked"} onChange={(e) => set(x, { status: e.target.value })} style={{ height: 30 }}><option value="unchecked">Not checked</option><option value="found">Found</option><option value="na">Not available</option></select></td>
              <td><input defaultValue={r[x]?.url || ""} onBlur={(e) => set(x, { url: e.target.value })} placeholder="https://" style={{ width: "100%", height: 30, border: "1px solid #C9C7C2" }} /></td>
              <td><input defaultValue={r[x]?.note || ""} onBlur={(e) => set(x, { note: e.target.value })} style={{ width: "100%", height: 30, border: "1px solid #C9C7C2" }} /></td></tr>))}
        </tbody></table>
      </div>
      <div className="fig">
        <h3 className="fig-title">Add a document-sourced finding</h3>
        <p className="fig-def">E.g. "FY2026 budget names HVAC replacement and controls standardization as priorities."</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", minHeight: 80 }} placeholder="Finding" />
        <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Source (e.g. Adopted Budget p. 42)" style={{ width: "100%", height: 32, margin: "8px 0", border: "1px solid #C9C7C2" }} />
        <button className="btn dark" disabled={!text.trim()} onClick={() => {
          update((s) => ({ ...s, docFindings: { ...s.docFindings, [d.id]: [...(s.docFindings?.[d.id] || []), { text: text.trim(), source: src.trim(), date: new Date().toISOString().slice(0, 10) }] } }));
          setText(""); setSrc(""); toast("Finding added under “From district documents”");
        }}>Add finding</button>
      </div>
    </div>
  );
}

function NotesTab({ d, research, update }) {
  const notes = research.notes?.[d.id] || [];
  const [t, setT] = useState("");
  return (
    <div style={{ maxWidth: 720 }}>
      <p className="small muted">Saved on this device only. Shared team notes arrive with company sign-in (v2). Use the header's “Saved on this device” menu to export your research file.</p>
      <textarea value={t} onChange={(e) => setT(e.target.value)} placeholder="e.g. District opened two campuses in FY2023; likely explains the utility increase." style={{ width: "100%", minHeight: 80, font: "inherit", padding: 8, border: "1px solid #C9C7C2" }} />
      <button className="btn dark" disabled={!t.trim()} style={{ marginTop: 8 }} onClick={() => { update((s) => ({ ...s, notes: { ...s.notes, [d.id]: [{ text: t.trim(), date: new Date().toISOString() }, ...(s.notes?.[d.id] || [])] } })); setT(""); }}>Add note</button>
      {notes.map((n, i) => <div key={i} className="hcard" style={{ padding: "12px 0" }}><div className="small muted">{new Date(n.date).toLocaleString()}</div>{n.text}</div>)}
    </div>
  );
}

function SourcesTab({ model, d }) {
  const f = model.meta.freshness;
  const gaps = [];
  if (d.charter) gaps.push("Charter: no bond, debt, tax-rate or boundary data.");
  if (!d.debt && !d.charter) gaps.push("No outstanding debt reported to the Bond Review Board.");
  if (d.s.util.slice(-5).some((v) => v == null)) gaps.push("Missing utility data in at least one of the last five years.");
  if (d.tooSmall) gaps.push("Under 500 students: no signals generated.");
  const rows = [
    ["TEA PEIMS actuals (detail)", "Function 51 by object; function totals; FY2009–FY2025", f.peims, "TEA district number"],
    ["TEA PEIMS budgets (detail)", "Adopted budgets by function; 2-digit object groups", f.budget, "TEA district number"],
    ["TEA enrollment", "PEIMS fall survey enrollment", f.peims, "TEA district number"],
    ["Texas Bond Review Board", "Bond elections; debt outstanding by issue", `${f.bonds}; ${f.debt}`, "Name + county (elections); govid (debt)"],
    ["TEA adopted tax rates", "M&O and I&S rates by school year", f.tax, "TEA district number"],
    ["Comptroller PTAD", "Taxable property values (T2, T8)", f.pv, "TEA district number"],
    ["TEA School District Locator", "Campuses, grade spans, superintendent; district boundaries", f.campuses, "TEA district number"],
    ["NCES Common Core of Data", "Urban-centric locale", "2024", "state_leaid"],
    ["TEA accountability", "2026 A–F overall rating (context only)", f.rating, "TEA district number"],
  ];
  return (
    <>
      <table className="data"><thead><tr><th>Source</th><th>Contents</th><th>Freshness</th><th>Join</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "dname" : "small"}>{c}</td>)}</tr>)}</tbody></table>
      <h3 style={{ fontSize: 15, marginTop: 24 }}>Known gaps for this district</h3>
      {gaps.length ? <ul>{gaps.map((g) => <li key={g} style={{ color: "#B8740B" }}>{g}</li>)}</ul> : <p className="small muted">None detected.</p>}
      <div className="caveat" style={{ marginTop: 16 }}><b>Later:</b> once a district shares utility bills and a campus inventory (square footage, build year, systems), this page will switch to preliminary analysis: cost and energy per square foot, weather-normalized use, baseload and anomalies.</div>
    </>
  );
}

const pctf = (x) => `${Math.round(x * 1000) / 10}%`;
function rng(a) { return a[0] === a[2] ? money(a[1]) : `${money(a[0])} – ${money(a[2])}`; }

function SizingTab({ model, d }) {
  const z = d.sizing, A = model.meta.sizing, f = model.meta.freshness;
  const e = d.s.enroll.at(-1);
  if (!z) return <p className="muted">No sizing for this district (missing FY2025 plant operations data).</p>;
  const es = A.esco, uo = A.uptime_ops, em = A.emaas;
  const bandTxt = es.savings_bands_by_f51_ratio.map(([t, r], i, arr) => `${t == null ? `above ${arr[i - 1][0]}×` : `up to ${t}×`}: ${Math.round(r * 100)}%`).join("; ");
  const multTxt = es.project_multiple_by_enrollment.map(([t, m], i, arr) => `${t == null ? `${num(arr[i - 1][0])}+` : `under ${num(t)}`}: ${m}×`).join("; ");
  return (
    <div>
      <h2 className="section">Opportunity sizing <span className="internal-tag">Internal</span></h2>
      <p className="small muted" style={{ maxWidth: 760 }}>Order-of-magnitude estimates from Upchurch's current sizing assumptions, applied to public PEIMS data. Use them to rank and prepare, not to quote.
        They aren't included on the brief. Real sizing needs utility bills, square footage and a site walk.</p>
      <div className="statgrid" style={{ marginTop: 12 }}>
        <div><div className="lbl">Plant O&M vs peers</div><div className="val">{z.ratio != null ? `${z.ratio.toFixed(2)}×` : "—"}</div><div className="sub">FY2025 Function 51 per student vs ops-peer median ({money(z.peerF51)})</div></div>
        <div><div className="lbl">Inefficiency index</div><div className="val">{z.inefficiency != null ? Math.round(z.inefficiency * 100) : "—"}<small> /100</small></div><div className="sub">0 at ≤{A.inefficiency.median_offset}× peers, 100 at ≥{(A.inefficiency.median_offset + A.inefficiency.span).toFixed(2)}×{z.highCapital ? `; ×${A.inefficiency.high_capital_factor} for high recent capital spending` : ""}</div></div>
        <div><div className="lbl">Energy basis</div><div className="val">{money(z.energy)}</div><div className="sub">FY2025 utilities{A.energy_share.default !== 1 ? ` × ${A.energy_share.default}` : ""} (object 6259, includes water & telephone)</div></div>
        <div><div className="lbl">General-fund operating margin</div><div className="val">{z.gfNetPerStudent != null ? `${money(z.gfNetPerStudent)}` : "—"}<small>/student</small></div><div className="sub">FY2025 operating revenue minus operating expenditures</div></div>
      </div>
      <div className="sizing-grid">
        <div className="sizing-card">
          <h4>ESCO project (performance contract)</h4>
          <div className="big">{money(z.esco.project[1])}</div>
          <div className="range">Range {rng(z.esco.project)} · model score {Math.round(z.esco.score)}</div>
          <dl>
            <dt>Energy savings</dt><dd>{pctf(z.esco.savingsPct[1])} · {money(z.esco.savings[1])}/yr</dd>
            <dt>Savings range</dt><dd>{rng(z.esco.savings)}/yr</dd>
            <dt>Project multiple</dt><dd>{z.esco.multiple}× annual savings</dd>
            <dt>Score: budget stress</dt><dd>{Math.round(z.esco.components.budgetStress * 100)}</dd>
            <dt>Score: savings/student</dt><dd>{Math.round(z.esco.components.savingsIndex * 100)}</dd>
            <dt>Score: inefficiency</dt><dd>{Math.round(z.esco.components.inefficiency * 100)}</dd>
          </dl>
          <details><summary>How estimated</summary>
            <p>Savings rate by plant O&M ratio to peers ({bandTxt}). Low/high cases use the adjacent bands; {Math.round(es.high_capital_reduction * 100)} points lower if recent capital spending is in the top quartile; floor {Math.round(es.savings_floor * 100)}%.
              Project value = annual savings × a multiple by enrollment ({multTxt}).</p>
            <p>Score = {es.priority_weights.budget_stress * 100}% budget stress (general-fund margin vs a ${es.budget_stress.target_surplus_per_student}/student target) + {es.priority_weights.savings_per_student * 100}% savings per student + {es.priority_weights.inefficiency * 100}% inefficiency.</p></details>
        </div>
        <div className="sizing-card">
          <h4>Uptime Ops (facilities O&M)</h4>
          <div className="big">{money(z.ops.fee)}<small style={{ fontSize: 13, fontWeight: 400 }}> /yr fee</small></div>
          <div className="range">Net to district {money(z.ops.net)}/yr · model score {d.lens.om.score != null ? Math.round(d.lens.om.score) : "—"}</div>
          <dl>
            <dt>Addressable base</dt><dd>{money(z.ops.base)}</dd>
            <dt>Savings rate</dt><dd>{pctf(z.ops.savingsRate)}</dd>
            <dt>Savings range</dt><dd>{rng(z.ops.savings)}/yr</dd>
            <dt>Fee rate</dt><dd>{pctf(z.ops.feeRate)}</dd>
          </dl>
          <details><summary>How estimated</summary>
            <p>Base = {uo.base === "addressable" ? "plant staff + contracted repair + other contracted services + supplies (excludes utilities, insurance and capital, so it doesn't overlap the ESCO estimate)" : "all of Function 51"}.
              Savings rate = {pctf(uo.savings_rate.base)} + {pctf(uo.savings_rate.per_inefficiency)} × inefficiency (range ±3 points). Fee = {pctf(uo.fee_rate.base)} + {pctf(uo.fee_rate.per_inefficiency)} × inefficiency.</p></details>
        </div>
        <div className={"sizing-card" + (z.emaas.eligible ? "" : " off")}>
          <h4>Energy Manager as a Service</h4>
          {z.emaas.eligible ? <>
            <div className="big">{money(z.emaas.net[1])}<small style={{ fontSize: 13, fontWeight: 400 }}> /yr net</small></div>
            <div className="range">Range {rng(z.emaas.net)} · model score {d.lens.em.score != null ? Math.round(d.lens.em.score) : "—"}</div>
            <dl>
              <dt>Savings</dt><dd>{pctf(z.emaas.savingsPct)} · {money(z.emaas.savings)}/yr</dd>
              <dt>Annual fee</dt><dd>{money(z.emaas.fee)}</dd>
            </dl>
          </> : <p className="small" style={{ marginTop: 8 }}>Outside the {num(em.enrollment_min)}–{num(em.enrollment_max)} student band ({num(e)} students). {e > em.enrollment_max ? "Large enough that a full-time energy manager may be justified." : "Utility spend is usually too small for the fee to pay back."}</p>}
          <details><summary>How estimated</summary>
            <p>Eligible at {num(em.enrollment_min)}–{num(em.enrollment_max)} students, where a full-time energy manager is hard to justify. Savings = ESCO base savings rate − {Math.round(em.savings_offset_from_esco * 100)} points, held between {Math.round(em.savings_min * 100)}% and {Math.round(em.savings_max * 100)}% of utilities (range ±2.5 points). Net = savings − {money(em.annual_fee)} fee.</p></details>
        </div>
      </div>

      <h2 className="section" style={{ marginTop: 28 }}>Procurement</h2>
      {d.tips ? (<>
        <p><b>TIPS member</b>{d.tips.since ? ` since ${new Date(d.tips.since + "T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : ""}. The district can buy through The Interlocal Purchasing System cooperative contracts, which can shorten procurement. <span className="fresh">{f.tips}</span></p>
        {d.tips.contacts?.length > 0 && <>
          <div className="small muted" style={{ margin: "8px 0 4px" }}>TIPS contacts on file (may not be facilities or finance staff; confirm roles before reaching out) <span className="internal-tag">Internal</span></div>
          <table className="contacts"><tbody>{d.tips.contacts.map((c, k) => <tr key={k}><td><b>{c.name}</b></td><td>{c.title || "—"}</td><td>{c.phone || ""}</td><td className="muted">{c.type}</td></tr>)}</tbody></table>
        </>}
      </>) : <p>Not on the TIPS member list. Check other cooperatives (BuyBoard, Choice Partners) or plan for the district's own RFQ/RFP. <span className="fresh">{f.tips}</span></p>}
    </div>
  );
}
