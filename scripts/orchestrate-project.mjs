#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];

if (!projectId) {
  console.error("Usage: node scripts/orchestrate-project.mjs --project <id>");
  process.exit(1);
}

const steps = [
  ["derive-building.mjs", "DERIVE BUILDING"],
  ["derive-scaffold.mjs", "DERIVE SCAFFOLD"],
  ["quote.mjs", "QUOTE"],
  ["verify-scaffold.mjs", "VERIFY"],
];

for (const [script, label] of steps) {
  console.log(`\n══ ${label} ══`);
  const r = spawnSync("node", [`scripts/${script}`, "--project", projectId], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("\n✓ Pipeline complete");
