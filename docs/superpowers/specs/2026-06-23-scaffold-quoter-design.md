# Scaffold Quoter — Design Spec

**Date:** 2026-06-23  
**Status:** Approved (PRD signed off)  
**PRD:** [`docs/PRD-SCAFFOLD-QUOTER.md`](../../PRD-SCAFFOLD-QUOTER.md)  
**Scope:** Phase 1 MVP

---

## 1. Design Decisions (Open Questions Resolved)

| Question | Decision | Rationale |
|---|---|---|
| Geography / standards | **UK first** — TG20:21 + BS EN 12811 referenced in preset rules | Largest documented scaffold standard set; preset is data-driven so AU/NZ presets can ship later without code changes |
| Scaffold type | **Tube & fitting only** in MVP | Simpler BOM (tubes, ledgers, boards, couplers); system scaffold (Layher) is Phase 2 preset |
| Tenant model | **Single-tenant, file-based** — no auth in MVP | Matches Tekton artifact pattern; defers Clerk/Postgres until pilot proves value |
| Business model | **Internal tool** architecture, SaaS-ready interfaces | Project IDs, canonical JSON, and derive scripts are tenant-agnostic; DB layer added in Phase 2 |
| Storage | **`data/projects/<id>/` + `artifacts/projects/<id>/`** on disk | Reproducible, git-friendly demo projects; Vercel Blob in production later |

---

## 2. System Architecture

### 2.1 High-level diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Next.js App (runtime)                            │
│  /projects          → dashboard                                          │
│  /projects/[id]     → workspace (ingest | building | scaffold | quote) │
│  /                  → heritage Tekton demos (unchanged)                  │
└─────────────────────────────────────────────────────────────────────────┘
         │ read/write                          │ import at build
         ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────┐
│ data/projects/<id>/  │   spawn      │ scripts/             │
│  meta.json           │ ──────────►  │  orchestrate-project │
│  building-canonical  │              │  derive-building     │
│  scaffold-config     │              │  derive-scaffold     │
│  uploads/            │              │  quote.mjs           │
└──────────────────────┘              │  verify-scaffold     │
         │                            └──────────────────────┘
         ▼                                     │
