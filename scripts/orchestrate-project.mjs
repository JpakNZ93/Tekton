#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runProjectPipeline } from "../lib/quoter/pipeline.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[2] || "demo-warehouse";

const projectDir = join(ROOT, "data/projects", projectId);
const artifactsDir = join(ROOT, "artifacts/projects", projectId);
const publicDir = join(ROOT, "public/projects", projectId);

const canonical = JSON.parse(readFileSync(join(projectDir, "building-canonical.json"), "utf8"));
const config = JSON.parse(readFileSync(join(projectDir, "scaffold-config.json"), "utf8"));
const preset = JSON.parse(readFileSync(join(ROOT, "data/scaffold-systems/aus-modular-2.0x2.4.json"), "utf8"));
const priceList = JSON.parse(readFileSync(join(ROOT, "data/price-list.json"), "utf8"));

const { buildingSpec, scaffoldSpec, report, quote } = runProjectPipeline(canonical, config, preset, priceList);

mkdirSync(artifactsDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

writeFileSync(join(artifactsDir, "building-spec.json"), JSON.stringify(buildingSpec, null, 2));
writeFileSync(join(artifactsDir, "scaffold-spec.json"), JSON.stringify(scaffoldSpec, null, 2));
writeFileSync(join(artifactsDir, "verifier-report.json"), JSON.stringify(report, null, 2));
writeFileSync(join(artifactsDir, "quote.json"), JSON.stringify(quote, null, 2));

for (const name of ["building-spec.json", "scaffold-spec.json", "verifier-report.json", "quote.json"]) {
  cpSync(join(artifactsDir, name), join(publicDir, name));
}

const publicDataDir = join(ROOT, "public/data");
mkdirSync(join(publicDataDir, "projects", projectId), { recursive: true });
mkdirSync(join(publicDataDir, "scaffold-systems"), { recursive: true });
cpSync(join(projectDir, "building-canonical.json"), join(publicDataDir, "projects", projectId, "building-canonical.json"));
cpSync(join(projectDir, "scaffold-config.json"), join(publicDataDir, "projects", projectId, "scaffold-config.json"));
cpSync(join(ROOT, "data/scaffold-systems/aus-modular-2.0x2.4.json"), join(publicDataDir, "scaffold-systems/aus-modular-2.0x2.4.json"));
cpSync(join(ROOT, "data/price-list.json"), join(publicDataDir, "price-list.json"));

console.log(`Project ${projectId}: ${report.passed ? "PASS" : "FAIL"} — ${scaffoldSpec.modules.length} modules, quote $${quote.totals.grand_total}`);
if (!report.passed) {
  process.exitCode = 1;
  for (const c of report.checks.filter((x) => !x.pass && x.severity === "blocking")) {
    console.error(`  FAIL ${c.id}: ${c.name}`);
  }
}
