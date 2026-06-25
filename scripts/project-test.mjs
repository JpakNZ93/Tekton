import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createComp } from "../lib/quoter/comp.mjs";
import { deriveBuilding } from "../lib/quoter/derive-building.mjs";
import { deriveScaffold } from "../lib/quoter/derive-scaffold.mjs";
import { verifyScaffold } from "../lib/quoter/verify-scaffold.mjs";
import { buildQuote } from "../lib/quoter/quote.mjs";
import { runProjectPipeline } from "../lib/quoter/pipeline.mjs";
import { applyCsvToCanonical } from "../lib/quoter/csv-ingest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = JSON.parse(
  readFileSync(join(ROOT, "data/projects/demo-warehouse/building-canonical.json"), "utf8")
);
const config = JSON.parse(
  readFileSync(join(ROOT, "data/projects/demo-warehouse/scaffold-config.json"), "utf8")
);
const preset = JSON.parse(
  readFileSync(join(ROOT, "data/scaffold-systems/aus-modular-2.0x2.4.json"), "utf8")
);
const priceList = JSON.parse(readFileSync(join(ROOT, "data/price-list.json"), "utf8"));

test("comp throws on missing provenance", () => {
  const comp = createComp([]);
  assert.throws(() => comp({ id: "x", provenance: "", source: "manual" }));
});

test("deriveBuilding emits footprint and 4 faces", () => {
  const spec = deriveBuilding(canonical);
  assert.ok(spec.components.find((c) => c.id === "footprint-slab"));
  assert.equal(spec.components.filter((c) => c.id.startsWith("face-")).length, 4);
});

test("deriveScaffold emits modules for selected faces", () => {
  const buildingSpec = deriveBuilding(canonical);
  const scaffold = deriveScaffold(buildingSpec, config, preset);
  assert.ok(scaffold.modules.length > 0);
  assert.ok(scaffold.modules.every((m) => m.stock_code || m.module_id === "MOD-TIE-KIT"));
  assert.ok(scaffold.components.some((c) => c.render_only === true));
});

test("verifyScaffold passes demo-warehouse", () => {
  const { scaffoldSpec, report } = runProjectPipeline(canonical, config, preset, priceList);
  assert.ok(scaffoldSpec.modules.length > 0);
  assert.equal(report.passed, true);
});

test("buildQuote has positive grand total", () => {
  const { quote, scaffoldSpec } = runProjectPipeline(canonical, config, preset, priceList);
  assert.ok(quote.totals.grand_total > 0);
  assert.ok(quote.bom.length > 0);
  assert.ok(quote.assumptions.length > 0);
});

test("csv ingest patches canonical faces", () => {
  const csv = readFileSync(
    join(ROOT, "data/projects/demo-warehouse/uploads/dimensions.csv"),
    "utf8"
  );
  const { canonical: patched, error } = applyCsvToCanonical(canonical, csv);
  assert.equal(error, null);
  assert.ok(patched.envelope.faces.find((f) => f.id === "north"));
});
