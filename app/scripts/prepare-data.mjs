// Encrypt the data bundle for publishing. The site ships only ciphertext; the team key decrypts it in the browser.
// Usage: TEAM_KEY="..." node scripts/prepare-data.mjs   (falls back to "dev-key" locally, with a warning)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { webcrypto as crypto } from "node:crypto";

const key = process.env.TEAM_KEY || "dev-key";
if (!process.env.TEAM_KEY) console.warn("⚠ TEAM_KEY not set; encrypting with 'dev-key'. Set TEAM_KEY for real builds.");
const ITER = 250_000;

const plain = gzipSync(readFileSync("data/bundle.json"), { level: 9 });
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveKey"]);
const aes = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base,
  { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, plain));
const b64 = (u8) => Buffer.from(u8).toString("base64");

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/bundle.enc.json", JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
copyFileSync("data/districts.topo.json", "public/data/districts.topo.json");
console.log(`encrypted bundle: ${(plain.length / 1e6).toFixed(1)} MB gzipped -> public/data/bundle.enc.json`);