┌──────────────────────┐                       ▼
│ artifacts/projects/  │ ◄─────────── frozen outputs
│  <id>/               │
│  building-spec.json  │
│  scaffold-spec.json  │
│  quote.json          │
│  verifier-report.json│
└──────────────────────┘
```

### 2.2 Planes

| Plane | When | LLM? | Output |
|---|---|---|---|
| **Ingest** | User saves canonical / uploads | No (MVP) | `building-canonical.json` |
| **Derive** | API route or `npm run project:derive` | No | `building-spec.json`, `scaffold-spec.json` |
| **Quote** | After derive | No | `quote.json` |
| **Verify** | Before export | No | `verifier-report.json` |
| **Render** | Browser | No | Interactive 3D |

Determinism: given identical inputs, derive + quote scripts emit byte-stable JSON (sorted keys, fixed rounding).

### 2.3 Heritage isolation

- No edits to `scripts/derive.mjs`, heritage `artifacts/`, or `/` route behavior.
- Shared utilities extracted to `lib/tekton-spec.ts` (types + mesh helpers) without changing heritage imports.
- `npm run build` continues to build heritage Notre-Dame; scaffold routes are additive (`/projects/*`).

---

## 3. Data Models

### 3.1 Project meta — `data/projects/<id>/meta.json`

```typescript
interface ProjectMeta {
  id: string;                    // uuid slug, e.g. "demo-rect-4face"
  site_name: string;
  address: string;
  status: "draft" | "quoted" | "won" | "lost";
  scaffold_system_id: string;      // "standard-tube-2.4"
  created_at: string;              // ISO 8601
  updated_at: string;
  quote_total?: number;            // cached from last quote.json
}
```

### 3.2 Building canonical — `data/projects/<id>/building-canonical.json`

```typescript
type Provenance = "surveyed" | "derived" | "assumed";

interface BuildingCanonical {
  meta: {
    project_id: string;
    site_name: string;
    address: string;
    created_at: string;
  };
  units: { length: "m" };
  envelope: {
    footprint: {
      type: "rectangle";           // MVP: rectangle only
      width_m: number;
      depth_m: number;
      provenance: Provenance;
      source: string;
    };
    faces: Face[];
  };
  constraints: {
    public_footpath_m: number;
    no_scaffold_zones: NoScaffoldZone[];
    access_notes: string;
  };
  inputs: InputRecord[];
}

interface Face {
  id: string;                      // "north" | "south" | "east" | "west"
  bearing_deg: number;             // 0=N, 90=E, 180=S, 270=W
  width_m: number;
  height_m: number;
  provenance: Provenance;
  source: string;
  confidence: number;              // 0–1
}

interface NoScaffoldZone {
  id: string;
  face_id: string;
  x_m: number;                     // along face width
  y_m: number;                     // up from ground
  w_m: number;
  h_m: number;
}

interface InputRecord {
  type: "manual" | "csv" | "image" | "maps_ref";
  file?: string;
  rights: "client_provided" | "public";
  extracted_fields: string[];
}
```

**MVP constraint:** footprint is axis-aligned rectangle; four faces auto-derived from width/depth/height with per-face height overrides allowed.

### 3.3 Scaffold config — `data/projects/<id>/scaffold-config.json`

```typescript
interface ScaffoldConfig {
  project_id: string;
  system_id: string;               // matches data/scaffold-systems/*.json
  selected_faces: string[];        // face ids to wrap
  standoff_m: number;              // default 0.3
  extra_lift_m: number;            // working platform above top (default 2.4)
  access_bay_every_n: number;      // default 4
  overrides: ScaffoldOverride[];
}

interface ScaffoldOverride {
  type: "add_lift" | "remove_lift" | "set_bay_width";
  face_id: string;
  lift_index?: number;
  bay_width_m?: number;
}
```

### 3.4 Structural spec (building + scaffold)

Reuses Tekton component shape from `artifacts/structural-spec.json`:

```typescript
interface StructuralSpec {
  meta: Record<string, unknown>;
  units: { length: string; note?: string };
  phases: string[];
  key_dimensions: Record<string, number | string | number[]>;
  provenance_colors: Record<Provenance, string>;
  components: Component[];
}

interface Component {
  id: string;
  name_en: string;
  phase: string;
  category: string;                // "building-face" | "tube" | "ledger" | "board" | ...
  role?: string;
  geometry: {
    type: "box" | "cylinder";
    w?: number; h?: number; d?: number; r?: number;
  };
  position: [number, number, number];
  rotation_deg?: [number, number, number];
  provenance: Provenance;
  source: string;
  stock_code?: string;             // scaffold components only
  face_id?: string;
  lift_index?: number;
  material?: string;
}
```

### 3.5 Quote — `artifacts/projects/<id>/quote.json`

As defined in PRD §9.1. Added fields:

```typescript
interface Quote {
  project_id: string;
  generated_at: string;
  scaffold_system: string;
  bom: BomLine[];
  labor: LaborLine[];
  hire: { weeks: number; rate_per_week: number };
  charges: ChargeLine[];
  totals: { materials: number; labor: number; hire: number; charges: number; grand_total: number };
  confidence: { surveyed_pct: number; derived_pct: number; assumed_pct: number };
  assumptions: string[];
  verifier_passed: boolean;
}

interface BomLine {
  stock_code: string;
  description: string;
  qty: number;
  unit: string;
  unit_cost: number;
  line_total: number;
  derivation: string;              // e.g. "scaffold-spec:tube-*"
  component_ids: string[];         // for 3D highlight
}
```

### 3.6 Scaffold system preset — `data/scaffold-systems/standard-tube-2.4.json`

Shipped static file (PRD §8.1). Rule engine reads at derive time; never hardcoded in script logic.

### 3.7 Price list — `data/price-list.json`

```typescript
interface PriceList {
  currency: "GBP";
  items: Record<string, { description: string; unit: string; unit_cost: number; hireable: boolean }>;
  labor: { erect_rate_per_day: number; dismantle_factor: number; crew_size: number; lifts_per_day: number };
  charges: { delivery_flat: number; default_margin_pct: number };
  hire: { rate_per_week: number };
}
```

---

## 4. Derive Algorithms

### 4.1 `derive-building.mjs`

**Input:** `building-canonical.json`  
**Output:** `artifacts/projects/<id>/building-spec.json`

1. Parse footprint rectangle → center at origin, ground at y=0.
2. Emit `footprint-slab` box: w=width, d=depth, h=0.15 m (visual only, `assumed`).
3. For each face in `envelope.faces`:
   - Compute plane position from bearing + half-dimension offset.
   - Emit `face-<id>` box: w=face.width_m, h=face.height_m, d=0.2 m (wall thickness visual).
   - Rotation from `bearing_deg`.
4. Emit `no-scaffold-zone-*` as thin red boxes on face plane.
5. Write `key_dimensions` summary for verifier.

**Face auto-generation (when user enters only W×D×H):** If `faces` array empty, generate four faces from footprint dimensions with shared height from form; mark `derived` from `footprint`.

### 4.2 `derive-scaffold.mjs`

**Input:** `building-spec.json`, `scaffold-config.json`, `data/scaffold-systems/<id>.json`  
**Output:** `artifacts/projects/<id>/scaffold-spec.json`

Per selected face:

1. Read face component from building-spec by `face_id`.
2. Scaffold plane = face plane offset outward by `standoff_m`.
3. `bay_count = ceil(face_width / ledger_spacing_m)`.
4. `lift_count = ceil((face_height + extra_lift_m) / max_lift_height_m)`.
5. For each lift `L` and bay `B`:
   - Emit vertical `tube` at each bay line (cylinder, stock_code from preset).
   - Emit horizontal `ledger` at lift top (box along width).
   - Emit `transom` every `transom_spacing_m`.
   - Emit `board` on lift deck (qty from face width / board_width).
   - Emit `coupler` at each tube-ledger joint (count rule).
6. Every 2 lifts vertically: emit `tie` if `lift_index % tie_interval === 0`.
7. Top lift: emit `guardrail` + `toe_board` if rules require.
8. Every `access_bay_every_n` bays: widen one bay, emit `access` category marker.
9. Apply `overrides` from scaffold-config (remove_lift skips emission; add_lift adds extra stack).

All components tagged `provenance: "derived"`, `source: "scaffold-system:<id>"`.

### 4.3 `quote.mjs`

**Input:** `scaffold-spec.json`, `building-canonical.json`, `data/price-list.json`, `scaffold-config.json`  
**Output:** `artifacts/projects/<id>/quote.json`

1. Group scaffold components by `stock_code` → BOM lines with `component_ids`.
2. Labor erect: `lift_count_total * 0.5 / lifts_per_day * crew_size * rate` (simplified MVP formula documented in assumption log).
3. Labor dismantle: erect × `dismantle_factor`.
4. Hire: `hire.weeks * hire.rate_per_week` on hireable BOM subset.
5. Charges: delivery + margin % on subtotal.
6. Confidence: area-weighted average of face confidence by scaffold face coverage.
7. Assumptions: auto-collect all `assumed` faces into prose strings.

### 4.4 `verify-scaffold.mjs`

| ID | Check | Severity |
|---|---|---|
| S01 | Every `selected_face` has ≥1 scaffold component | critical |
| S02 | All working lifts have guardrail components | critical |
| S03 | Tie count ≥ `floor(lift_count / tie_interval) * bay_count` per face | warning |
| S04 | No scaffold component center inside `no_scaffold_zones` | critical |
| S05 | Every scaffold component has `stock_code` | critical |
| S06 | BOM qty matches scaffold-spec group counts | critical |
| S07 | At least one access marker per face with >3 bays | warning |

Export blocked on any **critical** failure unless `meta.export_override` set with reason.

### 4.5 `orchestrate-project.mjs`

```bash
node scripts/orchestrate-project.mjs --project <id>
# Phases: VALIDATE → DERIVE_BUILDING → DERIVE_SCAFFOLD → QUOTE → VERIFY
# Exit 0 only if verify passes (or --soft-verify for dev)
```

---

## 5. UI Components

### 5.1 Route map

| Route | Component | Purpose |
|---|---|---|
| `/projects` | `ProjectDashboard` | List + create project |
| `/projects/new` | `ProjectWizard` | Name, address, system preset |
| `/projects/[id]` | `ProjectWorkspace` | Tab shell |
| `/projects/[id]/ingest` | `IngestWorkspace` | Manual form + CSV upload |
| `/projects/[id]/building` | `BuildingViewer` | 3D building + provenance |
| `/projects/[id]/scaffold` | `ScaffoldDesigner` | Face select + auto-wrap + 3D |
| `/projects/[id]/quote` | `QuotePanel` | BOM, export |

### 5.2 `ProjectWorkspace` layout

```text
┌────────────────────────────────────────────────────────────┐
│ [← Projects]  Site Name · draft          [Run Pipeline] [Export] │
├──────────┬─────────────────────────────────────────────────┤
│ Ingest   │                                                 │
│ Building │            Main panel (route outlet)            │
│ Scaffold │                                                 │
│ Quote    │                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

### 5.3 `BuildingViewer` (fork from `CathedralViewer.tsx`)

Reuse:
- R3F Canvas, OrbitControls, provenance color map, click-to-inspect, construction scrubber.

Changes:
- Load spec from `/api/projects/[id]/building-spec` (reads artifact JSON).
- Provenance labels: surveyed / derived / assumed.
- No heritage-specific materials (stone, dougong).

### 5.4 `ScaffoldDesigner`

- Checkbox list of faces → updates `scaffold-config.json` via API.
- "Auto-wrap" button → POST `/api/projects/[id]/derive` → reload viewer.
- Combined scene: building (opacity 0.35) + scaffold (opaque).
- Scaffold click → inspector shows stock_code, lift, face.

### 5.5 `QuotePanel`

- Tables for BOM, labor, hire, charges.
- Row click → `highlightComponentIds` passed to viewer via Zustand store (`useQuoteStore`).
- "Export PDF" → server generates from quote.json + static template (MVP: HTML → print PDF via Puppeteer or simple JSON download + printable page).
- Verifier status badge; export disabled if critical failures.

### 5.6 `IngestWorkspace`

**MVP manual form fields:**
- Site name, address (text)
- Footprint width (m), depth (m)
- Per-face heights (N/S/E/W) — default to shared height
- Provenance dropdown per face (surveyed / assumed)
- Public footpath clearance (m)
- Save → writes `building-canonical.json` → triggers derive

**CSV upload:** Map columns `face_id,width_m,height_m,provenance` → merge into canonical.

**Maps reference:** Store address string in meta only (no API key required MVP).

---

## 6. API Routes

| Method | Path | Action |
|---|---|---|
| GET | `/api/projects` | List `meta.json` from `data/projects/*` |
| POST | `/api/projects` | Create uuid folder + default canonical |
| GET | `/api/projects/[id]/meta` | Read meta |
| GET | `/api/projects/[id]/building-canonical` | Read canonical |
| PUT | `/api/projects/[id]/building-canonical` | Write + validate |
| GET | `/api/projects/[id]/scaffold-config` | Read config |
| PUT | `/api/projects/[id]/scaffold-config` | Write config |
| POST | `/api/projects/[id]/derive` | Spawn `orchestrate-project.mjs` |
| GET | `/api/projects/[id]/building-spec` | Read artifact |
| GET | `/api/projects/[id]/scaffold-spec` | Read artifact |
| GET | `/api/projects/[id]/quote` | Read quote |
| GET | `/api/projects/[id]/verifier-report` | Read verifier |
| GET | `/api/projects/[id]/export/pdf` | Generate PDF |

All file I/O in `lib/project-store.ts` — single module for path resolution and validation.

---

## 7. State Management

`lib/stores/quote-store.ts` (Zustand):

```typescript
interface QuoteStore {
  highlightIds: string[];
  setHighlightIds: (ids: string[]) => void;
  provenanceVisible: boolean;
  toggleProvenance: () => void;
  activeTab: "building" | "scaffold";
  setActiveTab: (tab: "building" | "scaffold") => void;
}
```

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| Missing canonical on derive | 400 API error, UI toast "Complete ingest first" |
| Derive script exit 1 | Return stderr in API response, show in pipeline rail |
| Verifier critical fail | Quote tab shows failures; export disabled |
| Invalid face dimensions (≤0) | Zod validation on PUT canonical, field-level errors |
| Heritage build unaffected | Scaffold scripts in separate npm scripts |

---

## 9. Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Canonical validation | Node test (`tests/canonical.test.mjs`) | Schema + provenance required |
| derive-building | Node test | Rectangle → 4 faces + slab |
| derive-scaffold | Node test | Known 12m×8m face → expected tube count |
| quote.mjs | Node test | BOM sums match manual count |
| verify-scaffold | Node test | Inject bad spec → S01 fails |
| API routes | Node test with temp dir | CRUD project |
| Heritage regression | `npm run build` | Still passes |

Demo seed project: `data/projects/demo-warehouse/` — 20 m × 12 m × 8 m rectangular warehouse, pre-derived artifacts committed for CI.

---

## 10. MVP Exclusions (Explicit)

- Auth, multi-tenant, Postgres
- CAD, video, AI photo outline
- Revision diff UI (quote regenerated on each derive; diff in Phase 2)
- Real Google Maps Static API (address text only)
- Stock inventory tracking
- Mobile layout

---

## 11. Success Criteria (maps to PRD §13)

All nine PRD MVP definition-of-done items satisfied by the implementation plan tasks.

---

*Approved for implementation. See [`docs/superpowers/plans/2026-06-23-scaffold-quoter-mvp.md`](../plans/2026-06-23-scaffold-quoter-mvp.md).*
