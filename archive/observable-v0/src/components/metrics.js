// Metric definitions shared by the explorer. `value(row)` gets a district-year row.
export const PEER_BANDS = [
  {label: "Under 500", min: 0, max: 499},
  {label: "500–999", min: 500, max: 999},
  {label: "1,000–1,599", min: 1000, max: 1599},
  {label: "1,600–4,999", min: 1600, max: 4999},
  {label: "5,000–24,999", min: 5000, max: 24999},
  {label: "25,000+", min: 25000, max: Infinity}
];

export const peerBand = (enrollment) => PEER_BANDS.find((b) => enrollment >= b.min && enrollment <= b.max)?.label;

const perStudent = (key) => (d) => (d[key] == null || !d.enrollment ? null : d[key] / d.enrollment);

export const METRICS = [
  {key: "plant_maintenance", label: "Plant maintenance & operations (FCT 51)", short: "Plant M&O", unit: "$", value: perStudent("plant_maintenance"), total: "plant_maintenance"},
  {key: "capital_outlay", label: "Capital projects", short: "Capital", unit: "$", value: perStudent("capital_outlay"), total: "capital_outlay"},
  {key: "security", label: "Security & monitoring (FCT 52)", short: "Security", unit: "$", value: perStudent("security"), total: "security"},
  {key: "transport", label: "Transportation (FCT 34)", short: "Transport", unit: "$", value: perStudent("transport"), total: "transport"},
  {key: "data_processing", label: "Data processing (FCT 53)", short: "Data processing", unit: "$", value: perStudent("data_processing"), total: "data_processing"},
  {key: "total_expense", label: "Total disbursements", short: "Total spend", unit: "$", value: perStudent("total_expense"), total: "total_expense"},
  {key: "debt_service", label: "Debt service", short: "Debt service", unit: "$", value: perStudent("debt_service"), total: "debt_service"},
  {key: "pm_share", label: "Plant M&O share of operating spend", short: "M&O share", unit: "%",
    value: (d) => (d.operating_expense ? d.plant_maintenance / d.operating_expense : null)},
  {key: "net_margin", label: "Net margin (revenue − disbursements) ÷ revenue", short: "Net margin", unit: "%",
    value: (d) => (d.revenue ? (d.revenue - d.total_expense) / d.revenue : null)},
  {key: "enrollment", label: "Enrollment", short: "Enrollment", unit: "n", value: (d) => d.enrollment}
];

export const fmt = {
  $: (v) => (v == null || isNaN(v) ? "—" : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v).toLocaleString("en-US")}`),
  "%": (v) => (v == null || isNaN(v) ? "—" : `${(v * 100).toFixed(1)}%`),
  n: (v) => (v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("en-US")),
  pct: (v) => (v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`),
  money: (v) => (v == null || isNaN(v) ? "—" : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}k`)
};

export const titleCase = (s) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Isd|Cisd|Msd|Csd)\b/g, (m) => m.toUpperCase());
