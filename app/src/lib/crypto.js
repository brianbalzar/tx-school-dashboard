// Decrypt the published data bundle with the team key (AES-GCM, PBKDF2-SHA256), then gunzip.
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function decryptBundle(key, url = "data/bundle.enc.json") {
  const env = await (await fetch(url, { cache: "no-cache" })).json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveKey"]);
  const aes = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(env.salt), iterations: env.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(env.iv) }, aes, fromB64(env.ct));
  } catch {
    throw new Error("bad-key");
  }
  const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

const KEY_STORE = "upchurch-txr-key";
export function savedKey() {
  try { return localStorage.getItem(KEY_STORE) || sessionStorage.getItem(KEY_STORE); } catch { return null; }
}
export function saveKey(key, remember) {
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY_STORE, key);
    (remember ? sessionStorage : localStorage).removeItem(KEY_STORE);
  } catch { /* storage unavailable */ }
}
export function forgetKey() {
  try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
}
