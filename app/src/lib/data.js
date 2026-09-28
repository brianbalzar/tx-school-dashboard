// In-memory data model built from the decrypted bundle.
import { median } from "d3-array";

export function buildModel(bundle) {
  const { meta, districts } = bundle;
  const byId = new Map(districts.map((d) => [d.id, d]));
  const years = meta.years;
  const yi = (y) => years.indexOf(y);
  return { meta, districts, byId, years, yi };
}

// per-student series for a district: numerator series key (e.g. "util") divided by enrollment
export function perStudent(d, key) {
  const n = d.s[key], e = d.s.enroll;
  return n.map((v, i) => (v == null || !e[i] ? null : v / e[i]));
}

// controllable plant O&M = Function 51 minus insurance and capital
export function controllable(d) {
  return d.s.f51.map((v, i) => (v == null ? null : v - (d.s.insurance[i] || 0) - (d.s.capital51[i] || 0)));
}

export function seriesFn(kind) {
  if (kind === "ctrl") return (d) => { const c = controllable(d); return c.map((v, i) => (v == null || !d.s.enroll[i] ? null : v / d.s.enroll[i])); };
  return (d) => perStudent(d, kind);
}

// median across a set of districts, year by year
export function medianSeries(model, ids, fn) {
  const rows = ids.map((id) => model.byId.get(id)).filter(Boolean).map(fn);
  return model.years.map((_, i) => median(rows.map((r) => r[i]).filter((v) => v != null && isFinite(v))) ?? null);
}

export function regionIds(model, d) {
  return model.districts.filter((x) => x.region === d.region && x.charter === d.charter && (x.s.enroll.at(-1) || 0) >= 500).map((x) => x.id);
}
export function stateIds(model, d) {
  return model.districts.filter((x) => x.charter === d.charter && (x.s.enroll.at(-1) || 0) >= 500).map((x) => x.id);
}

export const LENSES = [
  { key: "pc", label: "Performance Contracting (ESCO)", blurb: "Utility-cost level and growth that a guaranteed-savings project could address", headline: "Utilities per student", unit: "/student", magnitude: "est. ESCO project (base case)", perYear: false },
  { key: "om", label: "Facilities O&M (Uptime Ops)", blurb: "Plant operations cost level, operating-model shifts and budget changes", headline: "Plant operations per student", unit: "/student", magnitude: "est. Uptime Ops fee", perYear: true },
  { key: "cap", label: "Capital Planning (FCA/Bond)", blurb: "Capital-planning signals: timing, debt capacity, growth and bond history", headline: "Years since passed bond", unit: " yrs", magnitude: "debt retiring by FY2030 (est.)", perYear: false },
  { key: "em", label: "Energy Manager as a Service", blurb: "Districts too small for a full-time energy manager but with enough utility spend for a shared one to pay off", headline: "Utilities per student", unit: "/student", magnitude: "est. EMaaS net of fee", perYear: true },
];

export const SIGNAL_SHORT = {
  "utility-level": "Utility cost above peers", "utility-growth": "Utility growth > peers",
  "om-level": "Plant O&M above peers", "om-low": "Spending well below peers", "om-shift": "Shift to contractors",
  "om-growth": "Costs outpacing enrollment", "om-budget": "Plant budget up",
  "cap-since": "Long gap since bond", "cap-growth": "Enrollment growth", "cap-retire": "Debt retiring",
  "cap-failed": "Recent failed bond", "cap-passed": "Bond recently approved", "cap-mixed": "Mixed recent results", "cap-capacity": "I&S headroom",
  "em-fit": "Right-sized for shared EM", "em-utility": "Utility costs worth managing", "em-budget": "General-fund deficit",
};
export const LENS_SIGNALS = {
  pc: ["utility-level", "utility-growth"],
  om: ["om-level", "om-shift", "om-growth", "om-budget", "om-low"],
  cap: ["cap-since", "cap-growth", "cap-retire", "cap-failed", "cap-passed", "cap-mixed", "cap-capacity"],
  em: ["em-fit", "em-utility", "em-budget"],
};

// short text for the model-score tooltip
export function scoreTip(d, lens) {
  const z = d.sizing; if (!z) return "";
  if (lens === "pc") { const c = z.esco.components; return `ESCO score = 45% budget stress (${Math.round(c.budgetStress * 100)}) + 35% savings per student (${Math.round(c.savingsIndex * 100)}) + 20% plant-cost inefficiency (${Math.round(c.inefficiency * 100)})`; }
  if (lens === "om") return "Uptime Ops score = 50% plant-cost inefficiency + 30% plant O&M per student + 20% net benefit per student (percentile-scaled)";
  if (lens === "em") return z.emaas.eligible ? "EMaaS score = 40% net benefit + 25% plant O&M per student + 20% capital per student + 15% enrollment (percentile-scaled, eligible districts only)" : "Outside the 1,000–3,000 student EMaaS band";
  return "";
}
