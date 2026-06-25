# Scaffold Quoter — Phase 1 Design Spec

**Date:** 2026-06-25  
**Status:** Approved in brainstorming (pending written spec review)  
**Scope:** Phase 1 only — Engine MVP (1A) + App Shell (1B)

---

## 1. Summary

Scaffold Quoter repurposes the Tekton evidence-based 3D reconstruction engine for commercial scaffolding estimation. Phase 1 delivers an end-to-end quote pipeline: ingest site dimensions → procedural building massing → AUS-compliant modular scaffold wrap → defensible BOM/labor/hire quote → PDF export.

**One-line goal:** An estimator can quote a simple rectangular building from manual dimensions or CSV, adjust scaffold modules in 3D, and export a traceable quote in under 15 minutes.

### Locked decisions (brainstorming)

| Decision | Choice |
|---|---|
| Geography / standards | Australian — AS/NZS 1576.1 + AS/NZS 1576.6 deemed-to-conform |
| Scaffold system | Modular scaffold; tube-and-coupler geometry rendered inside each module |
| BOM atomic unit | Standard bay modules (+ access / corner / hop-up / tie / guardrail variants) |
| Delivery strategy | **C** — Engine first (Phase 1A), app shell second (Phase 1B) |
| Engine ingest | Manual dimensions + CSV import |
| Engine extras | Shipped sample building + editable scaffold config |
| Repo strategy | Additive Tekton extension (Approach 1) — heritage demos untouched |

---

## 2. Relationship to Tekton

Scaffold Quoter reuses Tekton's pipeline pattern with different domain rules:

| Tekton (heritage) | Scaffold Quoter (commercial) |
|---|---|
| Yingzao Fashi construction rules | AUS modular scaffold system rules |
| `measured / rule_derived / conjecture` | `surveyed / derived / assumed` |
| Bracket sets, roof curves | Bay modules, lifts, ties, guardrails |
| Academic verifier (bay rhythm, fen ratios) | Commercial verifier (tie spacing, access, BOM integrity) |
| Static heritage demos | Per-project quotes |

Heritage routes (`/`, `?building=nanchan`, Notre-Dame tiers) and their derive scripts remain unchanged. Quoter adds a new top-level entry: **Scaffold Quoter**.

---

## 3. Architecture

### 3.1 Two-plane model

```text
INGEST TIME (per project)                         RUNTIME (deployed app)
┌─────────────────────────────────────┐          ┌──────────────────────────────┐
│ raw uploads + manual/CSV input      │          │ Next.js app                  │
│   → parse / normalize               │  emits   │   project workspace UI       │
│   → building-canonical.json         │  ──────► │   R3F viewer (building +     │
│   → derive-building.mjs             │ artifacts│     scaffold layers)         │
│   → derive-scaffold.mjs             │          │   quote panel + export       │
│   → verify-scaffold.mjs             │          │   auth + project DB (1B)     │
│   → quote.mjs                       │          │                              │
└─────────────────────────────────────┘          └──────────────────────────────┘
```

### 3.2 Phase split

**Phase 1A — Engine MVP**

- File-based projects under `data/projects/<id>/`
- CLI orchestration: `npm run project:derive -- <id>`
- Minimal viewer route with dimension form, CSV import, scaffold editor, quote panel
- Shipped sample project: `demo-warehouse`
- No auth, no DB

**Phase 1B — App Shell**

- Same artifact contract as 1A (no schema changes)
- Project dashboard (CRUD, status workflow)
- Full ingest workspace UI (upload zone, CSV column mapper)
- SQLite (dev) / Postgres (prod) via Drizzle ORM
- Object storage for uploads (S3 / Vercel Blob)
- Auth deferred or minimal (magic link / simple password)

### 3.3 Determinism principle

Given identical inputs:

- `data/projects/<id>/building-canonical.json`
- `data/projects/<id>/scaffold-config.json`
- `data/scaffold-systems/aus-modular-2.0x2.4.json`
- `data/price-list.json`

