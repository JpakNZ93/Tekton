#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];
const r2 = (n) => Math.round(n * 100) / 100;

const scaffoldSpec = JSON.parse(
  readFileSync(join(ROOT, "artifacts/projects", projectId, "scaffold-spec.json"), "utf8"),
);
const scaffoldConfig = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "scaffold-config.json"), "utf8"),
);
const canonical = JSON.parse(
  readFileSync(join(ROOT, "data/projects", projectId, "building-canonical.json"), "utf8"),
);
const priceList = JSON.parse(readFileSync(join(ROOT, "data/price-list.json"), "utf8"));

const billable = scaffoldSpec.components.filter(
  (c) => c.stock_code && c.category !== "access",
);

const groups = new Map();
for (const comp of billable) {
  if (!groups.has(comp.stock_code)) {
    groups.set(comp.stock_code, []);
  }
  groups.get(comp.stock_code).push(comp);
}

const bom = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([stockCode, comps]) => {
    const item = priceList.items[stockCode];
    const qty = comps.length;
    const unitCost = item?.unit_cost ?? 0;
    return {
      stock_code: stockCode,
      description: item?.description ?? stockCode,
      qty,
      unit: item?.unit ?? "each",
      unit_cost: unitCost,
      line_total: r2(qty * unitCost),
      derivation: `scaffold-spec:${comps[0].category}-*`,
      component_ids: comps.map((c) => c.id).sort(),
    };
  });

const materials = r2(bom.reduce((sum, line) => sum + line.line_total, 0));

let liftCountTotal = 0;
for (const faceId of scaffoldConfig.selected_faces) {
  const liftKey = `${faceId}_lift_count`;
  liftCountTotal += scaffoldSpec.key_dimensions[liftKey] ?? 0;
}

const { erect_rate_per_day, dismantle_factor, crew_size, lifts_per_day } = priceList.labor;
const erectDays = r2((liftCountTotal * 0.5) / lifts_per_day);
const erectTotal = r2(erectDays * crew_size * erect_rate_per_day);
const dismantleTotal = r2(erectTotal * dismantle_factor);

const labor = [
  {
    task: "erect",
    crew: crew_size,
    days: erectDays,
    rate_per_day: erect_rate_per_day,
    total: erectTotal,
    rule: `${liftCountTotal} lifts × 0.5 / ${lifts_per_day} lifts/day × ${crew_size} crew @ £${erect_rate_per_day}/day`,
  },
  {
    task: "dismantle",
    crew: crew_size,
    days: r2(erectDays * dismantle_factor),
    rate_per_day: erect_rate_per_day,
    total: dismantleTotal,
    rule: `Erect labor × ${dismantle_factor} dismantle factor`,
  },
];

const laborTotal = r2(erectTotal + dismantleTotal);

const hireWeeks = priceList.hire.default_weeks ?? 8;
const hireRate = priceList.hire.rate_per_week;
const hireTotal = r2(hireWeeks * hireRate);

const subtotal = r2(materials + laborTotal + hireTotal);
const delivery = priceList.charges.delivery_flat;
const marginPct = priceList.charges.default_margin_pct;
const marginAmount = r2(subtotal * (marginPct / 100));

const charges = [
  { type: "delivery", amount: delivery },
  { type: "margin", percent: marginPct, applied_to: "subtotal", amount: marginAmount },
];

const chargesTotal = r2(delivery + marginAmount);
const grandTotal = r2(subtotal + chargesTotal);

let surveyedArea = 0;
let derivedArea = 0;
let assumedArea = 0;
let totalArea = 0;

for (const faceId of scaffoldConfig.selected_faces) {
  const face = canonical.envelope.faces.find((f) => f.id === faceId);
  if (!face) continue;
  const area = face.width_m * face.height_m;
  totalArea += area;
  if (face.provenance === "surveyed") surveyedArea += area;
  else if (face.provenance === "derived") derivedArea += area;
  else if (face.provenance === "assumed") assumedArea += area;
}

const confidence = {
  surveyed_pct: totalArea ? r2((surveyedArea / totalArea) * 100) : 0,
  derived_pct: totalArea ? r2((derivedArea / totalArea) * 100) : 0,
  assumed_pct: totalArea ? r2((assumedArea / totalArea) * 100) : 0,
};

const assumptions = [];
for (const face of canonical.envelope.faces) {
  if (face.provenance === "assumed") {
    assumptions.push(
      `${face.id} elevation (${face.width_m}×${face.height_m} m) assumed — source: ${face.source}`,
    );
  }
}
if (assumptions.length === 0) {
  assumptions.push("All scaffolded faces surveyed from manual dimensions.");
}
assumptions.push(
  `Labor: ${liftCountTotal} total lifts × 0.5 factor / ${lifts_per_day} lifts per day (MVP simplified formula).`,
);
assumptions.push(`Hire duration assumed at ${hireWeeks} weeks unless revised.`);

const quote = {
  project_id: projectId,
  generated_at: new Date().toISOString(),
  scaffold_system: scaffoldConfig.system_id,
  bom,
  labor,
  hire: { weeks: hireWeeks, rate_per_week: hireRate, total: hireTotal },
  charges,
  totals: {
    materials,
    labor: laborTotal,
    hire: hireTotal,
    charges: chargesTotal,
    grand_total: grandTotal,
  },
  confidence,
  assumptions,
  verifier_passed: false,
};

const outDir = join(ROOT, "artifacts/projects", projectId);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "quote.json"), JSON.stringify(quote, null, 2));
console.log(`quote: £${grandTotal} grand total → artifacts/projects/${projectId}/quote.json`);
