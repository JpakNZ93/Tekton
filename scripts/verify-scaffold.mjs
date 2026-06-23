#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];

const artDir = join(ROOT, "artifacts/projects", projectId);
const scaffoldSpec = JSON.parse(readFileSync(join(artDir, "scaffold-spec.json"), "utf8"));
const scaffoldConfig = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "scaffold-config.json"), "utf8"),
);
const canonical = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "building-canonical.json"), "utf8"),
);
const system = JSON.parse(
  readFileSync(join(ROOT, "data/scaffold-systems", `${scaffoldConfig.system_id}.json`), "utf8"),
);

const quotePath = join(artDir, "quote.json");
const quote = existsSync(quotePath) ? JSON.parse(readFileSync(quotePath, "utf8")) : null;

const tieInterval = system.rules.tie_spacing_vertical_lifts;
const checks = [];

function addCheck(id, severity, passed, message) {
  checks.push({ id, severity, passed, message });
}

for (const faceId of scaffoldConfig.selected_faces) {
  const faceComps = scaffoldSpec.components.filter((c) => c.face_id === faceId);
  addCheck(
    "S01",
    "critical",
    faceComps.length > 0,
    faceComps.length > 0
      ? `${faceId}: ${faceComps.length} scaffold components`
      : `${faceId}: no scaffold components for selected face`,
  );
}

for (const faceId of scaffoldConfig.selected_faces) {
  const liftCount = scaffoldSpec.key_dimensions[`${faceId}_lift_count`] ?? 0;
  for (let lift = 0; lift < liftCount; lift++) {
    const guardrails = scaffoldSpec.components.filter(
      (c) => c.face_id === faceId && c.category === "guardrail" && c.lift_index === lift,
    );
    addCheck(
      "S02",
      "critical",
      guardrails.length > 0,
      guardrails.length > 0
        ? `${faceId} lift ${lift}: guardrail present`
        : `${faceId} lift ${lift}: missing guardrail`,
    );
  }
}

for (const faceId of scaffoldConfig.selected_faces) {
  const liftCount = scaffoldSpec.key_dimensions[`${faceId}_lift_count`] ?? 0;
  const bayCount = scaffoldSpec.key_dimensions[`${faceId}_bay_count`] ?? 0;
  const minTies = Math.floor(liftCount / tieInterval) * bayCount;
  const tieCount = scaffoldSpec.components.filter(
    (c) => c.face_id === faceId && c.category === "tie",
  ).length;
  addCheck(
    "S03",
    "warning",
    tieCount >= minTies,
    `${faceId}: ${tieCount} ties (minimum ${minTies})`,
  );
}

const zones = canonical.constraints.no_scaffold_zones ?? [];
let zoneViolations = 0;
if (zones.length > 0) {
  for (const comp of scaffoldSpec.components) {
    if (comp.category === "access") continue;
    for (const zone of zones) {
      if (comp.face_id !== zone.face_id) continue;
      const [cx, cy] = [comp.position[0], comp.position[1]];
      if (
        cx >= zone.x_m &&
        cx <= zone.x_m + zone.w_m &&
        cy >= zone.y_m &&
        cy <= zone.y_m + zone.h_m
      ) {
        zoneViolations += 1;
      }
    }
  }
}
addCheck(
  "S04",
  "critical",
  zoneViolations === 0,
  zoneViolations === 0
    ? "No scaffold components inside no-scaffold zones"
    : `${zoneViolations} components inside no-scaffold zones`,
);

const missingStock = scaffoldSpec.components.filter(
  (c) => c.category !== "access" && !c.stock_code,
);
addCheck(
  "S05",
  "critical",
  missingStock.length === 0,
  missingStock.length === 0
    ? "All billable scaffold components have stock_code"
    : `${missingStock.length} components missing stock_code`,
);

if (quote) {
  const specGroups = new Map();
  for (const comp of scaffoldSpec.components) {
    if (!comp.stock_code || comp.category === "access") continue;
    specGroups.set(comp.stock_code, (specGroups.get(comp.stock_code) ?? 0) + 1);
  }
  let bomMismatch = 0;
  for (const line of quote.bom) {
    const specQty = specGroups.get(line.stock_code) ?? 0;
    if (line.qty !== specQty) bomMismatch += 1;
    specGroups.delete(line.stock_code);
  }
  bomMismatch += specGroups.size;
  addCheck(
    "S06",
    "critical",
    bomMismatch === 0,
    bomMismatch === 0
      ? "BOM quantities match scaffold-spec group counts"
      : `${bomMismatch} BOM line mismatches vs scaffold-spec`,
  );
} else {
  addCheck("S06", "critical", false, "quote.json not found — run quote.mjs first");
}

for (const faceId of scaffoldConfig.selected_faces) {
  const bayCount = scaffoldSpec.key_dimensions[`${faceId}_bay_count`] ?? 0;
  if (bayCount <= 3) continue;
  const accessCount = scaffoldSpec.components.filter(
    (c) => c.face_id === faceId && c.category === "access",
  ).length;
  addCheck(
    "S07",
    "warning",
    accessCount >= 1,
    `${faceId}: ${accessCount} access markers (${bayCount} bays)`,
  );
}

const criticalFailures = checks.filter((c) => c.severity === "critical" && !c.passed).length;
const warningFailures = checks.filter((c) => c.severity === "warning" && !c.passed).length;
const passed = criticalFailures === 0;

const report = {
  project_id: projectId,
  generated_at: new Date().toISOString(),
  passed,
  critical_failures: criticalFailures,
  warning_failures: warningFailures,
  checks,
};

mkdirSync(artDir, { recursive: true });
writeFileSync(join(artDir, "verifier-report.json"), JSON.stringify(report, null, 2));

if (quote) {
  quote.verifier_passed = passed;
  writeFileSync(quotePath, JSON.stringify(quote, null, 2));
}

console.log(
  `verify-scaffold: ${passed ? "PASSED" : "FAILED"} (${criticalFailures} critical, ${warningFailures} warnings)`,
);

if (!passed) process.exit(1);
