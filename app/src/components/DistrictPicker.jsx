// Searchable district autocomplete: name, county, ESC region and TEA number (disambiguates duplicate names).
import { useMemo, useState } from "react";
import { title } from "../lib/format.js";

export default function DistrictPicker({ model, onPick, placeholder = "Look up a district", width = 260, exclude = [] }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0);
  const res = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase().trim();
    return model.districts.filter((d) => !exclude.includes(d.id) && (d.name.toLowerCase().includes(t) || d.id.includes(t) || (d.county || "").toLowerCase().startsWith(t)))
      .sort((a, b) => (a.name.toLowerCase().startsWith(t) ? 0 : 1) - (b.name.toLowerCase().startsWith(t) ? 0 : 1) || (b.s.enroll.at(-1) || 0) - (a.s.enroll.at(-1) || 0))
      .slice(0, 12);
  }, [q, model, exclude]);
  const pick = (d) => { onPick(d); setQ(""); setOpen(false); };
  return (
    <div className="lookup">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input placeholder={placeholder} value={q} style={{ width }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }} role="combobox" aria-expanded={open && res.length > 0} aria-label={placeholder}
        onKeyDown={(e) => { if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, res.length - 1)); if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0)); if (e.key === "Enter" && res[hi]) pick(res[hi]); if (e.key === "Escape") setOpen(false); }} />
      {open && q.trim().length >= 2 && (
        <div className="menu" role="listbox">{res.map((d, i) => (
          <button key={d.id} role="option" aria-selected={i === hi} className={i === hi ? "hi" : ""} onMouseDown={() => pick(d)}>
            <b>{title(d.name)}</b><div className="dmeta">{d.county} County · Region {d.region} · TEA {d.id}{d.charter ? " · Charter" : ""}</div></button>))}
          {!res.length && <div className="empty" style={{ padding: 12 }}>No district matches that name.</div>}</div>)}
    </div>
  );
}
