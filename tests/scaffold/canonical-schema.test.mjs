import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("demo-warehouse canonical passes schema", async () => {
  const { parseBuildingCanonical } = await import("../../lib/schemas/validate-canonical.mjs");
  const raw = JSON.parse(
    await readFile(join(process.cwd(), "data/projects/demo-warehouse/building-canonical.json"), "utf8"),
  );
  const parsed = parseBuildingCanonical(raw);
  assert.equal(parsed.meta.project_id, "demo-warehouse");
  assert.equal(parsed.envelope.faces.length, 4);
});

test("rejects face without provenance", async () => {
  const { parseBuildingCanonical } = await import("../../lib/schemas/validate-canonical.mjs");
  const bad = {
    meta: {
      project_id: "x",
      site_name: "Test",
      address: "1 Rd",
      created_at: "2026-06-23T00:00:00.000Z",
    },
    units: { length: "m" },
    envelope: {
      footprint: {
        type: "rectangle",
        width_m: 10,
        depth_m: 8,
        provenance: "assumed",
        source: "default",
      },
      faces: [
        {
          id: "north",
          bearing_deg: 0,
          width_m: 10,
          height_m: 8,
          source: "manual",
          confidence: 1,
        },
      ],
    },
    constraints: { public_footpath_m: 1.2, no_scaffold_zones: [], access_notes: "" },
    inputs: [],
  };
  assert.throws(() => parseBuildingCanonical(bad));
});

test("writeCanonical validates before write", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmpRoot = mkdtempSync(join(tmpdir(), "scaffold-schema-"));
  process.env.SCAFFOLD_DATA_ROOT = tmpRoot;
  try {
    const { createProject, writeCanonical, readCanonical } = await import("../../lib/project-store.mjs");
    const id = await createProject({ site_name: "Schema Test", address: "2 Test Rd" });
    const canonical = await readCanonical(id);
    await writeCanonical(id, canonical);

    await assert.rejects(
      () =>
        writeCanonical(id, {
          ...canonical,
          envelope: {
            ...canonical.envelope,
            faces: [{ id: "bad", bearing_deg: 0, width_m: 5, height_m: 5, source: "x", confidence: 1 }],
          },
        }),
    );
  } finally {
    delete process.env.SCAFFOLD_DATA_ROOT;
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("demo-warehouse scaffold-config passes schema", async () => {
  const { parseScaffoldConfig } = await import("../../lib/schemas/validate-canonical.mjs");
  const raw = JSON.parse(
    await readFile(join(process.cwd(), "data/projects/demo-warehouse/scaffold-config.json"), "utf8"),
  );
  const parsed = parseScaffoldConfig(raw);
  assert.deepEqual(parsed.selected_faces, ["north", "east"]);
});
