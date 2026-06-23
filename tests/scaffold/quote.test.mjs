import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("quote.mjs produces BOM matching scaffold stock codes", () => {
  spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  spawnSync("node", ["scripts/derive-scaffold.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  const r = spawnSync("node", ["scripts/quote.mjs", "--project", "demo-warehouse"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const quote = JSON.parse(
    readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/quote.json"), "utf8"),
  );
  assert.ok(quote.bom.length > 0);
  assert.ok(quote.totals.grand_total > 0);
  assert.ok(quote.bom[0].component_ids.length > 0);
});
