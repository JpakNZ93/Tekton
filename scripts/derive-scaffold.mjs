#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];

const buildingSpec = JSON.parse(
  readFileSync(join(ROOT, "artifacts/projects", projectId, "building-spec.json"), "utf8"),
);
const scaffoldConfig = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "scaffold-config.json"), "utf8"),
);
const system = JSON.parse(
  readFileSync(join(ROOT, "data/scaffold-systems", `${scaffoldConfig.system_id}.json`), "utf8"),
);
const canonical = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "building-canonical.json"), "utf8"),
);

const { ledger_spacing_m, transom_spacing_m, board_width_m, tube_diameter_m } = system.components;
const {
  max_lift_height_m,
  tie_spacing_vertical_lifts,
  guardrail_required,
  toe_board_required,
  couplers_per_joint,
} = system.rules;
const stock = system.stock_codes;
const source = `scaffold-system:${system.id}`;

function getFaceData(faceId) {
  const buildingFace = buildingSpec.components.find((c) => c.id === `face-${faceId}`);
  const canonicalFace = canonical.envelope.faces.find((f) => f.id === faceId);
  if (!buildingFace || !canonicalFace) return null;
  return { buildingFace, canonicalFace };
}

function outwardOffset(bearingDeg, standoff) {
  const rad = (bearingDeg * Math.PI) / 180;
  return [Math.sin(rad) * standoff, 0, Math.cos(rad) * standoff];
}

function posOnFace(basePos, offset, bearingDeg, alongFace, isNS) {
  const [ox, , oz] = offset;
  return [
    basePos[0] + ox + (isNS ? alongFace : 0),
    basePos[1],
    basePos[2] + oz + (isNS ? 0 : alongFace),
  ];
}

const components = [];
const keyDimensions = {};