…the derive chain always emits identical artifacts. AI may assist ingest suggestions in Phase 1B+, but only **committed** canonical data enters the derive chain. No LLM calls in derive, verify, or quote scripts.

### 3.4 Repository layout (additive)

```text
data/
  scaffold-systems/
    aus-modular-2.0x2.4.json       # AUS modular bay preset
  price-list.json                  # stock codes + unit costs
  projects/
    demo-warehouse/                # shipped sample project
      building-canonical.json
      scaffold-config.json
      uploads/                     # raw files (CSV, etc.)

artifacts/projects/<id>/
  building-spec.json
  scaffold-spec.json
  quote.json
  verifier-report.json

scripts/
  derive-building.mjs              # NEW
  derive-scaffold.mjs              # NEW
  verify-scaffold.mjs              # NEW
  quote.mjs                        # NEW
  orchestrate-project.mjs          # per-project pipeline

components/
  ProjectWorkspace.tsx             # NEW — main quoter UI shell
  BuildingViewer.tsx               # NEW — fork/adapt CathedralViewer
  ScaffoldViewer.tsx               # NEW — scaffold layer + editor
  QuotePanel.tsx                   # NEW — BOM/labor/hire + export
  IngestForm.tsx                   # NEW — manual dims + CSV (1A minimal)

app/
  quoter/                          # NEW routes (or /projects in 1B)
    page.tsx                       # sample project / project list
    [id]/page.tsx                  # project workspace
```

---

## 4. AUS Modular Bay Preset

**File:** `data/scaffold-systems/aus-modular-2.0x2.4.json`

### 4.1 System parameters

| Parameter | Value | Source |
|---|---|---|
| Lift height | 2.0 m | AS/NZS 1576.6 typical |
| Max bay length | 2.4 m | General-duty deemed-to-conform |
| Min bay length | 1.8 m | Heavy-duty / narrow remainder |
| Bay width (boards) | 0.87 m (4-board) | Industry standard |
| Tube OD | 48.3 mm | AS/NZS 1576.2 |
| Tie spacing (vertical) | 4.0 m | 1576.6 tabulated |
| Tie spacing (horizontal) | 4.0 m | 1576.6 tabulated |
| Standoff from face | 0.3 m | Default, editable in config |
| Guardrail + toe board | Required on working lifts | AS/NZS 1576.1 |
| Standards referenced | AS/NZS 1576.1, AS/NZS 1576.6 | Deemed-to-conform scope |

### 4.2 Module catalog (BOM line items)

| Module ID | Description | When used |
|---|---|---|
| `MOD-STD-2.0x2.4` | Standard bay frame, 2.0 m lift × 2.4 m | Default auto-wrap |
| `MOD-ACC-2.0x2.4` | Access bay (ladder frame) | Every N bays (default 5) |
| `MOD-CRN-2.0` | Corner module | Building corners |
| `MOD-HOP-1.0` | Hop-up / narrow bay (< 1.8 m remainder) | Width remainder after bay division |
| `MOD-TIE-KIT` | Tie kit per tie point | Rule-derived from tie spacing |
| `MOD-GRD-LIFT` | Guardrail set per working lift | Top lift + working platforms |

Each module includes a **detail template**: procedural tube, ledger, transom, board, and coupler geometry for the 3D viewer. BOM counts modules only; the viewer renders tube-and-coupler detail as child geometry within each module group.

### 4.3 Preset schema shape

