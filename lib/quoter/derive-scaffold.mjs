import { createComp } from "./comp.mjs";
import { PROVENANCE_COLORS } from "./constants.mjs";
import { r2 } from "./derive-building.mjs";

const TUBE_R = 0.02415;

function divideBays(widthM, maxBay, minBay) {
  const n = Math.max(1, Math.ceil(widthM / maxBay));
  const equal = r2(widthM / n);
  if (equal <= maxBay && (equal >= minBay || n === 1)) {
    return Array(n).fill(equal);
  }
  const bays = [];
  let remaining = widthM;
  while (remaining > 0.01) {
    if (remaining <= maxBay) {
      bays.push(r2(remaining));
      remaining = 0;
    } else {
      bays.push(maxBay);
      remaining = r2(remaining - maxBay);
    }
  }
  if (bays.length > 1 && bays[bays.length - 1] < minBay) {
    const rem = bays.pop();
    bays[bays.length - 1] = r2(bays[bays.length - 1] - (minBay - rem));
    bays.push(minBay);
  }
  return bays.length ? bays : [Math.min(widthM, maxBay)];
}

function moduleTypeForBay(widthM, maxBay, minBay, preset) {
  if (widthM < minBay) return "MOD-HOP-1.0";
  if (Math.abs(widthM - maxBay) < 0.01) return "MOD-STD-2.0x2.4";
  if (widthM >= minBay && widthM < maxBay) return "MOD-HOP-1.0";
  return "MOD-STD-2.0x2.4";
}

function expandDetailTemplate(moduleId, parentId, position, widthM, liftM, preset) {
  const detail = [];
  const w = widthM || preset.geometry.bay_width_m;
  const h = liftM || preset.geometry.lift_height_m;
  const tubes = [
    { id: `${parentId}-tube-1`, x: -w / 2, z: 0 },
    { id: `${parentId}-tube-2`, x: w / 2, z: 0 },
    { id: `${parentId}-tube-3`, x: -w / 2, z: 0.87 },
    { id: `${parentId}-tube-4`, x: w / 2, z: 0.87 },
  ];
  for (const t of tubes) {
    detail.push({
      id: t.id,
      parent_module: parentId,
      geometry: { type: "cylinder", r: TUBE_R, h },
      position: [position[0] + t.x, position[1], position[2] + t.z],
      material: "steel",
      provenance: "rule_derived",
      source: `detail_template:${preset.modules[moduleId]?.detail_template || "standard"}`,
      render_only: true,
    });
  }
  detail.push({
    id: `${parentId}-ledger`,
    parent_module: parentId,
    geometry: { type: "cylinder", r: TUBE_R * 0.8, h: w },
    position: [position[0], position[1] + h - 0.1, position[2] + 0.435],
    rotation_deg: [0, 0, Math.PI / 2],
    material: "steel",
    provenance: "rule_derived",
    source: `detail_template:${preset.modules[moduleId]?.detail_template || "standard"}`,
    render_only: true,
  });
  detail.push({
    id: `${parentId}-board`,
    parent_module: parentId,
    geometry: { type: "box", w, h: 0.05, d: 0.87 },
    position: [position[0], position[1] + h - 0.05, position[2] + 0.435],
    material: "board",
    provenance: "rule_derived",
    source: `detail_template:${preset.modules[moduleId]?.detail_template || "standard"}`,
    render_only: true,
  });
  return detail;
}

function getFaceMeta(buildingSpec, faceId) {
  return buildingSpec.components.find((c) => c.id === `face-${faceId}`);
}

function scaffoldPosition(faceMeta, standoff, bayOffset, liftY) {
  const b = ((faceMeta.bearing_deg || 0) * Math.PI) / 180;
  const nx = Math.sin(b);
  const nz = Math.cos(b);
  const px = faceMeta.position[0] + nx * standoff;
  const pz = faceMeta.position[2] + nz * standoff;
  const along = bayOffset - faceMeta.width_m / 2;
  return [r2(px + Math.cos(b) * along), r2(liftY), r2(pz - Math.sin(b) * along)];
}

