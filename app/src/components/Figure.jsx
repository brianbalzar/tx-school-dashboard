// Figure card: finding title, definition, freshness, Table toggle and an Export menu.
// Exports compose a standalone graphic: district + title + definition + chart + source + Upchurch logo.
import { useRef, useState, useEffect } from "react";

let logoDataUrl = null;
async function getLogo() {
  if (logoDataUrl) return logoDataUrl;
  const blob = await (await fetch("brand/upchurch-horizontal-black.png")).blob();
  logoDataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  return logoDataUrl;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text, maxChars) {
  const words = String(text || "").split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

async function composeSvg(node, meta, { size = "slide", transparent = false }) {
  const chartSvgs = [...node.querySelectorAll("svg[role=img]")];
  const W = size === "slide" ? 1280 : 816, H = size === "slide" ? 720 : 600;
  const pad = 48; const inner = W - pad * 2;
  const titleLines = wrap(meta.title, size === "slide" ? 70 : 52);
  let y = pad + 12;
  const parts = [];
  parts.push(`<text x="${pad}" y="${y}" font-family="Inter,Arial" font-size="12" font-weight="600" letter-spacing="1.4" fill="#2D2C2A">${esc((meta.district || "").toUpperCase())} · ${esc(meta.freshness || "")}</text>`);
  y += 34;
  titleLines.forEach((l) => { parts.push(`<text x="${pad}" y="${y}" font-family="'Source Serif 4',Georgia,serif" font-size="${size === "slide" ? 32 : 26}" font-weight="600" fill="#000">${esc(l)}</text>`); y += size === "slide" ? 38 : 31; });
  if (meta.def) { parts.push(`<text x="${pad}" y="${y}" font-family="Inter,Arial" font-size="14" fill="#4A4845">${esc(meta.def)}</text>`); y += 20; }
  const footH = 80;
  const availH = H - y - footH - 10;
  // stack chart svgs vertically, scaled to fit
  const svgs = chartSvgs.map((s) => ({ s, w: +s.getAttribute("width"), h: +s.getAttribute("height") }));
  const totalH = svgs.reduce((a, b) => a + b.h, 0);
  const scale = Math.min(inner / Math.max(...svgs.map((s) => s.w)), availH / totalH);
  let cy = y + 8;
  for (const { s, h } of svgs) {
    const clone = s.cloneNode(true);
    parts.push(`<g transform="translate(${pad},${cy}) scale(${scale})">${clone.innerHTML}</g>`);
    cy += h * scale;
  }
  const legend = node.querySelector(".legend");
  let fy = H - footH + 4;
  if (legend) { parts.push(`<text x="${pad}" y="${fy}" font-family="Inter,Arial" font-size="12" fill="#2D2C2A">${esc([...legend.children].map((c) => c.textContent).join("   ·   "))}</text>`); fy += 20; }
  parts.push(`<line x1="${pad}" x2="${W - pad}" y1="${fy}" y2="${fy}" stroke="#E2E1DE"/>`); fy += 18;
  const foot = [meta.caveat, [meta.peers, meta.source].filter(Boolean).join(" · ")].filter(Boolean);
  foot.forEach((l) => { wrap(l, size === "slide" ? 150 : 100).slice(0, 2).forEach((ll) => { parts.push(`<text x="${pad}" y="${fy}" font-family="Inter,Arial" font-size="11" fill="#6E6C68">${esc(ll)}</text>`); fy += 14; }); });
  const logo = await getLogo();
  parts.push(`<image href="${logo}" x="${W - pad - 120}" y="${H - 36}" width="120" height="27"/>`);
  parts.push(`<text x="${W - pad - 130}" y="${H - 18}" text-anchor="end" font-family="Inter,Arial" font-size="11" fill="#6E6C68">Prepared by Upchurch · ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${transparent ? "" : `<rect width="${W}" height="${H}" fill="#fff"/>`}${parts.join("")}</svg>`;
}

function download(name, blob) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function svgToPngBlob(svg, W, H) {
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2;
  const ctx = c.getContext("2d"); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}

export default function Figure({ title, def, freshness, source, peers, caveat, csv, district, full, children, toast }) {
  const ref = useRef(null);
  const [table, setTable] = useState(false);
  const [menu, setMenu] = useState(false);
  const [size, setSize] = useState("slide");
  const [transparent, setTransparent] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = (e) => e.key === "Escape" && setMenu(false);
    addEventListener("keydown", close); return () => removeEventListener("keydown", close);
  }, [menu]);
  const slug = `${(district || "district").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;
  const citation = `${district ? district + ": " : ""}${title}. ${def ? def + ". " : ""}Source: ${source}${peers ? ". Peers: " + peers : ""}. Prepared by Upchurch, ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`;
  const meta = { title, def, freshness, source, peers, caveat, district };
  const W = size === "slide" ? 1280 : 816, H = size === "slide" ? 720 : 600;
  const act = async (kind) => {
    setMenu(false);
    try {
      if (kind === "csv") { download(slug + ".csv", new Blob([csv.map((r) => r.map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v ?? "")).join(",")).join("\n")], { type: "text/csv" })); return; }
      if (kind === "cite") { await navigator.clipboard.writeText(citation); toast?.("Source citation copied"); return; }
      const svg = await composeSvg(ref.current, meta, { size, transparent });
      if (kind === "svg") download(slug + ".svg", new Blob([svg], { type: "image/svg+xml" }));
      if (kind === "png") download(slug + ".png", await svgToPngBlob(svg, W, H));
      if (kind === "copy") { await navigator.clipboard.write([new ClipboardItem({ "image/png": await svgToPngBlob(svg, W, H) })]); toast?.("Image copied"); }
    } catch (e) { console.error(e); toast?.("Export failed in this browser"); }
  };
  return (
    <figure className={"fig" + (full ? " full" : "")} style={{ margin: 0 }}>
      <div className="fig-head">
        <div><h3 className="fig-title">{title}</h3>{def && <p className="fig-def">{def}</p>}</div>
        <div className="fig-tools">
          {freshness && <span className="fresh">{freshness}</span>}
          {csv && <button className="btn" onClick={() => setTable((t) => !t)}>{table ? "Chart" : "Table"}</button>}
          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => setMenu((m) => !m)} aria-haspopup="menu">⤓ Export</button>
            {menu && (
              <div className="menu-pop" role="menu">
                <button onClick={() => act("png")}>PNG</button>
                <button onClick={() => act("svg")}>SVG</button>
                <button onClick={() => act("copy")}>Copy image</button>
                {csv && <button onClick={() => act("csv")}>CSV of data</button>}
                <button onClick={() => act("cite")}>Copy source citation</button>
                <hr />
                <div className="small" style={{ padding: "4px 8px" }}>
                  <label><input type="radio" checked={size === "slide"} onChange={() => setSize("slide")} /> 16:9 slide</label><br />
                  <label><input type="radio" checked={size === "letter"} onChange={() => setSize("letter")} /> Letter width</label><br />
                  <label><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background</label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div ref={ref}>
        {table && csv ? (
          <div className="tablewrap"><table className="data"><thead><tr>{csv[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{csv.slice(1).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? "r num" : ""}>{typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v}</td>)}</tr>)}</tbody></table></div>
        ) : children}
      </div>
      <div className="fig-foot">{caveat && <i>{caveat}</i>}{[peers, source].filter(Boolean).join(" · ")}</div>
    </figure>
  );
}