```jsonc
{
  "id": "aus-modular-2.0x2.4",
  "name": "AUS Modular Tube & Fitting (2.0 m lifts)",
  "standards": ["AS/NZS 1576.1", "AS/NZS 1576.6"],
  "geometry": {
    "lift_height_m": 2.0,
    "max_bay_length_m": 2.4,
    "min_bay_length_m": 1.8,
    "bay_width_m": 0.87,
    "tube_od_mm": 48.3,
    "standoff_default_m": 0.3
  },
  "rules": {
    "tie_spacing_vertical_m": 4.0,
    "tie_spacing_horizontal_m": 4.0,
    "guardrail_required": true,
    "toe_board_required": true,
    "access_bay_every_n": 5,
    "max_height_deemed_to_conform_m": 30.0
  },
  "modules": {
    "MOD-STD-2.0x2.4": {
      "description": "Standard bay frame 2.0 × 2.4 m",
      "lift_m": 2.0,
      "width_m": 2.4,
      "detail_template": "standard-bay-tube-coupler"
    }
    // ... other modules
  },
  "stock_codes": {
    "MOD-STD-2.0x2.4": "MOD-STD-240",
    "MOD-ACC-2.0x2.4": "MOD-ACC-240"
    // ...
  }
}
```

Schema is designed so Phase 2 can add prefabricated system presets (Layher, Haki) as new JSON files without code changes.

---

## 5. Data Schemas

### 5.1 Building canonical

**File:** `data/projects/<id>/building-canonical.json`

Extends Tekton's canonical JSON pattern:

```jsonc
{
  "meta": {
    "project_id": "demo-warehouse",
    "site_name": "Demo Warehouse",
    "address": "123 Industrial Ave, Melbourne VIC",
    "created_at": "2026-06-25T00:00:00Z"
  },
  "units": { "length": "m" },
  "envelope": {
    "footprint": {
      "type": "polygon",
      "points": [[0, 0], [12, 0], [12, 8], [0, 8]],
      "provenance": "surveyed",
      "source": "dimensions.csv",
      "confidence": 1.0
    },
    "faces": [
      {
        "id": "north",
        "bearing_deg": 0,
        "width_m": 12.0,
        "height_m": 6.5,
        "setbacks": [],
        "openings": [
          { "type": "door", "x_m": 5.0, "y_m": 0, "w_m": 3.0, "h_m": 2.4 }
        ],
        "provenance": "surveyed",
        "source": "dimensions.csv",
        "confidence": 1.0
      }
    ]
  },
  "constraints": {
    "public_footpath_m": 1.2,
    "no_scaffold_zones": [],
    "access_notes": ""
  },
  "inputs": [
    {
      "type": "csv",
      "file": "dimensions.csv",
      "extracted_fields": ["footprint", "north.width_m", "north.height_m"]
    }
  ]
}
```

**Provenance classes:**

| Class | Meaning | UI color |
|---|---|---|
| `surveyed` | Measured on site or from trusted CAD/CSV | Green |
| `derived` | Computed from other surveyed values | Amber |
| `assumed` | Estimator guess — must be visible | Red |

Every dimensional node requires `{ provenance, source }`. The derive `comp()` audit gate throws on missing tags (same discipline as Tekton).

### 5.2 Scaffold config (editable)

**File:** `data/projects/<id>/scaffold-config.json`

Declarative overrides — deterministic replay, not freehand mesh editing:

```jsonc
{
  "system_id": "aus-modular-2.0x2.4",
  "selected_faces": ["north", "east", "west"],
  "standoff_m": 0.3,
  "working_lift_extra_m": 2.0,
  "auto_wrap": {
    "enabled": true,
    "access_bay_every_n": 5,
    "corner_modules": true
  },
  "overrides": [
    { "face_id": "north", "lift_index": 2, "action": "remove" },
    {
      "face_id": "east",
      "bay_index": 3,
      "action": "replace",
      "module": "MOD-ACC-2.0x2.4"
    },
    {
      "face_id": "west",
      "bay_index": 4,
      "action": "set_width",
      "width_m": 1.8,
      "reason": "narrow remainder"
    }
  ],
  "no_scaffold_zones": []
}
```

**Supported override actions:**

