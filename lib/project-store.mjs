import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.env.SCAFFOLD_DATA_ROOT ?? process.cwd();
const dataDir = (id) => join(ROOT, "data/projects", id);
const artDir = (id) => join(ROOT, "artifacts/projects", id);

/**
 * @param {{ site_name: string; address: string }} input
 * @returns {Promise<string>}
 */
export async function createProject(input) {
  const id = randomUUID().slice(0, 8);
  await mkdir(join(dataDir(id), "uploads"), { recursive: true });
  await mkdir(artDir(id), { recursive: true });
  const now = new Date().toISOString();
  const meta = {
    id,
    site_name: input.site_name,
    address: input.address,
    status: "draft",
    scaffold_system_id: "standard-tube-2.4",
    created_at: now,
    updated_at: now,
  };
  await writeFile(join(dataDir(id), "meta.json"), JSON.stringify(meta, null, 2));
  const canonical = {
    meta: {
      project_id: id,
      site_name: input.site_name,
      address: input.address,
      created_at: now,
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
      faces: [],
    },
    constraints: {
      public_footpath_m: 1.2,
      no_scaffold_zones: [],
      access_notes: "",
    },
    inputs: [{ type: "manual", rights: "client_provided", extracted_fields: [] }],
  };
  await writeFile(
    join(dataDir(id), "building-canonical.json"),
    JSON.stringify(canonical, null, 2),
  );
  return id;
}

/** @param {string} id */
export async function readMeta(id) {
  return JSON.parse(await readFile(join(dataDir(id), "meta.json"), "utf8"));
}

/** @param {string} id */
export async function readCanonical(id) {
  return JSON.parse(await readFile(join(dataDir(id), "building-canonical.json"), "utf8"));
}

export async function listProjects() {
  const root = join(ROOT, "data/projects");
  try {
    const ids = await readdir(root);
    return Promise.all(ids.map((id) => readMeta(id)));
  } catch {
    return [];
  }
}
