// Device-local research state (v1). Mirrors the Export/Import research file format from the design handoff.
import { useEffect, useState, useCallback } from "react";

const STORE = "upchurch-txr-research-v1";
const empty = { disp: {}, pins: [], edits: {}, qEdits: {}, notes: {}, research: {}, compareIds: [], radarTable: "matrix", savedAt: null };

function load() {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch { return { ...empty }; }
}

export function useResearch() {
  const [state, setState] = useState(load);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);
  const update = useCallback((fn) => setState((s) => ({ ...fn(s), savedAt: new Date().toISOString() })), []);
  return [state, update];
}

export function exportResearch(state) {
  const blob = new Blob([JSON.stringify({ format: "upchurch-district-research", version: 1, exported: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `district-research-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importResearch(file) {
  const data = JSON.parse(await file.text());
  if (data.format !== "upchurch-district-research") throw new Error("Not a district research file");
  const { format, version, exported, ...rest } = data;
  return rest;
}

// URL hash state: #v=district&d=220907&lens=pc&tab=ops
export function readHash() {
  return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
}
export function useHashState() {
  const [h, setH] = useState(readHash);
  useEffect(() => {
    const on = () => setH(readHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((patch, { replace = false } = {}) => {
    const next = { ...readHash(), ...patch };
    Object.keys(next).forEach((k) => (next[k] == null || next[k] === "") && delete next[k]);
    const str = "#" + new URLSearchParams(next).toString();
    if (replace) history.replaceState(null, "", str); else history.pushState(null, "", str);
    setH(next);
  }, []);
  return [h, go];
}