export function deriveScaffold(buildingSpec, config, preset) {
  const modules = [];
  const components = [];
  const comp = createComp(components);
  const warnings = [];
  const maxBay = preset.geometry.max_bay_length_m;
  const minBay = preset.geometry.min_bay_length_m;
  const liftH = preset.geometry.lift_height_m;
  const standoff = config.standoff_m ?? preset.geometry.standoff_default_m;
  const extra = config.working_lift_extra_m ?? 2.0;

  for (const faceId of config.selected_faces) {
    const faceMeta = getFaceMeta(buildingSpec, faceId);
    if (!faceMeta) {
      warnings.push({ face_id: faceId, message: `Face ${faceId} not found in building spec` });
      continue;
    }

    const height = faceMeta.height_m + extra;
    const liftCount = Math.ceil(height / liftH);
    let bayWidths = divideBays(faceMeta.width_m, maxBay, minBay);

    for (const ov of config.overrides || []) {
      if (ov.face_id !== faceId) continue;
      if (ov.action === "set_width" && ov.bay_index != null) {
        bayWidths[ov.bay_index] = ov.width_m;
      }
    }

    let bayX = 0;
    for (let bi = 0; bi < bayWidths.length; bi++) {
      let moduleId = moduleTypeForBay(bayWidths[bi], maxBay, minBay, preset);
      for (const ov of config.overrides || []) {
        if (ov.face_id === faceId && ov.bay_index === bi && ov.action === "replace") {
          moduleId = ov.module;
        }
      }
      if (
        config.auto_wrap?.enabled &&
        config.auto_wrap.access_bay_every_n > 0 &&
        bi > 0 &&
        (bi + 1) % config.auto_wrap.access_bay_every_n === 0 &&
        moduleId === "MOD-STD-2.0x2.4"
      ) {
        moduleId = "MOD-ACC-2.0x2.4";
      }

      for (let li = 0; li < liftCount; li++) {
        const skip = (config.overrides || []).some(
          (ov) => ov.face_id === faceId && ov.lift_index === li && ov.action === "remove"
        );
        if (skip) continue;

        const modDef = preset.modules[moduleId];
        const id = `${faceId}-L${li}-B${bi}`;
        const pos = scaffoldPosition(faceMeta, standoff, bayX + bayWidths[bi] / 2, li * liftH + liftH / 2);
        const stockCode = preset.stock_codes[moduleId];

        modules.push({
          id,
          module_id: moduleId,
          stock_code: stockCode,
          description: modDef?.description || moduleId,
          face_id: faceId,
          lift_index: li,
          bay_index: bi,
          width_m: bayWidths[bi],
          lift_m: liftH,
          position: pos,
          rotation_deg: faceMeta.rotation_deg || [0, ((faceMeta.bearing_deg || 0) * Math.PI) / 180, 0],
          provenance: "rule_derived",
          source: "auto_wrap",
          rule: "bay_division",
        });

        expandDetailTemplate(moduleId, id, pos, bayWidths[bi], liftH, preset).forEach((d) => comp(d));
      }
      bayX += bayWidths[bi];
    }

    const tieVert = preset.rules.tie_spacing_vertical_m;
    for (let ty = tieVert; ty < height; ty += tieVert) {
      const tieId = `${faceId}-tie-${Math.round(ty)}`;
      modules.push({
        id: tieId,
        module_id: "MOD-TIE-KIT",
        stock_code: preset.stock_codes["MOD-TIE-KIT"],
        description: preset.modules["MOD-TIE-KIT"].description,
        face_id: faceId,
        provenance: "rule_derived",
        source: "tie_spacing",
        rule: "tie_spacing_vertical",
      });
    }

    modules.push({
      id: `${faceId}-guardrail-top`,
      module_id: "MOD-GRD-LIFT",
      stock_code: preset.stock_codes["MOD-GRD-LIFT"],
      description: preset.modules["MOD-GRD-LIFT"].description,
      face_id: faceId,
      lift_index: liftCount - 1,
      provenance: "rule_derived",
      source: "guardrail_rule",
      rule: "guardrail_required",
    });
  }

  if (config.auto_wrap?.corner_modules) {
    const corners = new Set(config.selected_faces);
    if (corners.has("north") && corners.has("east")) {
      modules.push({
        id: "corner-ne",
        module_id: "MOD-CRN-2.0",
        stock_code: preset.stock_codes["MOD-CRN-2.0"],
        description: preset.modules["MOD-CRN-2.0"].description,
        face_id: "corner",
        provenance: "rule_derived",
        source: "corner_wrap",
        rule: "corner_module",
      });
    }
  }

  return {
    meta: {
      project_id: buildingSpec.meta.project_id,
      system_id: config.system_id,
      generated_by: "derive-scaffold.mjs",
    },
    provenance_colors: PROVENANCE_COLORS,
    modules,
    components,
    warnings,
  };
}

export { divideBays };
