// Texas county boundaries (TopoJSON -> GeoJSON), from the us-atlas package.
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {feature, mesh} from "topojson-client";

const require = createRequire(import.meta.url);
const us = JSON.parse(await readFile(require.resolve("us-atlas/counties-10m.json"), "utf8"));
const TX = (d) => d.id.slice(0, 2) === "48";

const tx = {...us.objects.counties, geometries: us.objects.counties.geometries.filter(TX)};
const counties = feature(us, tx);
counties.features.forEach((f) => (f.properties.key = f.properties.name.toUpperCase().replace(/[^A-Z]/g, "")));

process.stdout.write(JSON.stringify({
  counties,
  outline: mesh(us, {...us.objects.states, geometries: us.objects.states.geometries.filter((d) => d.id === "48")})
}));
