// Hand-built SVG charts matching the Upchurch handoff. All charts are plain SVG so they export cleanly.
import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleBand, scaleSqrt } from "d3-scale";
import { line, area, stack, stackOffsetExpand } from "d3-shape";
import { max, min, extent } from "d3-array";
import { money, fy } from "../lib/format.js";

export const SERIES_STYLE = {
  district: { stroke: "#0082FF", width: 2.5, dash: null },
  peer: { stroke: "#4A4845", width: 1.5, dash: "6 4" },
  region: { stroke: "#6E6C68", width: 1.5, dash: "1.5 3" },
  state: { stroke: "#9C9A95", width: 1.5, dash: null },
};

export function useWidth(initial = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const AXIS = { fontSize: 10.5, fill: "#6E6C68", fontFamily: "Inter, system-ui, sans-serif" };

function niceTicks(lo, hi, n = 4) {
  return scaleLinear().domain([lo, hi]).nice(n).ticks(n);
}

// ---------------------------------------------------------------------------
export function LineCompare({ years, series, yFmt = (v) => money(v), xFmt = fy, height = 240, zero = false, fromYear }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const i0 = fromYear ? years.indexOf(fromYear) : 0;
  const ys = years.slice(i0);
  const ss = series.map((s) => ({ ...s, values: s.values.slice(i0) }));
  const all = ss.flatMap((s) => s.values).filter((v) => v != null && isFinite(v));
  const m = { t: 10, r: 110, b: 24, l: 52 };
  const x = scaleLinear().domain([ys[0], ys.at(-1)]).range([m.l, w - m.r]);
  const lo = zero ? 0 : min(all) * 0.92, hi = max(all) * 1.05;
  const y = scaleLinear().domain([lo, hi]).nice(4).range([height - m.b, m.t]);
  const ln = line().defined((d) => d[1] != null && isFinite(d[1])).x((d) => x(d[0])).y((d) => y(d[1]));
  const labels = ss.map((s) => {
    const lastIdx = s.values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).at(-1);
    return lastIdx == null ? null : { s, yv: y(s.values[lastIdx]), xv: x(ys[lastIdx]), v: s.values[lastIdx] };
  }).filter(Boolean).sort((a, b) => a.yv - b.yv);
  for (let k = 1; k < labels.length; k++) if (labels[k].yv - labels[k - 1].yv < 13) labels[k].yv = labels[k - 1].yv + 13;
  const hi_ = hover != null ? ys[hover] : null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={height} role="img" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const xv = x.invert(e.clientX - r.left);
          const idx = Math.round(xv - ys[0]);
          setHover(idx >= 0 && idx < ys.length ? idx : null);
        }}>
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="#EFEEEC" />
            <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" {...AXIS}>{yFmt(t)}</text>
          </g>
        ))}
        {ys.map((yr, i) => { const step = Math.ceil(ys.length / (w < 420 ? 5 : 9)); return ((i % step === 0 && ys.length - 1 - i >= step) || i === ys.length - 1); }).map((show, i) => show && ys[i]).map((yr, i) => yr && (
          <text key={yr} x={x(yr)} y={height - 6} textAnchor="middle" {...AXIS}>{xFmt(yr)}</text>
        ))}
        {ss.slice().reverse().map((s) => {
          const st = SERIES_STYLE[s.kind] || SERIES_STYLE.state;
          return <path key={s.label} d={ln(ys.map((yr, i) => [yr, s.values[i]]))} fill="none" stroke={st.stroke}
            strokeWidth={st.width} strokeDasharray={st.dash} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {labels.map(({ s, yv, xv, v }) => (
          <g key={s.label}>
            {s.kind === "district" && <circle cx={xv} cy={y(v)} r={3.5} fill="#0082FF" />}
            <text x={w - m.r + 8} y={yv + 3.5} fontSize={11} fontWeight={s.kind === "district" ? 700 : 400}
              fill={s.kind === "district" ? "#004E99" : "#4A4845"} fontFamily="Inter, system-ui, sans-serif">
              {s.short || s.label} {yFmt(v)}
            </text>
          </g>
        ))}
        {hi_ != null && <line x1={x(hi_)} x2={x(hi_)} y1={m.t} y2={height - m.b} stroke="#C9C7C2" />}
      </svg>
      {hover != null && (
        <div className="menu-pop" style={{ position: "absolute", left: Math.min(x(ys[hover]) + 12, w - 220), top: 8, width: 200, pointerEvents: "none", padding: 10 }}>
          <b>{xFmt(ys[hover])}</b>
          {ss.map((s) => <div key={s.label} className="small">{s.label}: <b>{yFmt(s.values[hover])}</b></div>)}
        </div>
      )}
      <div className="legend">
        {ss.map((s) => {
          const st = SERIES_STYLE[s.kind] || SERIES_STYLE.state;
          return <span key={s.label}><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} /></svg>{s.label}</span>;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export const STACK_PARTS = [
  { key: "staff", label: "In-house staff", color: "#2D2C2A" },
  { key: "repair", label: "Contracted maintenance & repair", color: "#004E99" },
  { key: "services", label: "Other contracted services", color: "#8AC3FF" },
  { key: "util", label: "Utilities", color: "#0082FF" },
  { key: "supplies", label: "Supplies", color: "#C9C7C2" },
  { key: "capital51", label: "Capital charged to plant M&O", color: "#6E6C68" },
];
export function Stack100({ years, d, fromYear = 2016, height = 280 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const i0 = years.indexOf(fromYear);
  const ys = years.slice(i0);
  const rows = ys.map((yr, k) => {
    const r = { yr };
    STACK_PARTS.forEach((p) => (r[p.key] = Math.max(0, d.s[p.key][i0 + k] || 0)));
    return r;
  });
  const m = { t: 8, r: 8, b: 24, l: 40 };
  const x = scaleBand().domain(ys).range([m.l, w - m.r]).padding(0.28);
  const y = scaleLinear().domain([0, 1]).range([height - m.b, m.t]);
  const st = stack().keys(STACK_PARTS.map((p) => p.key)).offset(stackOffsetExpand)(rows);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={height} role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <text key={t} x={m.l - 6} y={y(t) + 3.5} textAnchor="end" {...AXIS}>{t * 100}%</text>)}
        {st.map((layer, li) => layer.map((seg, k) => (
          <rect key={li + "-" + k} x={x(ys[k])} width={x.bandwidth()} y={y(seg[1])} height={Math.max(0, y(seg[0]) - y(seg[1]) - 1)}
            fill={STACK_PARTS[li].color} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} />
        )))}
        {ys.map((yr) => <text key={yr} x={x(yr) + x.bandwidth() / 2} y={height - 6} textAnchor="middle" {...AXIS}>{fy(yr)}</text>)}
      </svg>
      {hover != null && (() => {
        const r = rows[hover]; const tot = STACK_PARTS.reduce((a, p) => a + r[p.key], 0);
        return (
          <div className="menu-pop" style={{ position: "absolute", left: Math.min(x(ys[hover]) + x.bandwidth() + 8, w - 240), top: 8, width: 230, pointerEvents: "none", padding: 10 }}>
            <b>{fy(ys[hover])}</b>
            {STACK_PARTS.slice().reverse().map((p) => <div key={p.key} className="small">{p.label}: <b>{Math.round((r[p.key] / tot) * 100)}%</b> ({money(r[p.key])})</div>)}
          </div>
        );
      })()}
      <div className="legend">{STACK_PARTS.map((p) => <span key={p.key}><i style={{ width: 10, height: 10, background: p.color, display: "inline-block" }} />{p.label}</span>)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function YoYBars({ years, values, fromYear = 2017, height = 180 }) {
  const [ref, w] = useWidth();
  const i0 = years.indexOf(fromYear);
  const pts = years.slice(i0).map((yr, k) => {
    const cur = values[i0 + k], prev = values[i0 + k - 1];
    return { yr, v: cur != null && prev ? cur / prev - 1 : null };
  });
  const m = { t: 16, r: 8, b: 24, l: 40 };
  const ext = max(pts, (p) => Math.abs(p.v || 0)) || 0.1;
  const x = scaleBand().domain(pts.map((p) => p.yr)).range([m.l, w - m.r]).padding(0.3);
  const y = scaleLinear().domain([-ext * 1.15, ext * 1.15]).range([height - m.b, m.t]);
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img">
        <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="#9C9A95" />
        {[-ext, ext].map((t) => <text key={t} x={m.l - 6} y={y(t) + 3.5} textAnchor="end" {...AXIS}>{t > 0 ? "+" : ""}{Math.round(t * 100)}%</text>)}
        {pts.map((p) => p.v != null && (
          <g key={p.yr}>
            <rect x={x(p.yr)} width={x.bandwidth()} y={Math.min(y(p.v), y(0))} height={Math.abs(y(p.v) - y(0))}
              fill={Math.abs(p.v) >= 0.08 ? "#0082FF" : "#B8DBFF"} />
            <text x={x(p.yr) + x.bandwidth() / 2} y={p.v >= 0 ? y(p.v) - 4 : y(p.v) + 11} textAnchor="middle" {...AXIS} fill="#2D2C2A">
              {p.v > 0 ? "+" : ""}{Math.round(p.v * 100)}%</text>
          </g>
        ))}
        {pts.map((p) => <text key={"x" + p.yr} x={x(p.yr) + x.bandwidth() / 2} y={height - 6} textAnchor="middle" {...AXIS}>{fy(p.yr)}</text>)}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BondTimeline({ bonds, fromYear = 2000, toYear = 2026, height = 250 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const bs = bonds.filter((b) => +b.date.slice(0, 4) >= fromYear && b.result !== "Cancelled");
  const m = { t: 34, r: 30, b: 30, l: 70 };
  const x = scaleLinear().domain([fromYear, toYear + 1]).range([m.l, w - m.r]);
  const mid = (height - m.b + m.t) / 2;
  const r = scaleSqrt().domain([0, max(bs, (b) => b.amount) || 1]).range([4, 30]);
  const dx = (b) => x(+b.date.slice(0, 4) + (+b.date.slice(5, 7) - 0.5) / 12);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={height} role="img">
        <text x={8} y={m.t} fontSize={12} fontWeight={700} fill="#0082FF">Passed ▲</text>
        <text x={8} y={height - m.b - 4} fontSize={12} fontWeight={700} fill="#000">Failed ▼</text>
        <line x1={m.l} x2={w - m.r} y1={mid} y2={mid} stroke="#9C9A95" />
        {Array.from({ length: Math.floor((toYear - fromYear) / 4) + 1 }, (_, k) => fromYear + k * 4).map((yr) => (
          <text key={yr} x={x(yr)} y={height - 8} textAnchor="middle" {...AXIS}>{yr}</text>))}
        {bs.map((b, k) => {
          const pass = b.result === "Carried"; const rr = r(b.amount || 0);
          const cy = pass ? mid - rr - 6 : mid + rr + 6;
          return (
            <g key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              <line x1={dx(b)} x2={dx(b)} y1={mid} y2={cy} stroke={pass ? "#0082FF" : "#000"} strokeWidth={1} />
              <circle cx={dx(b)} cy={cy} r={rr} fill={pass ? "#0082FF" : "#fff"} fillOpacity={pass ? 0.9 : 1} stroke={pass ? "#fff" : "#000"} strokeWidth={pass ? 1 : 1.5} />
              {rr >= 10 && <text x={dx(b)} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={pass ? "#fff" : "#000"}>{pass ? "✓" : "×"}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && (() => {
        const b = bs[hover]; const tv = (b.for || 0) + (b.against || 0);
        return (
          <div className="menu-pop" style={{ position: "absolute", left: Math.min(dx(b) + 12, w - 240), top: 8, width: 230, pointerEvents: "none", padding: 10 }}>
            <b>{b.date}</b> · {b.result === "Carried" ? "Passed" : "Failed"}<br />
            <span className="small">{money(b.amount)} · {b.purpose}</span><br />
            {tv > 0 && <span className="small">{Math.round((b.for / tv) * 100)}% yes ({b.for.toLocaleString()} – {b.against.toLocaleString()})</span>}
          </div>
        );
      })()}
      <div className="legend"><span><i style={{ width: 10, height: 10, borderRadius: 5, background: "#0082FF", display: "inline-block" }} />Passed (filled, above line)</span>
        <span><i style={{ width: 10, height: 10, borderRadius: 5, border: "1.5px solid #000", display: "inline-block" }} />Failed (open, below line)</span><span>Circle area = amount</span></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function DebtBars({ profile, principal, startFy, highlightThrough, height = 220 }) {
  const [ref, w] = useWidth();
  // outstanding principal at the start of each fiscal year, from the annual retirement estimate
  let remaining = principal;
  const pts = [];
  for (const [yr, amt] of profile) { pts.push({ yr, v: remaining }); remaining -= amt; }
  const m = { t: 10, r: 8, b: 24, l: 52 };
  const x = scaleBand().domain(pts.map((p) => p.yr)).range([m.l, w - m.r]).padding(0.2);
  const y = scaleLinear().domain([0, principal]).nice(4).range([height - m.b, m.t]);
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img">
        {y.ticks(4).map((t) => <g key={t}><line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="#EFEEEC" /><text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" {...AXIS}>{money(t)}</text></g>)}
        {pts.map((p) => <rect key={p.yr} x={x(p.yr)} width={x.bandwidth()} y={y(p.v)} height={y(0) - y(p.v)} fill={p.yr <= highlightThrough ? "#0082FF" : "#C9C7C2"} />)}
        {pts.map((p, k) => (k % Math.ceil(pts.length / 10) === 0) && <text key={"x" + p.yr} x={x(p.yr) + x.bandwidth() / 2} y={height - 6} textAnchor="middle" {...AXIS}>{fy(p.yr)}</text>)}
      </svg>
      <div className="legend"><span><i style={{ width: 10, height: 10, background: "#0082FF", display: "inline-block" }} />Through FY{highlightThrough}</span><span><i style={{ width: 10, height: 10, background: "#C9C7C2", display: "inline-block" }} />Later years</span></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SmallLine({ xs, values, yFmt, height = 170, refLine, refLabel, xFmt = (v) => v }) {
  const [ref, w] = useWidth();
  const pts = xs.map((xv, i) => [xv, values[i]]).filter((p) => p[1] != null);
  if (!pts.length) return <div className="empty">No data.</div>;
  const m = { t: 12, r: refLine != null ? 60 : 16, b: 24, l: 48 };
  const x = scaleLinear().domain(extent(pts, (p) => p[0])).range([m.l, w - m.r]);
  const hiV = Math.max(max(pts, (p) => p[1]), refLine ?? 0) * 1.1;
  const y = scaleLinear().domain([0, hiV]).nice(4).range([height - m.b, m.t]);
  const ln = line().x((p) => x(p[0])).y((p) => y(p[1]));
  const step = Math.ceil(pts.length / 6);
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img">
        {y.ticks(4).map((t) => <g key={t}><line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="#EFEEEC" /><text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" {...AXIS}>{yFmt(t)}</text></g>)}
        {refLine != null && <g><line x1={m.l} x2={w - m.r} y1={y(refLine)} y2={y(refLine)} stroke="#4A4845" strokeDasharray="2 3" /><text x={w - m.r + 4} y={y(refLine) + 3.5} {...AXIS}>{refLabel}</text></g>}
        <path d={ln(pts)} fill="none" stroke="#0082FF" strokeWidth={2.5} />
        <circle cx={x(pts.at(-1)[0])} cy={y(pts.at(-1)[1])} r={3.5} fill="#0082FF" />
        {pts.map((p, k) => (k % step === 0 || k === pts.length - 1) && <text key={p[0]} x={x(p[0])} y={height - 6} textAnchor="middle" {...AXIS}>{xFmt(p[0])}</text>)}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Sparkline({ values, width = 90, height = 22 }) {
  const pts = values.map((v, i) => [i, v]).filter((p) => p[1] != null && isFinite(p[1]));
  if (pts.length < 2) return null;
  const x = scaleLinear().domain([pts[0][0], pts.at(-1)[0]]).range([2, width - 4]);
  const y = scaleLinear().domain(extent(pts, (p) => p[1])).range([height - 3, 3]);
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={line().x((p) => x(p[0])).y((p) => y(p[1]))(pts)} fill="none" stroke="#0082FF" strokeWidth={1.5} />
      <circle cx={x(pts.at(-1)[0])} cy={y(pts.at(-1)[1])} r={2} fill="#0082FF" />
    </svg>
  );
}

export function StrengthIcon({ level }) {
  const n = { Strong: 3, Moderate: 2, Weak: 1, Limited: 1 }[level] || 0;
  return (
    <span className="strength">
      <span className="bars3">{[5, 8, 11].map((h, i) => <i key={i} style={{ height: h }} className={i < n ? "on" : ""} />)}</span>
      {level || "—"}
    </span>
  );
}