| Action | Effect |
|---|---|
| `remove` (lift) | Remove a lift from a face |
| `add` (lift) | Add a lift above existing stack |
| `replace` (bay) | Swap module type at bay index |
| `set_width` (bay) | Set bay width within AUS limits |
| `exclude` (face) | Remove face from scaffold (also via `selected_faces`) |

Every override may carry a `reason` string appended to the assumption log.

### 5.3 Building spec (derived)

**File:** `artifacts/projects/<id>/building-spec.json`

Same structural-spec schema as Tekton. Components:

- `footprint-slab` — ground plane polygon
- `face-<id>` — elevation planes with opening markers (MVP: markers, not boolean cuts)
- `feature-<id>` — chimneys, dormers (manual, Phase 1 optional)
- `no-scaffold-zone-<id>` — exclusion volumes

### 5.4 Scaffold spec (derived)

**File:** `artifacts/projects/<id>/scaffold-spec.json`

Two logical layers in one file:

```jsonc
{
  "meta": {
    "project_id": "demo-warehouse",
    "system_id": "aus-modular-2.0x2.4",
    "generated_by": "derive-scaffold.mjs"
  },
  "modules": [
    {
      "id": "north-L0-B0",
      "module_id": "MOD-STD-2.0x2.4",
      "stock_code": "MOD-STD-240",
      "face_id": "north",
      "lift_index": 0,
      "bay_index": 0,
      "position": [0.3, 0, 6.0],
      "rotation_deg": [0, 0, 0],
      "provenance": "rule_derived",
      "source": "auto_wrap",
      "rule": "bay_division"
    }
  ],
  "components": [
    {
      "id": "north-L0-B0-tube-std-1",
      "parent_module": "north-L0-B0",
      "geometry": { "type": "cylinder", "r": 0.02415, "h": 2.0 },
      "position": [0.3, 1.0, 6.0],
      "material": "steel",
      "provenance": "rule_derived",
      "source": "detail_template:standard-bay-tube-coupler",
      "render_only": true
    }
  ],
  "warnings": []
}
```

- `modules[]` — BOM-countable bay units with stock codes
- `components[]` — tube-and-coupler detail geometry (`render_only: true`, not in BOM)
- Clicking a BOM line highlights all components sharing the same `parent_module`

### 5.5 Quote (derived)

**File:** `artifacts/projects/<id>/quote.json`

```jsonc
{
  "project_id": "demo-warehouse",
  "scaffold_system": "aus-modular-2.0x2.4",
  "bom": [
    {
      "stock_code": "MOD-STD-240",
      "description": "Standard bay frame 2.0 × 2.4 m",
      "qty": 42,
      "unit": "each",
      "unit_cost": 85.0,
      "line_total": 3570.0,
      "derivation": "scaffold-spec:modules:MOD-STD-2.0x2.4"
    }
  ],
  "labor": [
    {
      "task": "erect",
      "crew": 3,
      "days": 3.5,
      "rate_per_day": 850,
      "line_total": 8925.0,
      "rule": "42 modules × 0.08 days/module ÷ 3 crew"
    },
    {
      "task": "dismantle",
      "crew": 3,
      "days": 2.1,
      "rate_per_day": 850,
      "line_total": 5355.0,
      "rule": "erect × 0.6"
    }
  ],
  "hire": {
    "weeks": 8,
    "rate_per_week": 2400,
    "line_total": 19200.0,
    "hireable_codes": ["MOD-STD-240", "MOD-ACC-240"]
  },
  "charges": [
    { "type": "delivery", "amount": 350 },
    { "type": "margin", "percent": 15, "applied_to": "subtotal" }
  ],
  "totals": {
    "materials": 4200.0,
    "labor": 14280.0,
    "hire": 19200.0,
    "charges": 350,
    "subtotal": 38030.0,
    "margin": 5704.5,
    "grand_total": 43734.5
  },
  "confidence": {
    "surveyed_pct": 0.6,
    "derived_pct": 0.15,
    "assumed_pct": 0.25
  },
  "assumptions": [
    "South elevation height assumed 6.5 m — not site measured.",
    "Access bay every 5 bays per AS/NZS 1576.6 deemed-to-conform default."
  ]
}
```

