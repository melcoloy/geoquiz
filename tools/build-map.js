// Génère js/map.js (tracés SVG des pays) à partir de world-atlas.
// Usage (une seule fois, depuis le dossier geoquiz) :
//   npm i --no-save world-atlas@2 topojson-client topojson-simplify d3-geo i18n-iso-countries
//   node tools/build-map.js
const fs = require("fs");
const path = require("path");
const { feature } = require("topojson-client");
const simplify = require("topojson-simplify");
const { geoNaturalEarth1, geoPath } = require("d3-geo");
const iso = require("i18n-iso-countries");

// Codes des pays du quiz (lus dans js/data.js)
const dataSrc = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
const QUIZ_CODES = new Set([...dataSrc.matchAll(/\["([a-z]{2})",/g)].map((m) => m[1]));

// Carte 1:50m simplifiée (bon compromis précision / poids)
let topo = require("world-atlas/countries-50m.json");
topo = simplify.presimplify(topo);
topo = simplify.simplify(topo, simplify.quantile(topo, 0.1));
const features = feature(topo, topo.objects.countries).features;

const W = 1000, H = 520;
const projection = geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
const pathGen = geoPath(projection).digits(1);

const BY_NAME = { Kosovo: "XK" };
const paths = {};   // pays du quiz (cliquables)
const others = [];  // autres territoires (décor)
const markers = {}; // petits pays : cercle cliquable [x, y]

for (const f of features) {
  const code = (f.id && iso.numericToAlpha2(f.id)) || BY_NAME[f.properties.name];
  const d = pathGen(f);
  if (!d) continue;
  const c = code && code.toLowerCase();
  if (c && QUIZ_CODES.has(c)) {
    paths[c] = (paths[c] || "") + d;
    const [[x0, y0], [x1, y1]] = pathGen.bounds(f);
    if (x1 - x0 < 3 && y1 - y0 < 3) markers[c] = [+((x0 + x1) / 2).toFixed(1), +((y0 + y1) / 2).toFixed(1)];
  } else {
    others.push(d);
  }
}

// Cadrages par région (longitudes / latitudes)
const REGIONS = {
  all: [[-180, -58], [180, 84]],
  Europe: [[-25, 34], [45, 71]],
  Afrique: [[-20, -36], [55, 38]],
  Asie: [[25, -11], [150, 56]],
  Amériques: [[-170, -56], [-30, 72]],
  Océanie: [[110, -48], [180, 10]],
};
const views = {};
for (const [name, [[lon0, lat0], [lon1, lat1]]] of Object.entries(REGIONS)) {
  const pts = [];
  for (let lon = lon0; lon <= lon1; lon += 5)
    for (let lat = lat0; lat <= lat1; lat += 5) pts.push(projection([lon, lat]));
  pts.push(projection([lon1, lat1]));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  views[name] = [x, y, Math.max(...xs) - x, Math.max(...ys) - y].map(Math.round);
}

const out =
  "// Fichier généré par tools/build-map.js — ne pas modifier à la main.\n" +
  `const MAP_VIEWS = ${JSON.stringify(views)};\n` +
  `const MAP_MARKERS = ${JSON.stringify(markers)};\n` +
  `const MAP_OTHERS = ${JSON.stringify(others.join(""))};\n` +
  `const MAP_PATHS = ${JSON.stringify(paths)};\n`;
fs.writeFileSync(path.join(__dirname, "..", "js", "map.js"), out);

const missing = [...QUIZ_CODES].filter((c) => !paths[c]);
console.log(`${Object.keys(paths).length}/${QUIZ_CODES.size} pays tracés, ${Object.keys(markers).length} marqueurs, ${(out.length / 1024).toFixed(0)} Ko`);
if (missing.length) console.log("Absents de la carte :", missing.join(", "));