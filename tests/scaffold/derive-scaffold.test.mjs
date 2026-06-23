import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("derive-scaffold emits tubes with stock codes for selected faces", () => {
  spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  const r = spawnSync("node", ["scripts/derive-scaffold.mjs", "--project", "demo-warehouse"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(
    readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/scaffold-spec.json"), "utf8"),
  );
  const tubes = spec.components.filter((c) => c.category === "tube");
  assert.ok(tubes.length > 0);
  assert.ok(tubes.every((t) => t.stock_code === "TUB-STD"));
  const northTubes = tubes.filter((t) => t.face_id === "north");
  assert.ok(northTubes.length > 0);
});