---

## 6. Derive Pipeline

### 6.1 Orchestration

**Script:** `scripts/orchestrate-project.mjs`  
**npm script:** `npm run project:derive -- <project-id>`

```text
1. LOAD     building-canonical.json + scaffold-config.json
2. VALIDATE ingest gate (every dimension has provenance; gaps preserved)
3. DERIVE   building-spec.json          (derive-building.mjs)
4. DERIVE   scaffold-spec.json          (derive-scaffold.mjs)
5. VERIFY   verifier-report.json        (verify-scaffold.mjs)
6. QUOTE    quote.json                  (quote.mjs)
7. SUMMARY  log pass/fail + artifact paths
```

Verifier failures on critical checks (V01–V05) block quote export unless the estimator logs an explicit override reason.

### 6.2 derive-building.mjs

**Input:** `building-canonical.json`  
**Output:** `building-spec.json`, `derivation-log.md`

- Extrude footprint to slab
- Emit face planes from envelope faces (width × height, positioned by bearing)
- Mark openings as red box markers (no boolean cuts in MVP)
- Tag every component with provenance from canonical source
- Reuse Tekton `comp()` audit gate pattern

### 6.3 derive-scaffold.mjs

**Input:** `building-spec.json` + `scaffold-config.json` + system preset  
**Output:** `scaffold-spec.json`, `derivation-log-scaffold.md`

**Auto-wrap algorithm:**

1. For each face in `selected_faces`, compute scaffold plane offset by `standoff_m`
2. Divide face width into bays ≤ `max_bay_length_m` (2.4 m); remainder → hop-up module if ≥ `min_bay_length_m`
3. Stack lifts of `lift_height_m` (2.0 m) until `face.height + working_lift_extra_m`
4. Place corner modules at building corners where two scaffolded faces meet
5. Insert access bay every N bays per config
6. Apply `overrides[]` in order (remove/add lift, replace module, set width)
7. Emit tie kits at tie spacing intervals (vertical + horizontal)
8. Emit guardrail sets on working lifts
9. Expand each module's detail template into `components[]` for rendering

Every module tagged: `{ stock_code, face_id, lift_index, bay_index, provenance: "rule_derived", rule: "<rule_id>" }`

### 6.4 verify-scaffold.mjs

| ID | Check | Severity |
|---|---|---|
| V01 | Every selected face has complete lift coverage | Blocking |
| V02 | Tie spacing within preset limits | Blocking |
| V03 | Guardrails on all working lifts | Blocking |
| V04 | Access bay within max horizontal distance (≤ 5 bays) | Warning |
| V05 | No modules in `no_scaffold_zones` | Blocking |
| V06 | BOM quantities match module counts in scaffold-spec | Blocking |
| V07 | Every module has stock code mapping | Blocking |
| V08 | Bay widths within AUS limits (≤ 2.4 m, ≥ 1.8 m or hop-up) | Blocking |
| V09 | Total height ≤ 30 m (1576.6 deemed-to-conform scope) | Warning |

Pattern: recompute from spec geometry; never trust `quote.json` totals (same rule as Tekton verifier).

### 6.5 quote.mjs

**Input:** `scaffold-spec.json` + `price-list.json` + `building-canonical.json`  
**Output:** `quote.json`

| Line | Rule |
|---|---|
| Materials | Sum modules × unit cost from price list |
| Erect labor | `total_modules × factor / crew_daily_capacity` |
| Dismantle labor | Erect labor × 0.6 (default) |
| Hire | Weeks from config × weekly rate (hireable modules only) |
| Delivery | Flat fee from price list |
| Margin | % on subtotal |
| Confidence | % of scaffold face area by provenance class |
| Assumptions | Auto-generated from `assumed` dimensions + override reasons |

