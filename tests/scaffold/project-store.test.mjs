import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpRoot;
before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "scaffold-"));
  process.env.SCAFFOLD_DATA_ROOT = tmpRoot;
});
after(() => {
  delete process.env.SCAFFOLD_DATA_ROOT;
  rmSync(tmpRoot, { recursive: true, force: true });
});

test("createProject writes meta and canonical", async () => {
  const { createProject, readMeta, readCanonical } = await import("../../lib/project-store.mjs");
  const id = await createProject({ site_name: "Test Site", address: "1 Test Rd" });
  const meta = await readMeta(id);
  assert.equal(meta.site_name, "Test Site");
  assert.equal(meta.status, "draft");
  const canonical = await readCanonical(id);
  assert.equal(canonical.meta.project_id, id);
});
