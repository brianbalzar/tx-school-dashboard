import {svg} from "npm:htl";

// Tiny inline trend line for table cells. `values` = [{year, v}] sorted by year.
export function sparkline(values, {width = 90, height = 18} = {}) {
  const pts = values.filter((d) => d.v != null && isFinite(d.v));
  if (pts.length < 2) return "";
  const x0 = pts[0].year, x1 = pts.at(-1).year;
  const lo = Math.min(...pts.map((d) => d.v)), hi = Math.max(...pts.map((d) => d.v));
  const x = (y) => 2 + ((y - x0) / (x1 - x0 || 1)) * (width - 6);
  const y = (v) => height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4);
  const path = pts.map((d, i) => `${i ? "L" : "M"}${x(d.year).toFixed(1)},${y(d.v).toFixed(1)}`).join("");
  const last = pts.at(-1);
  return svg`<svg width=${width} height=${height} style="vertical-align:middle;overflow:visible">
    <path d=${path} fill="none" stroke="var(--series-1)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx=${x(last.year)} cy=${y(last.v)} r="2" fill="var(--series-1)"/>
  </svg>`;
}