---

## 7. Sample Project

**ID:** `demo-warehouse`  
**Site:** Rectangular 2-storey commercial warehouse

| Property | Value | Provenance |
|---|---|---|
| Footprint | 12 m × 8 m rectangle | surveyed (CSV) |
| Eave height | 6.5 m all faces | surveyed (CSV) north/east/west; assumed (manual) south |
| Openings | 1 door on north (3 m × 2.4 m) | surveyed (CSV) |
| Scaffold | 3 faces (north, east, west) | config default |

Purpose: demonstrates confidence layer, auto-wrap, editable scaffold, quote export, and BOM-to-3D traceability out of the box via `npm run project:derive -- demo-warehouse`.

---

## 8. User Interface

### 8.1 Phase 1A — Minimal workspace

Single route: `/quoter` (loads `demo-warehouse` by default; project picker for file-based projects).

**Layout:** Split view — 3D viewer (left 60%) + side panel (right 40%)

**Side panel tabs:**

1. **Dimensions** — manual form for footprint + faces; CSV upload with column mapping
2. **Scaffold** — face selector, auto-wrap button, bay/lift editor (click-to-select in 3D)
3. **Quote** — BOM / labor / hire tables; confidence summary; assumption log; export buttons

**3D viewer (inherited from Tekton):**

- Orbit / pan / zoom
- Provenance toggle on building (surveyed / derived / assumed colors)
- Building muted / wireframe when scaffold active
- Scaffold modules rendered with tube-and-coupler detail
- Click module → inspect stock code, face, lift, bay index
- Click BOM row → highlight matching modules in 3D
- Construction sequence scrubber (building → scaffold lifts in order)
- Rule violation markers (inline warnings)

**Export:**

- PDF quote (cover, 3D iso screenshot, BOM, labor, hire, assumptions, confidence)
- CSV BOM
- JSON quote (for revision diffing in Phase 2)

### 8.2 Phase 1B — App shell additions

- `/quoter` → project dashboard (list, create, status: draft / quoted / won / lost)
- New project wizard: site name, address, system preset
- Full ingest workspace with upload zone and ingest progress rail
- Project persistence in DB (same file paths, DB stores metadata + blob references)
- Revision history (immutable quote versions, append-only assumption log)

---

## 9. Ingest (Phase 1A scope)

| Input | Supported | Extraction |
|---|---|---|
| Manual dimension form | ✓ | Direct canonical write |
| CSV / spreadsheet | ✓ | Column mapping UI → canonical |
| Photos | Phase 1B | Human trace tool |
| Google Maps | Phase 1B | Reference attachment only |
| CAD (DWG/DXF) | Phase 2 | — |
| Video | Phase 2 | — |

**CSV column mapping:** User maps columns to canonical fields (face id, width, height, bearing, opening type/position). Unmapped columns ignored. Conflicts surfaced in UI; user picks winner; runner-up preserved in canonical with source tag.

**Conflict resolution:** User-chosen value wins; runner-up preserved with source. Resolution recorded in assumption log. Never silent overwrite.

---

## 10. Phase 1 Definition of Done

1. Estimator can load `demo-warehouse`, see 3D massing with provenance layer
2. Estimator can enter manual dimensions for a new rectangular building (4 faces) and derive a model
3. Estimator can import dimensions via CSV with column mapping
4. Estimator can auto-wrap scaffold on 2+ faces and see AUS bay modules in 3D with tube-and-coupler detail
5. Estimator can edit scaffold: swap bay module type, add/remove lift, adjust bay width
6. Quote panel shows BOM (module counts), labor, hire, margin with grand total
7. Clicking a BOM line highlights scaffold modules in the viewer
8. Confidence layer shows surveyed vs. assumed dimensions on building faces
9. Verifier runs and blocks export on critical scaffold rule failures
10. PDF quote exports with 3D screenshot, BOM, and assumptions
11. All derive steps are script-driven and reproducible from canonical JSON + scaffold config
12. Heritage Tekton demos still build and deploy unchanged

