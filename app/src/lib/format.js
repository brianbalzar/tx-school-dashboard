export const money = (x, { compact = true } = {}) => {
  if (x == null || !isFinite(x)) return "—";
  const a = Math.abs(x), s = x < 0 ? "−" : "";
  if (!compact) return `${s}$${Math.round(a).toLocaleString("en-US")}`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a).toLocaleString("en-US")}`;
};
export const num = (x) => (x == null || !isFinite(x) ? "—" : Math.round(x).toLocaleString("en-US"));
export const pct = (x, { signed = true, digits = 0 } = {}) => {
  if (x == null || !isFinite(x)) return "—";
  const v = (x * 100).toFixed(digits);
  return `${signed && x > 0 ? "+" : ""}${v}%`;
};
export const fy = (y) => `FY${String(y).slice(2)}`;
export const title = (s) =>
  (s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Isd|Cisd|Msd|Csd|Ssd)\b/g, (m) => m.toUpperCase())
    .replace(/\bMt\b/g, "Mt.").replace(/-([a-z])/g, (m) => m.toUpperCase());
export const REGION_NAMES = {1:"Edinburg",2:"Corpus Christi",3:"Victoria",4:"Houston",5:"Beaumont",6:"Huntsville",7:"Kilgore",8:"Mount Pleasant",9:"Wichita Falls",10:"Richardson",11:"Fort Worth",12:"Waco",13:"Austin",14:"Abilene",15:"San Angelo",16:"Amarillo",17:"Lubbock",18:"Midland",19:"El Paso",20:"San Antonio"};

const CAMPUS_LABELS = { elementary_school: "elementary", middle_school: "middle", junior_high_school: "junior high",
  high_school: "high", elementary_secondary: "combined-grade (K–12)", other: "other" };
export const campusLabel = (k) => CAMPUS_LABELS[k] || k.replace(/_/g, " ");
