import { createComp } from "./comp.mjs";
import { PROVENANCE_COLORS } from "./constants.mjs";

const r2 = (n) => Math.round(n * 1000) / 1000;
const rad = (deg) => (deg * Math.PI) / 180;

function footprintBounds(points) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}

function faceOffset(face, bounds, height) {
  const b = rad(face.bearing_deg);
  const nx = Math.sin(b);
  const nz = Math.cos(b);
  const dist =
    face.bearing_deg === 0
      ? bounds.maxZ
      : face.bearing_deg === 180
        ? bounds.minZ
        : face.bearing_deg === 90
          ? bounds.maxX
          : bounds.minX;
  const sign = face.bearing_deg === 180 || face.bearing_deg === 270 ? -1 : 1;
  const cx = bounds.centerX + (face.bearing_deg === 90 ? dist : face.bearing_deg === 270 ? -dist + bounds.minX - bounds.centerX : 0);
  const cz = bounds.centerZ + (face.bearing_deg === 0 ? dist : face.bearing_deg === 180 ? -dist + bounds.minZ - bounds.centerZ : 0);
  return {
    x: face.bearing_deg === 90 ? bounds.maxX : face.bearing_deg === 270 ? bounds.minX : bounds.centerX,
    y: height / 2,
    z: face.bearing_deg === 0 ? bounds.maxZ : face.bearing_deg === 180 ? bounds.minZ : bounds.centerZ,
    rotY: -b,
    nx: nx * sign,
    nz: nz * sign,
  };
}

export function deriveBuilding(canonical) {
  const components = [];
  const comp = createComp(components);
  const bounds = footprintBounds(canonical.envelope.footprint.points);
  const fp = canonical.envelope.footprint;

  comp({
    id: "footprint-slab",
    name_en: "Footprint slab",
    phase: "footprint",
    category: "massing",
    role: "Ground plane reference",
    geometry: { type: "box", w: bounds.width, h: 0.2, d: bounds.depth },
    position: [bounds.centerX, -0.1, bounds.centerZ],
    provenance: fp.provenance,
    source: fp.source,
  });

  for (const face of canonical.envelope.faces) {
    const pos = faceOffset(face, bounds, face.height_m);
    comp({
      id: `face-${face.id}`,
      name_en: `${face.id} elevation`,
      phase: "faces",
      category: "massing",
      role: "Scaffold target face",
      geometry: { type: "box", w: face.width_m, h: face.height_m, d: 0.15 },
      position: [pos.x, face.height_m / 2, pos.z],
      rotation_deg: [0, (face.bearing_deg * Math.PI) / 180, 0],
      provenance: face.provenance,
      source: face.source,
      face_id: face.id,
      bearing_deg: face.bearing_deg,
      width_m: face.width_m,
      height_m: face.height_m,
    });

    face.openings?.forEach((op, i) => {
      comp({
        id: `opening-${face.id}-${i}`,
        name_en: `${op.type} opening`,
        phase: "faces",
        category: "opening",
        role: "Opening marker",
        geometry: { type: "box", w: op.w_m, h: op.h_m, d: 0.2 },
        position: [pos.x, op.y_m + op.h_m / 2, pos.z],
        rotation_deg: [0, (face.bearing_deg * Math.PI) / 180, 0],
        provenance: face.provenance,
        source: face.source,
        material: "marker",
      });
    });
  }

  return {
    meta: {
      project_id: canonical.meta.project_id,
      generated_by: "derive-building.mjs",
      canonical_source: `data/projects/${canonical.meta.project_id}/building-canonical.json`,
    },
    units: { scene_scale: 1, unit: "m" },
    provenance_colors: PROVENANCE_COLORS,
    phases: ["footprint", "faces"],
    components,
  };
}

export { r2, footprintBounds, faceOffset };
