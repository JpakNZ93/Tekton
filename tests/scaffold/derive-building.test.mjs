import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("derive-building emits 4 faces for demo-warehouse", () => {
  const r = spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(
    readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/building-spec.json"), "utf8"),
  );
  const faces = spec.components.filter((c) => c.category === "building-face");
  assert.equal(faces.length, 4);
  assert.ok(faces.some((f) => f.id === "face-north"));
});
