#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];
const canonical = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "building-canonical.json"), "utf8"),
);
const { width_m, depth_m } = canonical.envelope.footprint;

let faces = canonical.envelope.faces;
if (!faces.length) {
  const h = canonical.envelope.default_height_m ?? 6;
  faces = [
    { id: "north", bearing_deg: 0, width_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "south", bearing_deg: 180, width_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "east", bearing_deg: 90, width_m: depth_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "west", bearing_deg: 270, width_m: depth_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
  ];
}

const PROV_COLORS = { surveyed: "#3d9e5a", derived: "#c9a227", assumed: "#c94a4a" };
const components = [];

components.push({
  id: "footprint-slab",
  name_en: "Footprint slab",
  phase: "footprint",
  category: "building-slab",
  geometry: { type: "box", w: width_m, h: 0.15, d: depth_m },
  position: [0, -0.075, 0],
  provenance: "assumed",
  source: "visual",
  material: "concrete",
});

for (const face of faces) {
  const rad = (face.bearing_deg * Math.PI) / 180;
  const isNS = face.bearing_deg === 0 || face.bearing_deg === 180;
  const offset = isNS ? depth_m / 2 : width_m / 2;
  const x = Math.sin(rad) * offset;
  const z = Math.cos(rad) * offset;
  components.push({
    id: `face-${face.id}`,
    name_en: `${face.id} elevation`,
    phase: "faces",
    category: "building-face",
    geometry: { type: "box", w: face.width_m, h: face.height_m, d: 0.2 },
    position: [x, face.height_m / 2, z],
    rotation_deg: [0, face.bearing_deg, 0],
    provenance: face.provenance,
    source: face.source,
    face_id: face.id,
  });
}

for (const zone of canonical.constraints.no_scaffold_zones ?? []) {
  const face = faces.find((f) => f.id === zone.face_id);
  if (!face) continue;
  const rad = (face.bearing_deg * Math.PI) / 180;
  const isNS = face.bearing_deg === 0 || face.bearing_deg === 180;
  const offset = isNS ? depth_m / 2 : width_m / 2;
  const baseX = Math.sin(rad) * offset;
  const baseZ = Math.cos(rad) * offset;
  const outwardX = Math.sin(rad);
  const outwardZ = Math.cos(rad);
  components.push({
    id: `no-scaffold-zone-${zone.id}`,
    name_en: `No-scaffold zone ${zone.id}`,
    phase: "faces",
    category: "no-scaffold-zone",
    geometry: { type: "box", w: zone.w_m, h: zone.h_m, d: 0.05 },
    position: [
      baseX + outwardX * 0.1 + (zone.x_m - face.width_m / 2) * (isNS ? 1 : 0),
      zone.y_m + zone.h_m / 2,
      baseZ + outwardZ * 0.1 + (zone.x_m - face.width_m / 2) * (isNS ? 0 : 1),
    ],
    rotation_deg: [0, face.bearing_deg, 0],
    provenance: "surveyed",
    source: "constraints",
    face_id: zone.face_id,
  });
}

const spec = {
  meta: { project_id: projectId, generated_by: "scripts/derive-building.mjs" },
  units: { length: "m" },
  phases: ["footprint", "faces"],
  key_dimensions: { width_m, depth_m, face_count: faces.length },
  provenance_colors: PROV_COLORS,
  components,
};

const outDir = join(ROOT, "artifacts/projects", projectId);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "building-spec.json"), JSON.stringify(spec, null, 2));
console.log(
  `derive-building: ${components.length} components → artifacts/projects/${projectId}/building-spec.json`,
);
