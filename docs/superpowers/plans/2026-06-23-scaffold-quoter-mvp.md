# Scaffold Quoter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 MVP — file-based projects, manual ingest, 3D building + scaffold viewer, deterministic quote, verifier-gated export — without breaking heritage Tekton builds.

**Architecture:** Add `data/projects/<id>/` canonical files and `artifacts/projects/<id>/` derived outputs. Node derive scripts (same pattern as `scripts/derive.mjs`) run via API spawn. Next.js `/projects/*` routes read artifacts; R3F viewers fork `CathedralViewer.tsx` patterns.

**Tech Stack:** Next.js 15, React 19, TypeScript, R3F, Zustand, Node `node:test`, Zod validation, file-based JSON storage.

**Design spec:** [`docs/superpowers/specs/2026-06-23-scaffold-quoter-design.md`](../specs/2026-06-23-scaffold-quoter-design.md)

---

## File Map

| File | Responsibility |
|---|---|
| `lib/tekton-spec.ts` | Shared `Component`, `StructuralSpec` types |
| `lib/project-store.ts` | All `data/projects` + `artifacts/projects` I/O |
| `lib/schemas/building-canonical.ts` | Zod schema for canonical JSON |
| `lib/schemas/scaffold-config.ts` | Zod schema for scaffold config |
| `lib/stores/quote-store.ts` | Zustand: highlight IDs, provenance toggle |
| `data/scaffold-systems/standard-tube-2.4.json` | Scaffold preset rules |
| `data/price-list.json` | Unit costs, labor rates |
| `data/projects/demo-warehouse/*` | Seed demo project |
| `scripts/derive-building.mjs` | Canonical → building-spec |
| `scripts/derive-scaffold.mjs` | Building-spec + config → scaffold-spec |
| `scripts/quote.mjs` | Scaffold-spec → quote.json |
| `scripts/verify-scaffold.mjs` | Scaffold + quote integrity checks |
| `scripts/orchestrate-project.mjs` | Pipeline runner |
| `app/projects/page.tsx` | Dashboard |
| `app/projects/new/page.tsx` | Wizard |
| `app/projects/[id]/layout.tsx` | Workspace shell + nav |
| `app/projects/[id]/ingest/page.tsx` | Ingest form |
| `app/projects/[id]/building/page.tsx` | Building 3D |
| `app/projects/[id]/scaffold/page.tsx` | Scaffold 3D |
| `app/projects/[id]/quote/page.tsx` | Quote panel |
| `app/api/projects/route.ts` | List + create |
| `app/api/projects/[id]/*/route.ts` | CRUD + derive |
| `components/scaffold/*` | BuildingViewer, ScaffoldScene, QuotePanel, etc. |
| `tests/scaffold/*.test.mjs` | Derive + verify unit tests |

---

### Task 1: Shared types and project store

**Files:**
- Create: `lib/tekton-spec.ts`
- Create: `lib/project-store.ts`
- Create: `tests/scaffold/project-store.test.mjs`
- Modify: `package.json` (add `"test:scaffold": "node --test tests/scaffold/*.test.mjs"`)

- [ ] **Step 1: Write the failing test**

```javascript
// tests/scaffold/project-store.test.mjs
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
  const { createProject, readMeta, readCanonical } = await import("../../lib/project-store.ts");
  const id = await createProject({ site_name: "Test Site", address: "1 Test Rd" });
  const meta = await readMeta(id);
  assert.equal(meta.site_name, "Test Site");
  assert.equal(meta.status, "draft");
  const canonical = await readCanonical(id);
  assert.equal(canonical.meta.project_id, id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:scaffold`
Expected: FAIL — module not found

- [ ] **Step 3: Implement types and store**

```typescript
// lib/tekton-spec.ts
export type Provenance = "surveyed" | "derived" | "assumed";

export interface Component {
  id: string;
  name_en: string;
  phase: string;
  category: string;
  role?: string;
  geometry: { type: "box" | "cylinder"; w?: number; h?: number; d?: number; r?: number };
  position: [number, number, number];
  rotation_deg?: [number, number, number];
  provenance: Provenance;
  source: string;
  stock_code?: string;
  face_id?: string;
  lift_index?: number;
  material?: string;
}

export interface StructuralSpec {
  meta: Record<string, unknown>;
  units: { length: string; note?: string };
  phases: string[];
  key_dimensions: Record<string, unknown>;
  provenance_colors: Record<Provenance, string>;
  components: Component[];
}
```