---

## 11. Out of Scope (Phase 1)

- CAD parser (DWG/DXF)
- Video ingest
- Photo trace tool (deferred to Phase 1B)
- Google Maps reference capture (deferred to Phase 1B)
- Multi-tenant / org management
- Stock inventory tracking (BOM uses stock codes only, read-only)
- Mobile app
- Accounting integration (Xero, QuickBooks)
- AI outline suggestion on photos
- Multiple scaffold system presets (one AUS preset only)
- Quote revision diff UI (Phase 2; JSON artifacts support it)

---

## 12. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Time to first quote (manual input) | < 10 minutes |
| Time to first quote (CSV + auto-wrap) | < 15 minutes |
| 3D scene load | < 3 s on desktop broadband |
| Quote export (PDF) | < 5 s |
| Derive pipeline (CLI) | < 10 s for demo-warehouse |
| Data retention | Projects retained until user deletes |
| Audit | Quote versions immutable; assumption log append-only |

---

## 13. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind | Desktop-first |
| 3D | React Three Fiber, drei, Three.js | Reuse Tekton viewer patterns |
| State | Zustand | Viewer + quote UI |
| DB (1B) | SQLite (dev) / Postgres (prod) via Drizzle ORM | Projects, users |
| Auth (1B) | Clerk or NextAuth | Can defer in 1A |
| Storage (1B) | S3 / Vercel Blob | Uploads + artifacts |
| PDF | `@react-pdf/renderer` or Puppeteer | Quote export |
| Pipeline | Node `.mjs` scripts (child processes) | Same as Tekton |

Phase 1A runs without DB — file-based projects only. Phase 1B adds DB as a metadata/index layer over the same file paths.

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AUS bay limits differ by duty rating | Wrong module counts | Start with general-duty 1576.6 tabulated limits; preset is data-driven |
| Module-level BOM too coarse for yard | Stock mismatch | Phase 3 expands modules to constituents; Phase 1 labels this clearly in UI |
| Photo heights inaccurate | Bad quotes | Deferred to 1B; confidence labels + assumption log when added |
| Static export → full app migration | Rework | Shared artifact contract; 1B wraps 1A without schema changes |
| Heritage regression | Broken demos | Additive-only changes; CI runs heritage derive + verify unchanged |
| Users expect BIM accuracy | Disappointment | "Scaffold-grade massing" messaging in UI |

---

## 15. Success Metrics (Phase 1)

| Metric | Target |
|---|---|
| Quotes generated per week (pilot) | 10+ |
| Time saved vs. spreadsheet | 50%+ (self-reported) |
| Assumption log in exported quotes | 100% |
| Verifier catch rate | Track overrides — tune rules |
| Heritage CI pass rate | 100% (no regressions) |

---

## 16. Implementation Order

```text
Phase 1A (Engine MVP)
  1. Scaffold system preset JSON + price list
  2. building-canonical schema + demo-warehouse data
  3. derive-building.mjs + building-spec
  4. scaffold-config schema + derive-scaffold.mjs
  5. verify-scaffold.mjs
  6. quote.mjs
  7. orchestrate-project.mjs + npm scripts
  8. BuildingViewer + ScaffoldViewer (R3F)
  9. QuotePanel + BOM highlight linking
  10. IngestForm (manual + CSV)
  11. PDF export
  12. CI: heritage unchanged + quoter derive/verify

Phase 1B (App Shell)
  13. Project dashboard + CRUD
  14. DB schema (Drizzle) + blob storage
  15. Full ingest workspace UI
  16. Photo trace tool
  17. Maps reference capture
  18. Auth (minimal)
```

---

*Next step after spec approval: implementation plan via writing-plans skill.*