for (const faceId of scaffoldConfig.selected_faces) {
  const faceData = getFaceData(faceId);
  if (!faceData) continue;

  const { buildingFace, canonicalFace } = faceData;
  const { width_m: faceWidth, height_m: faceHeight, bearing_deg } = canonicalFace;

  let bayCount = Math.ceil(faceWidth / ledger_spacing_m);
  let liftCount = Math.ceil((faceHeight + scaffoldConfig.extra_lift_m) / max_lift_height_m);

  for (const o of scaffoldConfig.overrides ?? []) {
    if (o.face_id !== faceId) continue;
    if (o.type === "add_lift") liftCount += 1;
    if (o.type === "remove_lift") liftCount = Math.max(1, liftCount - 1);
    if (o.type === "set_bay_width" && o.bay_width_m) bayCount = Math.ceil(faceWidth / o.bay_width_m);
  }

  keyDimensions[`${faceId}_bay_count`] = bayCount;
  keyDimensions[`${faceId}_lift_count`] = liftCount;

  const offset = outwardOffset(bearing_deg, scaffoldConfig.standoff_m);
  const basePos = buildingFace.position;
  const isNS = bearing_deg === 0 || bearing_deg === 180;
  const standardCount = bayCount + 1;

  for (let b = 0; b < standardCount; b++) {
    const alongFace = -faceWidth / 2 + (b * faceWidth) / bayCount;
    const [sx, , sz] = posOnFace(basePos, offset, bearing_deg, alongFace, isNS);
    const tubeHeight = liftCount * max_lift_height_m;
    components.push({
      id: `${faceId}-tube-${b}`,
      name_en: `${faceId} standard ${b}`,
      phase: "lifts",
      category: "tube",
      geometry: { type: "cylinder", r: tube_diameter_m / 2, h: tubeHeight },
      position: [sx, tubeHeight / 2, sz],
      provenance: "derived",
      source,
      stock_code: stock.tube,
      face_id: faceId,
      lift_index: 0,
    });
  }

  for (let lift = 0; lift < liftCount; lift++) {
    const skipLift = scaffoldConfig.overrides?.some(
      (o) => o.face_id === faceId && o.type === "remove_lift" && o.lift_index === lift,
    );
    if (skipLift) continue;

    const liftY = (lift + 1) * max_lift_height_m;

    for (let b = 0; b < bayCount; b++) {
      const alongStart = -faceWidth / 2 + (b * faceWidth) / bayCount;
      const alongEnd = -faceWidth / 2 + ((b + 1) * faceWidth) / bayCount;
      const midAlong = (alongStart + alongEnd) / 2;
      const ledgerLen = faceWidth / bayCount;
      const [lx, , lz] = posOnFace(basePos, offset, bearing_deg, midAlong, isNS);

      components.push({
        id: `${faceId}-ledger-L${lift}-B${b}`,
        name_en: `${faceId} ledger lift ${lift} bay ${b}`,
        phase: "lifts",
        category: "ledger",
        geometry: { type: "box", w: ledgerLen, h: 0.05, d: 0.05 },
        position: [lx, liftY, lz],
        rotation_deg: [0, bearing_deg, 0],
        provenance: "derived",
        source,
        stock_code: stock.ledger,
        face_id: faceId,
        lift_index: lift,
      });

      for (const endBay of [b, b + 1]) {
        for (let c = 0; c < couplers_per_joint; c++) {
          components.push({
            id: `${faceId}-coupler-L${lift}-B${b}-S${endBay}-C${c}`,
            name_en: `${faceId} coupler lift ${lift} bay ${b} std ${endBay}`,
            phase: "lifts",
            category: "coupler",
            geometry: { type: "box", w: 0.1, h: 0.1, d: 0.1 },
            position: [lx, liftY, lz],
            provenance: "derived",
            source,
            stock_code: stock.coupler,
            face_id: faceId,
            lift_index: lift,
          });
        }
      }
    }

    const transomCount = Math.ceil(faceWidth / transom_spacing_m);
    for (let t = 0; t < transomCount; t++) {
      const along = -faceWidth / 2 + t * transom_spacing_m + transom_spacing_m / 2;
      if (along > faceWidth / 2) break;
      const [tx, , tz] = posOnFace(basePos, offset, bearing_deg, along, isNS);
      components.push({
        id: `${faceId}-transom-L${lift}-T${t}`,
        name_en: `${faceId} transom lift ${lift} ${t}`,
        phase: "lifts",
        category: "transom",
        geometry: { type: "box", w: transom_spacing_m, h: 0.05, d: 0.05 },
        position: [tx, liftY, tz],
        rotation_deg: [0, bearing_deg + 90, 0],
        provenance: "derived",
        source,
        stock_code: stock.transom,
        face_id: faceId,
        lift_index: lift,
      });
    }

    const boardCount = Math.ceil(faceWidth / board_width_m);
    for (let bd = 0; bd < boardCount; bd++) {
      const along = -faceWidth / 2 + bd * board_width_m + board_width_m / 2;
      const [bx, , bz] = posOnFace(basePos, offset, bearing_deg, along, isNS);
      components.push({
        id: `${faceId}-board-L${lift}-D${bd}`,
        name_en: `${faceId} board lift ${lift} ${bd}`,
        phase: "lifts",
        category: "board",
        geometry: { type: "box", w: board_width_m, h: 0.05, d: 1.3 },
        position: [bx, liftY - 0.05, bz],
        rotation_deg: [0, bearing_deg, 0],
        provenance: "derived",
        source,
        stock_code: stock.board,
        face_id: faceId,
        lift_index: lift,
      });
    }

    if (lift % tie_spacing_vertical_lifts === 0) {
      for (let b = 0; b < bayCount; b++) {
        const along = -faceWidth / 2 + (b + 0.5) * (faceWidth / bayCount);
        const [tix, , tiz] = posOnFace(basePos, offset, bearing_deg, along, isNS);
        components.push({
          id: `${faceId}-tie-L${lift}-B${b}`,
          name_en: `${faceId} tie lift ${lift} bay ${b}`,
          phase: "lifts",
          category: "tie",
          geometry: { type: "box", w: 0.3, h: 0.05, d: 0.3 },
          position: [tix, liftY, tiz],
          provenance: "derived",
          source,
          stock_code: stock.tie,
          face_id: faceId,
          lift_index: lift,
        });
      }
    }

    if (guardrail_required) {
      const [gx, , gz] = posOnFace(basePos, offset, bearing_deg, 0, isNS);
      components.push({
        id: `${faceId}-guardrail-L${lift}`,
        name_en: `${faceId} guardrail lift ${lift}`,
        phase: "lifts",
        category: "guardrail",
        geometry: { type: "box", w: faceWidth, h: 1.1, d: 0.05 },
        position: [gx, liftY + 1.1, gz],
        rotation_deg: [0, bearing_deg, 0],
        provenance: "derived",
        source,
        stock_code: stock.guardrail,
        face_id: faceId,
        lift_index: lift,
      });
    }

    if (lift === liftCount - 1 && toe_board_required) {
      const [tx, , tz] = posOnFace(basePos, offset, bearing_deg, 0, isNS);
      components.push({
        id: `${faceId}-toeboard-L${lift}`,
        name_en: `${faceId} toe board lift ${lift}`,
        phase: "lifts",
        category: "toe_board",
        geometry: { type: "box", w: faceWidth, h: 0.15, d: 0.05 },
        position: [tx, liftY - 0.1, tz],
        rotation_deg: [0, bearing_deg, 0],
        provenance: "derived",
        source,
        stock_code: stock.toe_board,
        face_id: faceId,
        lift_index: lift,
      });
    }
  }

  if (bayCount > 3) {
    for (
      let b = scaffoldConfig.access_bay_every_n;
      b <= bayCount;
      b += scaffoldConfig.access_bay_every_n
    ) {
      const along = -faceWidth / 2 + (b * faceWidth) / bayCount;
      const [ax, , az] = posOnFace(basePos, offset, bearing_deg, along, isNS);
      components.push({
        id: `${faceId}-access-B${b}`,
        name_en: `${faceId} access bay ${b}`,
        phase: "lifts",
        category: "access",
        geometry: { type: "box", w: ledger_spacing_m * 1.5, h: max_lift_height_m, d: 1.5 },
        position: [ax, max_lift_height_m / 2, az],
        provenance: "derived",
        source,
        face_id: faceId,
      });
    }
  }
}

const spec = {
  meta: {
    project_id: projectId,
    generated_by: "scripts/derive-scaffold.mjs",
    system_id: scaffoldConfig.system_id,
  },
  units: { length: "m" },
  phases: ["lifts"],
  key_dimensions: keyDimensions,
  provenance_colors: buildingSpec.provenance_colors,
  components,
};

const outDir = join(ROOT, "artifacts/projects", projectId);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "scaffold-spec.json"), JSON.stringify(spec, null, 2));
console.log(
  `derive-scaffold: ${components.length} components → artifacts/projects/${projectId}/scaffold-spec.json`,
);