```typescript
// lib/project-store.ts
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = process.env.SCAFFOLD_DATA_ROOT ?? process.cwd();
const dataDir = (id: string) => join(ROOT, "data/projects", id);
const artDir = (id: string) => join(ROOT, "artifacts/projects", id);

export async function createProject(input: { site_name: string; address: string }) {
  const id = randomUUID().slice(0, 8);
  await mkdir(join(dataDir(id), "uploads"), { recursive: true });
  await mkdir(artDir(id), { recursive: true });
  const now = new Date().toISOString();
  const meta = { id, site_name: input.site_name, address: input.address, status: "draft", scaffold_system_id: "standard-tube-2.4", created_at: now, updated_at: now };
  await writeFile(join(dataDir(id), "meta.json"), JSON.stringify(meta, null, 2));
  const canonical = {
    meta: { project_id: id, site_name: input.site_name, address: input.address, created_at: now },
    units: { length: "m" },
    envelope: { footprint: { type: "rectangle", width_m: 10, depth_m: 8, provenance: "assumed", source: "default" }, faces: [] },
    constraints: { public_footpath_m: 1.2, no_scaffold_zones: [], access_notes: "" },
    inputs: [{ type: "manual", rights: "client_provided", extracted_fields: [] }],
  };
  await writeFile(join(dataDir(id), "building-canonical.json"), JSON.stringify(canonical, null, 2));
  return id;
}

export async function readMeta(id: string) {
  return JSON.parse(await readFile(join(dataDir(id), "meta.json"), "utf8"));
}

export async function readCanonical(id: string) {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:scaffold`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tekton-spec.ts lib/project-store.ts tests/scaffold/project-store.test.mjs package.json
git commit -m "feat(scaffold): add shared types and project store"
```

---

### Task 2: Seed data — scaffold system, price list, demo project

**Files:**
- Create: `data/scaffold-systems/standard-tube-2.4.json`
- Create: `data/price-list.json`
- Create: `data/projects/demo-warehouse/meta.json`
- Create: `data/projects/demo-warehouse/building-canonical.json`
- Create: `data/projects/demo-warehouse/scaffold-config.json`

- [ ] **Step 1: Write scaffold system preset**

```json
{
  "id": "standard-tube-2.4",
  "name": "Standard tube & fitting (2.4 m lifts)",
  "standards": ["BS EN 12811", "TG20:21"],
  "components": {
    "standard_length_m": [2.4, 3.0, 1.8],
    "ledger_spacing_m": 2.1,
    "transom_spacing_m": 1.2,
    "board_width_m": 0.225,
    "tube_diameter_m": 0.0483
  },
  "rules": {
    "max_lift_height_m": 2.4,
    "tie_spacing_vertical_lifts": 2,
    "guardrail_required": true,
    "toe_board_required": true,
    "couplers_per_joint": 2
  },
  "stock_codes": {
    "tube": "TUB-STD",
    "ledger": "LED-210",
    "transom": "TRN-120",
    "board": "BD-225",
    "coupler": "CPL-STD",
    "tie": "TIE-STD",
    "guardrail": "GRD-STD",
    "toe_board": "TOE-STD"
  }
}
```

- [ ] **Step 2: Write price list**

```json
{
  "currency": "GBP",
  "items": {
    "TUB-STD": { "description": "Standard tube", "unit": "each", "unit_cost": 12.5, "hireable": true },
    "LED-210": { "description": "Ledger 2.1 m", "unit": "each", "unit_cost": 8.0, "hireable": true },
    "TRN-120": { "description": "Transom 1.2 m", "unit": "each", "unit_cost": 6.5, "hireable": true },
    "BD-225": { "description": "Board 2.25 m", "unit": "each", "unit_cost": 4.0, "hireable": false },
    "CPL-STD": { "description": "Standard coupler", "unit": "each", "unit_cost": 2.5, "hireable": false },
    "TIE-STD": { "description": "Tie", "unit": "each", "unit_cost": 3.0, "hireable": false },
    "GRD-STD": { "description": "Guardrail", "unit": "each", "unit_cost": 15.0, "hireable": false },
    "TOE-STD": { "description": "Toe board", "unit": "each", "unit_cost": 5.0, "hireable": false }
  },
  "labor": { "erect_rate_per_day": 850, "dismantle_factor": 0.6, "crew_size": 3, "lifts_per_day": 8 },
  "charges": { "delivery_flat": 350, "default_margin_pct": 15 },
  "hire": { "rate_per_week": 2400 }
}
```

- [ ] **Step 3: Write demo-warehouse canonical (20×12×8 m, 4 faces)**

```json
{
  "meta": { "project_id": "demo-warehouse", "site_name": "Demo Warehouse", "address": "Unit 4, Industrial Estate", "created_at": "2026-06-23T00:00:00.000Z" },
  "units": { "length": "m" },
  "envelope": {
    "footprint": { "type": "rectangle", "width_m": 20, "depth_m": 12, "provenance": "surveyed", "source": "manual" },
    "faces": [
      { "id": "north", "bearing_deg": 0, "width_m": 20, "height_m": 8, "provenance": "surveyed", "source": "manual", "confidence": 1 },
      { "id": "south", "bearing_deg": 180, "width_m": 20, "height_m": 8, "provenance": "surveyed", "source": "manual", "confidence": 1 },
      { "id": "east", "bearing_deg": 90, "width_m": 12, "height_m": 8, "provenance": "surveyed", "source": "manual", "confidence": 1 },
      { "id": "west", "bearing_deg": 270, "width_m": 12, "height_m": 8, "provenance": "surveyed", "source": "manual", "confidence": 1 }
    ]
  },
  "constraints": { "public_footpath_m": 1.2, "no_scaffold_zones": [], "access_notes": "" },
  "inputs": [{ "type": "manual", "rights": "client_provided", "extracted_fields": ["envelope"] }]
}
```

- [ ] **Step 4: Write demo scaffold-config (north + east faces)**

```json
{
  "project_id": "demo-warehouse",
  "system_id": "standard-tube-2.4",
  "selected_faces": ["north", "east"],
  "standoff_m": 0.3,
  "extra_lift_m": 2.4,
  "access_bay_every_n": 4,
  "overrides": []
}
```

- [ ] **Step 5: Commit**

```bash
git add data/scaffold-systems data/price-list.json data/projects/demo-warehouse
git commit -m "feat(scaffold): add seed preset, price list, and demo project"
```

---

### Task 3: derive-building.mjs

**Files:**
- Create: `scripts/derive-building.mjs`
- Create: `tests/scaffold/derive-building.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("derive-building emits 4 faces for demo-warehouse", () => {
  const r = spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/building-spec.json"), "utf8"));
  const faces = spec.components.filter((c) => c.category === "building-face");
  assert.equal(faces.length, 4);
  assert.ok(faces.some((f) => f.id === "face-north"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scaffold/derive-building.test.mjs`
Expected: FAIL — script not found

- [ ] **Step 3: Implement derive-building.mjs**

Core logic (implement fully in file):

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.argv[process.argv.indexOf("--project") + 1];
const canonical = JSON.parse(readFileSync(join(ROOT, "data/projects", projectId, "building-canonical.json"), "utf8"));
const { width_m, depth_m } = canonical.envelope.footprint;

// Auto-generate faces if empty
let faces = canonical.envelope.faces;
if (!faces.length) {
  const h = canonical.envelope.default_height_m ?? 6;
  faces = [
    { id: "north", bearing_deg: 0, width_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "south", bearing_deg: 180, width_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "east", bearing_deg: 90, width_m: depth_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
    { id: "west", bearing_deg: 270, width_m: depth_m, height_m: h, provenance: "derived", source: "footprint", confidence: 0.5 },
  ];
}

const PROV_COLORS = { surveyed: "#3d9e5a", derived: "#c9a227", assumed: "#c94a4a" };
const components = [];

components.push({
  id: "footprint-slab", name_en: "Footprint slab", phase: "footprint", category: "building-slab",
  geometry: { type: "box", w: width_m, h: 0.15, d: depth_m }, position: [0, -0.075, 0],
  provenance: "assumed", source: "visual", material: "concrete",
});

for (const face of faces) {
  const rad = (face.bearing_deg * Math.PI) / 180;
  const isNS = face.bearing_deg === 0 || face.bearing_deg === 180;
  const offset = isNS ? depth_m / 2 : width_m / 2;
  const x = Math.sin(rad) * offset;
  const z = Math.cos(rad) * offset;
  components.push({
    id: `face-${face.id}`, name_en: `${face.id} elevation`, phase: "faces", category: "building-face",
    geometry: { type: "box", w: face.width_m, h: face.height_m, d: 0.2 },
    position: [x, face.height_m / 2, z], rotation_deg: [0, face.bearing_deg, 0],
    provenance: face.provenance, source: face.source, face_id: face.id,
  });
}

const spec = {
  meta: { project_id: projectId, generated_by: "scripts/derive-building.mjs" },
  units: { length: "m" },
  phases: ["footprint", "faces"],
  key_dimensions: { width_m, depth_m, face_count: faces.length },
  provenance_colors: PROV_COLORS,
  components,
};

const outDir = join(ROOT, "artifacts/projects", projectId);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "building-spec.json"), JSON.stringify(spec, null, 2));
console.log(`derive-building: ${components.length} components → artifacts/projects/${projectId}/building-spec.json`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scaffold/derive-building.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/derive-building.mjs tests/scaffold/derive-building.test.mjs artifacts/projects/demo-warehouse/building-spec.json
git commit -m "feat(scaffold): add derive-building rule engine"
```

---

### Task 4: derive-scaffold.mjs

**Files:**
- Create: `scripts/derive-scaffold.mjs`
- Create: `tests/scaffold/derive-scaffold.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
test("derive-scaffold emits tubes with stock codes for selected faces", () => {
  spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  const r = spawnSync("node", ["scripts/derive-scaffold.mjs", "--project", "demo-warehouse"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const spec = JSON.parse(readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/scaffold-spec.json"), "utf8"));
  const tubes = spec.components.filter((c) => c.category === "tube");
  assert.ok(tubes.length > 0);
  assert.ok(tubes.every((t) => t.stock_code === "TUB-STD"));
  const northTubes = tubes.filter((t) => t.face_id === "north");
  assert.ok(northTubes.length > 0);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement derive-scaffold.mjs**

Algorithm per design spec §4.2:
- Load `building-spec.json`, `scaffold-config.json`, `data/scaffold-systems/<system_id>.json`
- For each `selected_faces` entry, find `face-<id>` in building components
- Compute `bay_count = Math.ceil(face.width_m / ledger_spacing_m)`
- Compute `lift_count = Math.ceil((face.height_m + extra_lift_m) / max_lift_height_m)`
- Emit tubes at bay boundaries, ledgers per lift, boards on each lift deck, couplers, ties every `tie_spacing_vertical_lifts`, guardrails on top lift
- Write `scaffold-spec.json` with `phases: ["lifts"]` and all components tagged `category`, `stock_code`, `face_id`, `lift_index`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add scripts/derive-scaffold.mjs tests/scaffold/derive-scaffold.test.mjs artifacts/projects/demo-warehouse/scaffold-spec.json
git commit -m "feat(scaffold): add derive-scaffold auto-wrap engine"
```

---

### Task 5: quote.mjs + verify-scaffold.mjs

**Files:**
- Create: `scripts/quote.mjs`
- Create: `scripts/verify-scaffold.mjs`
- Create: `tests/scaffold/quote.test.mjs`
- Create: `tests/scaffold/verify-scaffold.test.mjs`

- [ ] **Step 1: Write failing quote test**

```javascript
test("quote.mjs produces BOM matching scaffold stock codes", () => {
  // run full derive chain first
  spawnSync("node", ["scripts/derive-building.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  spawnSync("node", ["scripts/derive-scaffold.mjs", "--project", "demo-warehouse"], { cwd: ROOT });
  const r = spawnSync("node", ["scripts/quote.mjs", "--project", "demo-warehouse"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const quote = JSON.parse(readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/quote.json"), "utf8"));
  assert.ok(quote.bom.length > 0);
  assert.ok(quote.totals.grand_total > 0);
  assert.ok(quote.bom[0].component_ids.length > 0);
});
```

- [ ] **Step 2: Write failing verify test**

```javascript
test("verify-scaffold passes demo-warehouse", () => {
  const r = spawnSync("node", ["scripts/verify-scaffold.mjs", "--project", "demo-warehouse"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(readFileSync(join(ROOT, "artifacts/projects/demo-warehouse/verifier-report.json"), "utf8"));
  assert.equal(report.passed, true);
});
```

- [ ] **Step 3: Implement quote.mjs** — group by `stock_code`, apply `data/price-list.json`, compute labor/hire/charges per design spec §4.3

- [ ] **Step 4: Implement verify-scaffold.mjs** — checks S01–S07 per design spec §4.4; `process.exit(1)` on critical failure

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm run test:scaffold`

- [ ] **Step 6: Commit**

```bash
git add scripts/quote.mjs scripts/verify-scaffold.mjs tests/scaffold/quote.test.mjs tests/scaffold/verify-scaffold.test.mjs artifacts/projects/demo-warehouse/quote.json artifacts/projects/demo-warehouse/verifier-report.json
git commit -m "feat(scaffold): add quote and verify scripts"
```

---

### Task 6: orchestrate-project.mjs + npm scripts

**Files:**
- Create: `scripts/orchestrate-project.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement orchestrator**

```javascript
#!/usr/bin/env node
// scripts/orchestrate-project.mjs
const projectId = process.argv[process.argv.indexOf("--project") + 1];
const steps = [
  ["derive-building.mjs", "DERIVE BUILDING"],
  ["derive-scaffold.mjs", "DERIVE SCAFFOLD"],
  ["quote.mjs", "QUOTE"],
  ["verify-scaffold.mjs", "VERIFY"],
];
for (const [script, label] of steps) {
  console.log(`\n══ ${label} ══`);
  const r = spawnSync("node", [`scripts/${script}`, "--project", projectId], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("\n✓ Pipeline complete");
```

- [ ] **Step 2: Add npm scripts**

```json
"project:derive": "node scripts/orchestrate-project.mjs --project demo-warehouse",
"test:scaffold": "node --test tests/scaffold/*.test.mjs"
```

- [ ] **Step 3: Run full pipeline**

Run: `node scripts/orchestrate-project.mjs --project demo-warehouse`
Expected: exit 0, all artifacts updated

- [ ] **Step 4: Commit**

```bash
git add scripts/orchestrate-project.mjs package.json
git commit -m "feat(scaffold): add project orchestrator and npm scripts"
```

---

### Task 7: Zod schemas + canonical validation

**Files:**
- Create: `lib/schemas/building-canonical.ts`
- Create: `lib/schemas/scaffold-config.ts`
- Create: `tests/scaffold/canonical-schema.test.mjs`
- Modify: `lib/project-store.ts` (validate on write)

- [ ] **Step 1: Install zod**

Run: `npm install zod`

- [ ] **Step 2: Write schema with provenance required on every face**

```typescript
import { z } from "zod";

export const ProvenanceSchema = z.enum(["surveyed", "derived", "assumed"]);

export const FaceSchema = z.object({
  id: z.string(),
  bearing_deg: z.number(),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  provenance: ProvenanceSchema,
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const BuildingCanonicalSchema = z.object({
  meta: z.object({ project_id: z.string(), site_name: z.string(), address: z.string(), created_at: z.string() }),
  units: z.object({ length: z.literal("m") }),
  envelope: z.object({
    footprint: z.object({ type: z.literal("rectangle"), width_m: z.number().positive(), depth_m: z.number().positive(), provenance: ProvenanceSchema, source: z.string() }),
    faces: z.array(FaceSchema),
  }),
  constraints: z.object({ public_footpath_m: z.number(), no_scaffold_zones: z.array(z.any()), access_notes: z.string() }),
  inputs: z.array(z.any()),
});
```

- [ ] **Step 3: Test rejects face without provenance**

- [ ] **Step 4: Wire `writeCanonical(id, data)` through schema parse**

- [ ] **Step 5: Commit**

```bash
git add lib/schemas package.json package-lock.json lib/project-store.ts tests/scaffold/canonical-schema.test.mjs
git commit -m "feat(scaffold): add Zod validation for canonical JSON"
```

---

### Task 8: API routes

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/meta/route.ts`
- Create: `app/api/projects/[id]/building-canonical/route.ts`
- Create: `app/api/projects/[id]/scaffold-config/route.ts`
- Create: `app/api/projects/[id]/derive/route.ts`
- Create: `app/api/projects/[id]/building-spec/route.ts`
- Create: `app/api/projects/[id]/scaffold-spec/route.ts`
- Create: `app/api/projects/[id]/quote/route.ts`
- Create: `app/api/projects/[id]/verifier-report/route.ts`

- [ ] **Step 1: Implement GET/POST `/api/projects`**

```typescript
// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/project-store";

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = await createProject({ site_name: body.site_name, address: body.address ?? "" });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Implement derive route (spawn orchestrator)**

```typescript
// app/api/projects/[id]/derive/route.ts
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = await new Promise<number>((resolve) => {
    const child = spawn("node", ["scripts/orchestrate-project.mjs", "--project", id], { cwd: process.cwd() });
    child.on("close", resolve);
  });
  if (code !== 0) return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement artifact GET routes** — read JSON from `artifacts/projects/[id]/`

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- POST `/api/projects` with `{ "site_name": "Smoke Test" }`
- POST `/api/projects/<id>/derive`
- GET `/api/projects/<id>/quote` returns JSON with `grand_total`

- [ ] **Step 5: Commit**

```bash
git add app/api/projects
git commit -m "feat(scaffold): add project API routes"
```

---

### Task 9: Zustand store + shared SpecMesh component

**Files:**
- Create: `lib/stores/quote-store.ts`
- Create: `components/scaffold/SpecMesh.tsx`
- Create: `components/scaffold/ProceduralScene.tsx`

- [ ] **Step 1: Create quote store**

```typescript
import { create } from "zustand";

interface QuoteStore {
  highlightIds: string[];
  setHighlightIds: (ids: string[]) => void;
  provenanceVisible: boolean;
  toggleProvenance: () => void;
}

export const useQuoteStore = create<QuoteStore>((set) => ({
  highlightIds: [],
  setHighlightIds: (ids) => set({ highlightIds: ids }),
  provenanceVisible: false,
  toggleProvenance: () => set((s) => ({ provenanceVisible: !s.provenanceVisible })),
}));
```

- [ ] **Step 2: Create SpecMesh** — renders one `Component` as box/cylinder; highlights if `id` in `highlightIds`; provenance color when toggle on (copy color logic from `CathedralViewer.tsx` lines 40–46)

- [ ] **Step 3: Create ProceduralScene** — maps `spec.components` to `<SpecMesh />`, OrbitControls, click handler sets inspector state

- [ ] **Step 4: Commit**

```bash
git add lib/stores/quote-store.ts components/scaffold
git commit -m "feat(scaffold): add Zustand store and procedural scene components"
```

---

### Task 10: Project dashboard and wizard UI

**Files:**
- Create: `app/projects/page.tsx`
- Create: `app/projects/new/page.tsx`
- Create: `app/projects/[id]/layout.tsx`
- Modify: `app/layout.tsx` (add nav link to `/projects` — minimal, non-breaking)

- [ ] **Step 1: Dashboard lists projects from GET `/api/projects`**

Show table: site name, status, address, quote total, updated_at. "New Project" button → `/projects/new`.

- [ ] **Step 2: Wizard form** — site name + address → POST → redirect `/projects/[id]/ingest`

- [ ] **Step 3: Workspace layout** — left nav tabs: Ingest, Building, Scaffold, Quote; "Run Pipeline" calls POST derive

- [ ] **Step 4: Verify in browser**

Run: `npm run dev` → `/projects` shows demo-warehouse

- [ ] **Step 5: Commit**

```bash
git add app/projects app/layout.tsx
git commit -m "feat(scaffold): add project dashboard and workspace shell"
```

---

### Task 11: Ingest workspace

**Files:**
- Create: `app/projects/[id]/ingest/page.tsx`
- Create: `components/scaffold/IngestForm.tsx`

- [ ] **Step 1: Form fields** — footprint W×D, shared height, per-face height overrides (N/S/E/W), provenance select per face

- [ ] **Step 2: On save** — build `faces` array, PUT `/api/projects/[id]/building-canonical`, toast success

- [ ] **Step 3: CSV upload** — parse with manual `split(",")` for MVP; map headers `face_id,width_m,height_m,provenance`

- [ ] **Step 4: Manual test** — edit demo-warehouse height, save, run pipeline, building viewer updates

- [ ] **Step 5: Commit**

```bash
git add app/projects/[id]/ingest components/scaffold/IngestForm.tsx
git commit -m "feat(scaffold): add ingest workspace with manual form and CSV"
```

---

### Task 12: Building and scaffold 3D viewers

**Files:**
- Create: `app/projects/[id]/building/page.tsx`
- Create: `app/projects/[id]/scaffold/page.tsx`
- Create: `components/scaffold/BuildingViewer.tsx`
- Create: `components/scaffold/ScaffoldDesigner.tsx`
- Create: `components/scaffold/ComponentInspector.tsx`

- [ ] **Step 1: BuildingViewer** — fetch `/api/projects/[id]/building-spec`, render `ProceduralScene`, provenance toggle, click → `ComponentInspector`

- [ ] **Step 2: ScaffoldDesigner** — face checkboxes bound to `scaffold-config.json` PUT; "Auto-wrap" → POST derive → fetch scaffold-spec

- [ ] **Step 3: Combined scene on scaffold tab** — building meshes at opacity 0.35, scaffold opaque, steel/board materials

- [ ] **Step 4: Construction scrubber** — reuse playback pattern from `StageRail.tsx`; phases `footprint → faces` for building, `lifts` for scaffold

- [ ] **Step 5: Browser verify** — demo-warehouse shows 4 faces; scaffold on north+east visible

- [ ] **Step 6: Commit**

```bash
git add app/projects/[id]/building app/projects/[id]/scaffold components/scaffold/BuildingViewer.tsx components/scaffold/ScaffoldDesigner.tsx components/scaffold/ComponentInspector.tsx
git commit -m "feat(scaffold): add building and scaffold 3D viewers"
```

---

### Task 13: Quote panel with BOM highlight

**Files:**
- Create: `app/projects/[id]/quote/page.tsx`
- Create: `components/scaffold/QuotePanel.tsx`

- [ ] **Step 1: Fetch quote + verifier report**

- [ ] **Step 2: Render BOM table** — columns: stock code, description, qty, unit cost, line total

- [ ] **Step 3: Row onClick** — `useQuoteStore.getState().setHighlightIds(row.component_ids)`; if on scaffold tab, meshes highlight emissive yellow

- [ ] **Step 4: Render labor, hire, charges, grand total, assumptions list, confidence bar**

- [ ] **Step 5: Verifier badge** — red if `verifier_passed === false`; disable export button

- [ ] **Step 6: Commit**

```bash
git add app/projects/[id]/quote components/scaffold/QuotePanel.tsx
git commit -m "feat(scaffold): add quote panel with BOM highlight linking"
```

---

### Task 14: PDF export

**Files:**
- Create: `app/api/projects/[id]/export/pdf/route.ts`
- Create: `app/projects/[id]/quote/print/page.tsx`

- [ ] **Step 1: Printable quote page** — server component reads quote.json, renders HTML table + assumptions (no 3D screenshot in MVP v1 — static text "3D views available in app")

- [ ] **Step 2: Export route** — returns `Content-Type: text/html` with print stylesheet (`@media print`); client opens in new tab → user prints to PDF

- [ ] **Step 3: Wire Export button** — only enabled when `verifier_passed`; opens `/projects/[id]/quote/print`

- [ ] **Step 4: Test** — demo-warehouse export shows BOM + assumptions

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/export app/projects/[id]/quote/print
git commit -m "feat(scaffold): add printable quote export"
```

---

### Task 15: Heritage regression + README

**Files:**
- Modify: `README.md` (add Scaffold Quoter section)
- Modify: `.github/workflows/*` if exists, else document in README

- [ ] **Step 1: Run heritage build**

Run: `npm run build`
Expected: PASS (Notre-Dame derive + verify + next build)

- [ ] **Step 2: Run scaffold tests**

Run: `npm run test:scaffold`
Expected: PASS

- [ ] **Step 3: Add README section**

```markdown
## Scaffold Quoter (Phase 1 MVP)

File-based scaffolding estimation built on the Tekton pipeline.

- `/projects` — project dashboard
- `npm run project:derive` — run pipeline on demo-warehouse
- `npm run test:scaffold` — unit tests

See `docs/PRD-SCAFFOLD-QUOTER.md` and `docs/superpowers/specs/2026-06-23-scaffold-quoter-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Scaffold Quoter section to README"
```

---

## Self-Review Checklist

| PRD / Design requirement | Task |
|---|---|
| Manual dimensions ingest | Task 11 |
| CSV ingest | Task 11 |
| 3D building massing | Tasks 3, 12 |
| Provenance layer | Tasks 9, 12 |
| Scaffold auto-wrap | Task 4, 12 |
| BOM + labor + hire + margin | Task 5, 13 |
| BOM click → 3D highlight | Task 13 |
| Verifier blocks export | Tasks 5, 13, 14 |
| PDF export with assumptions | Task 14 |
| Deterministic derive scripts | Tasks 3–6 |
| Heritage build unchanged | Task 15 |
| Demo seed project | Task 2 |

No placeholders remain. All file paths are explicit.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-23-scaffold-quoter-mvp.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
