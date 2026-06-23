import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("verify-scaffold passes demo-warehouse", () => {
  spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  spawnSync("node", ["scripts/derive-scaffold.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  spawnSync("node", ["scripts/quote.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  const r = spawnSync("node", ["scripts/verify-scaffold.mjs", "--project", "demo-warehouse"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const report = JSON.parse(
    readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/verifier-report.json"), "utf8"),
  );
  assert.equal(report.passed, true);
});
