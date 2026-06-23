# PRD: Scaffold Quoter

*Working title. Built on the Tekton evidence-based 3D reconstruction engine — repurposed for commercial scaffolding estimation.*

## 1. One-Line Pitch

**Scaffold Quoter ingests messy site data (CAD, photos, maps, dimensions, video), produces a confidence-labeled 3D building model, wraps a modular scaffold system onto it, and outputs a defensible bill of materials, labor estimate, and hire quote — with a path to stock management.**

## 2. Product Summary

Scaffolding contractors quote jobs from incomplete information: a phone photo, a PDF elevation, a Google Maps pin, a site visit video, or a partial CAD export. Estimators mentally translate that into tube counts, board runs, ties, access bays, erection/dismantle days, and hire duration — then pad for uncertainty. Spreadsheets and experience fill the gap; stock is checked separately; revisions are painful.

Scaffold Quoter makes the translation explicit, visual, and revisable:

1. **Ingest** site inputs into a canonical building model with per-dimension confidence.
2. **Reconstruct** a navigable 3D massing model good enough to scaffold against (not architectural BIM fidelity).
3. **Derive** scaffold geometry from rules (bay widths, lift heights, ties, guardrails, access).
4. **Estimate** stock, labor, hire charges, and margin — every line traceable to a rule or assumption.
5. **Export** a quote pack (PDF + BOM spreadsheet + 3D views) the estimator can defend to the client.

> We're not using AI to guess a quote in a black box. We're using it to make incomplete site data quotable — and to make every assumption wear a label.

### Relationship to Tekton

Tekton (this repo) already implements the reusable core:

```text
canonical JSON (sourced dimensions + provenance)
  → rule engine → structural-spec.json
  → procedural R3F viewer
  → verifier (geometry + screenshot gates)
```

Scaffold Quoter **reuses that pipeline** with different domain rules:

| Tekton (heritage) | Scaffold Quoter (commercial) |
|---|---|
| Historical construction rules (Yingzao Fashi) | Scaffold system rules (tube/coupler standards) |
| `measured / rule_derived / conjecture` | `surveyed / derived / assumed` confidence |
| Bracket sets, roof curves | Lifts, ledgers, transoms, ties, boards |
| Academic verifier (bay rhythm, fen ratios) | Commercial verifier (load class, tie spacing, access) |
| Static heritage demo | Per-project quotes with user accounts |

The heritage builds remain as reference implementations of the engine. New scaffold-specific code lives alongside, not as a rewrite.

## 3. Problem Statement

### For estimators

- **Inputs are heterogeneous.** One job arrives as DWG; the next is three iPhone photos and a WhatsApp voice note with heights.
- **Mental math doesn't scale.** Experienced estimators are fast but inconsistent; junior staff can't replicate their judgment.
- **Quotes lack audit trail.** When the client disputes a line item six weeks later, nobody remembers why 47 extra boards were added.
- **Stock is disconnected.** The quote assumes availability; the yard finds out after the job is won.

### For the business

- **Margin leakage.** Under-quoting from missed faces; over-quoting from blanket padding.
- **Revision cost.** Client changes scope → full re-estimate from scratch.
- **No productized IP.** Estimator knowledge walks out the door.

### What success looks like

An estimator uploads site data, gets a 3D model + scaffold overlay in under 15 minutes, adjusts two assumptions, and exports a quote where every BOM line links back to a visible scaffold component and a stated rule.

## 4. Target Users

| Persona | Role | Primary need |
|---|---|---|
| **Estimator** | Creates quotes | Fast, defensible BOM + labor from messy inputs |
| **Contracts manager** | Reviews and sends quotes | Confidence labels, revision history, PDF export |
| **Yard manager** *(Phase 3)* | Allocates stock | Reserved stock per won job, returns tracking |
| **Site supervisor** *(later)* | Validates on site | Mobile view of quoted scaffold vs. as-built |

**MVP focus:** Estimator + contracts manager on desktop.

## 5. User Experience

A browser-based project workspace. Narrative is bound to the 3D scene and quote panel, not a chat box.

### 5.1 Project lifecycle

```text
Create project → Ingest inputs → Review building model → Place/adjust scaffold
  → Review quote → Export → (later) Win job → Reserve stock
```

### 5.2 Core screens

**A. Project dashboard**
- List of projects: site name, address, status (draft / quoted / won / lost), last updated, total quote value.
- New project wizard: site name, address (Google Maps pin optional), scaffold system preset.

**B. Ingest workspace**
- Upload zone: CAD (DWG/DXF), images (JPG/PNG/HEIC), video (MP4), dimensional spreadsheet (CSV), manual dimension form.
- Maps panel: paste address or drop pin → satellite/street context image captured as reference (not auto-modeled in MVP).
- Ingest progress rail (reuses Tekton's stage-rail pattern): `Upload → Parse → Normalize → Canonical → Ready`.
- Per-input provenance card: what was extracted, confidence, gaps flagged.

**C. Building model viewer** *(reuses Tekton R3F viewer)*
- Orbit / pan / zoom around procedural building massing.
- Confidence layer toggle: surveyed (green), derived (amber), assumed (red) — same provenance UX as Tekton.
- Dimension inspector: click a face/edge → see source input and value.
- Manual override: drag a wall height, add a face, mark a zone "no scaffold needed."

**D. Scaffold designer**
- System preset selector (e.g. "Standard tube & fitting — 2.4 m lifts").
- Auto-wrap: one-click scaffold generation around selected building faces.
- Manual tools: add/remove lift, adjust bay width, insert access bay, hop-up, bridge, chimney stack.
- Scaffold builds in sequence (construction animation — reuses Tekton playback scrubber).
- Collision / rule warnings inline (e.g. tie spacing exceeds limit, missing guardrail).

**E. Quote panel** *(split view or tab alongside viewer)*
- **BOM table:** item code, description, qty, unit, unit cost, line total, derivation link.
- **Labor table:** task (erect, dismantle, adapt), crew size, days, rate, total.
- **Hire schedule:** duration weeks, rate, total.
- **Charges:** delivery, permits, consumables, margin %.
- **Confidence summary:** % of scaffold volume from surveyed vs. assumed dimensions.
- Export: PDF quote, CSV BOM, PNG views (plan, elevation, iso).

### 5.3 Signature interactions

1. **Click a BOM line → highlight scaffold components in 3D.** Every quantity is inspectable.
2. **Confidence layer on building AND scaffold.** Client sees what's solid vs. padded.
3. **Revision diff.** Change a wall height → quote panel shows delta (boards +12, labor +0.5 day).
4. **Assumption log.** Auto-generated prose: "North elevation height assumed at 8.2 m from single photo — recommend site measure."

## 6. Data Ingest — Inputs & Processing

### 6.1 Input types

| Input | MVP | Phase 2 | Extraction target |
|---|---|---|---|
| Manual dimensions | ✓ | | Height, width, depth, faces, setbacks |
| CSV / spreadsheet | ✓ | | Structured dimension table |
| Photos (elevation, context) | ✓ (semi-auto) | ✓ (auto) | Facade outline, approximate heights |
| Video (site walkaround) | | ✓ | Multi-face coverage, access constraints |
| CAD (DWG/DXF) | | ✓ | Wall lines, floor heights, openings |
| Google Maps / Street View | ✓ (reference only) | ✓ (scale assist) | Footprint, context, roof line hint |
| Point cloud / LiDAR | | ✓ (later) | Accurate envelope |

### 6.2 Canonical building schema

Extends Tekton's canonical JSON pattern. New file: `data/projects/<id>/building-canonical.json`.

```jsonc
{
  "meta": { "project_id", "site_name", "address", "coordinate", "created_at" },
  "units": { "length": "m" },
  "envelope": {
    "footprint": { "type": "polygon", "points": [[x,z], ...], "provenance", "source" },
    "faces": [
      {
        "id": "north-elevation",
        "bearing_deg": 0,
        "width_m": 12.4,
        "height_m": 8.2,
        "setbacks": [],
        "openings": [{ "type": "window", "x_m", "y_m", "w_m", "h_m }],
        "provenance": "assumed",
        "source": "photo-001.jpg",
        "confidence": 0.6
      }
    ]
  },
  "constraints": {
    "public_footpath_m": 1.2,
    "no_scaffold_zones": [],
    "access_notes": ""
  },
  "inputs": [
    { "type": "image", "file": "photo-001.jpg", "rights": "client_provided", "extracted_fields": ["north-elevation.height_m"] }
  ]
}
```

**Provenance classes (commercial):**

| Class | Meaning | UI color |
|---|---|---|
| `surveyed` | Measured on site or from trusted CAD | Green |
| `derived` | Computed from other surveyed values | Amber |
| `assumed` | Estimator or AI guess — must be visible | Red |

### 6.3 Ingest pipeline

Reuses Tekton orchestration phases, adapted:

```text
1 UPLOAD    → store raw files, virus scan, rights tag
2 PARSE     → format-specific extractors (see below)
3 NORMALIZE → merge extractions into canonical schema, resolve conflicts
4 VALIDATE  → ingest gate (every dimension has provenance; gaps preserved)
5 DERIVE    → building structural-spec.json (procedural massing)
6 VERIFY    → geometry checks + confidence audit
```

**MVP extractors:**
- **Manual form** → direct canonical write.
- **CSV** → column mapping UI.
- **Photos** → human-in-the-loop: user traces facade outline on image, enters scale reference (known door height, tape measure in photo). Optional AI assist suggests outline (Phase 1.5).
- **Maps** → geocode address, store satellite snapshot + metadata as reference attachment only.

**Phase 2 extractors:**
- **CAD** → DWG/DXF parser (lines, layers, blocks) → footprint + elevations.
- **Video** → frame sampling + structure-from-motion or depth model → multi-face heights.
- **Maps scale** → building footprint from satellite + estimated height from shadow/street view.

### 6.4 Conflict resolution

When two inputs disagree (photo says 8 m, CSV says 8.5 m):
- Canonical stores **both** with sources.
- UI surfaces conflict; user picks winner or averages.
- Quote carries the resolution in assumption log.
- Never silent overwrite (Tekton's measured-reality-wins guard, adapted: **user-chosen value wins, runner-up preserved**).

## 7. 3D Building Model

### 7.1 Fidelity target

**Scaffold-grade massing, not architectural BIM.**

Good enough to:
- Place scaffold lifts against each face.
- See setbacks, chimneys, overhangs, access constraints.
- Measure running lengths and counts.

Not required:
- Window detail, materials, MEP, interior rooms.
- Sub-50 mm accuracy (scaffold bays are ~2.4 m; 100 mm error is acceptable with confidence labeling).

### 7.2 Geometry derivation

New rule engine: `scripts/derive-building.mjs`

Input: `building-canonical.json`
Output: `artifacts/projects/<id>/building-spec.json`

Components:
- `footprint-slab` — ground plane polygon extruded to min height.
- `face-<id>` — each elevation as a box or extruded plane with openings as boolean cuts (MVP: openings as red markers, not geometry cuts).
- `feature-<id>` — chimneys, bays, dormers (manual or derived).
- `no-scaffold-zone-<id>` — exclusion volumes.

Reuses Tekton's procedural R3F renderer. Same `structural-spec.json` component schema (`id`, `geometry`, `position`, `provenance`, `source`).

### 7.3 Viewer features (inherited from Tekton)

- Orbit controls, click-to-inspect, provenance toggle.
- Construction sequence (footprint → faces → features).
- Screenshot export for quote PDF.
- Verifier HUD (optional, estimator-facing simplified).

## 8. Scaffold System

### 8.1 Scaffold presets

A **scaffold system** is a versioned ruleset — like Tekton's Yingzao Fashi, but for tube-and-fitting:

```jsonc
{
  "id": "standard-tube-2.4",
  "name": "Standard tube & fitting (2.4 m lifts)",
  "standards": ["BS EN 12811", "TG20:21"],
  "components": {
    "standard_length_m": [2.4, 3.0, 1.8],
    "ledger_spacing_m": 2.1,
    "transom_spacing_m": 1.2,
    "board_width_m": 0.225,
    "board_overlap": 4
  },
  "rules": {
    "max_lift_height_m": 2.4,
    "tie_spacing_vertical_m": 4.0,
    "tie_spacing_horizontal_m": 4.0,
    "guardrail_required": true,
    "toe_board_required": true
  },
  "stock_codes": {
    "tube-2.4": "TUB-240",
    "ledger": "LED-210",
    "board": "BD-225",
    "coupler": "CPL-STD"
  }
}
```

Ship with one preset in MVP. Admin UI for custom presets in Phase 2.

### 8.2 Scaffold derivation

New rule engine: `scripts/derive-scaffold.mjs`

Input: `building-spec.json` + `scaffold-config.json` (selected faces, system preset, overrides)
Output: `artifacts/projects/<id>/scaffold-spec.json`

**Auto-wrap algorithm (MVP):**
1. For each selected face, compute scaffold plane offset by `standoff_m` (default 0.3 m).
2. Divide face width into bays ≤ `ledger_spacing_m`.
3. Stack lifts until `face.height + extra_lift_m` (working platform above work zone).
4. Emit tubes, ledgers, transoms, boards, couplers, ties per rules.
5. Add access bay every N bays (configurable).
6. Tag every component: `{ stock_code, length_m, face_id, lift_index, provenance: "rule_derived", rule: "tie_spacing_vertical" }`.

**Manual overrides** stored in `scaffold-config.json` and replayed through derive — deterministic, not freehand mesh editing.

### 8.3 Scaffold viewer

Same R3F scene, second layer:
- Building (muted / wireframe when scaffold active).
- Scaffold tubes (steel grey), boards (timber), guardrails (highlight).
- Click scaffold member → stock code + length + parent face.
- Warning markers for rule violations.

### 8.4 Scaffold verifier

New: `scripts/verify-scaffold.mjs`

Checks (examples):
- V01: Every selected face has complete lift coverage.
- V02: Tie spacing within preset limits.
- V03: Guardrails on all working lifts.
- V04: Access bay within max horizontal distance.
- V05: No scaffold components in `no_scaffold_zones`.
- V06: BOM quantities match derived component counts (inventory integrity).
- V07: Zero components without stock code mapping.

Failures are **blocking for export** unless estimator explicitly overrides with logged reason.

## 9. Quoting & Estimation

### 9.1 Quote schema

`artifacts/projects/<id>/quote.json`

```jsonc
{
  "project_id": "...",
  "scaffold_system": "standard-tube-2.4",
  "bom": [
    { "stock_code": "TUB-240", "description": "Tube 2.4 m", "qty": 142, "unit": "each", "unit_cost": 12.50, "derivation": "scaffold-spec:tube-*" }
  ],
  "labor": [
    { "task": "erect", "crew": 3, "days": 4.5, "rate_per_day": 850, "rule": "3 men × 4.5 days @ 32 lifts/day capacity" }
  ],
  "hire": { "weeks": 8, "rate_per_week": 2400, "start_after": "erect_complete" },
  "charges": [
    { "type": "delivery", "amount": 350 },
    { "type": "margin", "percent": 15, "applied_to": "subtotal" }
  ],
  "totals": { "materials": 0, "labor": 0, "hire": 0, "charges": 0, "grand_total": 0 },
  "confidence": { "surveyed_pct": 0.4, "assumed_pct": 0.35, "derived_pct": 0.25 },
  "assumptions": ["North elevation height assumed 8.2 m from photo — not site measured."]
}
```

### 9.2 Estimation rules (MVP)

| Line | Rule |
|---|---|
| **Materials** | Sum scaffold-spec components × unit cost from price list |
| **Erect labor** | `total_lifts × factor / crew_daily_capacity` — factors configurable per system |
| **Dismantle labor** | Erect labor × 0.6 (default) |
| **Hire** | Weeks from project form × weekly hire rate (BOM subset marked `hireable`) |
| **Delivery** | Flat or distance-based (manual in MVP) |
| **Margin** | % on subtotal, configurable per project |

Price list: `data/price-list.json` (MVP: single tenant, file-based; Phase 2: per-org DB).

### 9.3 Quote export

- **PDF:** cover page, 3D iso + elevation screenshots, BOM table, labor, hire, assumptions, confidence summary, T&Cs placeholder.
- **CSV:** BOM for yard import.
- **JSON:** full quote artifact for revision diffing.

## 10. Phase Roadmap

### Phase 1 — Scaffold Quoter MVP

**Goal:** End-to-end quote from manual + photo + CSV inputs for a single-face/simple building.

| Area | Scope |
|---|---|
| Auth | Single-tenant, email magic link or simple password (or none for demo) |
| Projects | CRUD, status workflow |
| Ingest | Manual dimensions, CSV, photo trace tool, Maps reference capture |
| Building model | Procedural massing, provenance layer, manual overrides |
| Scaffold | One system preset, auto-wrap per face, manual add/remove lift |
| Quote | BOM + labor + hire + margin, PDF export |
| Verifier | Scaffold rule checks + BOM integrity |
| Stock | **Read-only** stock codes in BOM (no inventory tracking) |

**Out of scope:** CAD parser, video ingest, multi-tenant, mobile app, accounting integration.

### Phase 2 — Richer Ingest & Operations

- CAD (DWG/DXF) import.
- Video frame extraction + height assist.
- AI outline suggestion on photos (human approves).
- Google Maps footprint + height estimation assist.
- Multiple scaffold system presets.
- Custom price lists per customer.
- Quote revision history + diff.
- Email quote to client.

### Phase 3 — Stock Management

- Warehouse inventory: on-hand, reserved, on-hire, quarantine.
- Win job → reserve stock from quote BOM.
- Return processing, damage charges.
- Low-stock alerts.
- Basic purchase order suggestions.

### Phase 4 — Field & Integrations *(future)*

- Mobile site validation (AR overlay optional).
- Accounting export (Xero, QuickBooks).
- CRM hooks.
- Weather / permit calendar.

## 11. Technical Architecture

### 11.1 Two-plane model (inherited from Tekton)

```text
INGEST TIME (per project, may use AI assist)          RUNTIME (deployed app)
┌──────────────────────────────────────┐           ┌──────────────────────────────┐
│ raw uploads + maps ref               │           │ Next.js app                  │
│   → parse / normalize                │  emits    │   project workspace UI       │
│   → building-canonical.json          │  ───────► │   R3F viewer (building +     │
│   → derive-building.mjs              │ artifacts │     scaffold layers)         │
│   → derive-scaffold.mjs              │           │   quote panel + export       │
│   → verify-scaffold.mjs              │           │   auth + project DB          │
│   → quote.json                       │           │                              │
└──────────────────────────────────────┘           └──────────────────────────────┘
```

**MVP runtime:** Next.js App Router, TypeScript, Tailwind. Projects stored in DB (SQLite for local dev, Postgres for production). Artifacts stored in object storage or `data/projects/<id>/` for demo mode.

**MVP ingest:** Server actions or API routes trigger derive scripts (Node child processes — same pattern as Tekton's `npm run derive`). AI calls only in ingest assist paths, never in quote calculation.

### 11.2 Repository layout (additive)

```text
data/
  scaffold-systems/          # preset rule files
  price-list.json
  projects/<id>/
    building-canonical.json
    scaffold-config.json
    uploads/                 # raw files
artifacts/projects/<id>/
  building-spec.json
  scaffold-spec.json
  quote.json
  verifier-report.json
scripts/
  derive-building.mjs        # NEW
  derive-scaffold.mjs        # NEW
  verify-scaffold.mjs        # NEW
  quote.mjs                  # NEW
  orchestrate-project.mjs    # per-project pipeline
components/
  ProjectWorkspace.tsx       # NEW
  BuildingViewer.tsx         # fork/adapt CathedralViewer
  ScaffoldViewer.tsx         # NEW
  QuotePanel.tsx             # NEW
  IngestWorkspace.tsx        # NEW
app/
  projects/                  # NEW routes
```

Heritage Tekton routes (`/`, Nanchan, Notre-Dame) remain untouched as engine demos.

### 11.3 Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind | Desktop-first |
| 3D | React Three Fiber, drei, Three.js | Reuse Tekton viewer patterns |
| State | Zustand | Viewer + quote UI |
| DB | Postgres (prod), SQLite (dev) via Drizzle ORM | Projects, users, quotes |
| Auth | Clerk or NextAuth | Phase 1 can defer |
| Storage | S3 / Vercel Blob | Uploads + artifact blobs |
| PDF | `@react-pdf/renderer` or Puppeteer | Quote export |
| CAD *(Ph2)* | `dxf-parser` / cloud converter | DWG → DXF first |
| AI assist *(Ph1.5+)* | Vision model for outline suggest | Human-in-the-loop only |

### 11.4 Determinism principle

**Quote numbers must be reproducible.** Given the same `building-canonical.json` + `scaffold-config.json` + `price-list.json`, derive scripts always emit identical `quote.json`. AI may suggest canonical field values, but only **committed** canonical data enters the derive chain — same discipline as Tekton's frozen artifacts.

## 12. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Time to first quote (MVP, manual input) | < 10 minutes |
| Time to first quote (photo + auto-wrap) | < 20 minutes |
| 3D scene load | < 3 s on desktop broadband |
| Quote export | < 5 s |
| Uptime | 99.5% (production) |
| Data retention | Projects retained until user deletes; GDPR delete on request |
| Audit | Every quote version immutable; assumption log append-only |

## 13. MVP Definition of Done

1. Estimator can create a project, enter manual dimensions for a rectangular building (4 faces), and see a 3D massing model.
2. Estimator can auto-wrap scaffold on 2+ faces and see scaffold in 3D.
3. Quote panel shows BOM, labor, hire, margin with grand total.
4. Clicking a BOM line highlights scaffold components in the viewer.
5. Confidence layer shows assumed vs. surveyed dimensions.
6. Verifier runs and blocks export on critical scaffold rule failures.
7. PDF quote exports with 3D screenshot, BOM, and assumptions.
8. All derive steps are script-driven and reproducible from canonical JSON.
9. Heritage Tekton demos still build and deploy unchanged.

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Photo-based heights inaccurate | Bad quotes, lost margin | Confidence labels, assumption log, verifier warnings, human override |
| CAD parsing complexity | Phase 2 delay | MVP skips CAD; manual + CSV sufficient for first customers |
| Scaffold rules vary by region | Wrong BOM | Versioned presets; start with one UK/EU standard; make rules data-driven |
| Users expect BIM accuracy | Disappointment | Clear fidelity messaging; "scaffold-grade massing" in UI |
| AI hallucination in ingest | Bad dimensions | AI suggests only; human commits to canonical; derive never calls LLM |
| Stock module scope creep | MVP never ships | Phase 1 BOM only; stock codes without inventory |

## 15. Open Questions

1. **Geography / standards** — UK (TG20:21) first, or another market?
2. **Scaffold types** — tube & fitting only, or also system scaffold (Layher, Haki)?
3. **Pricing model** — SaaS per seat, per quote, or one-time license?
4. **Tenant model** — single company internal tool, or multi-tenant SaaS from day one?
5. **Integration priority** — which accounting/ERP system matters first?

## 16. Success Metrics

| Metric | Phase 1 target |
|---|---|
| Quotes generated per week | 10+ (pilot customer) |
| Time saved vs. spreadsheet | 50%+ (self-reported) |
| Quote revision rate | < 30% require full re-estimate |
| Assumption log usage | 100% of exported quotes include log |
| Verifier catch rate | Track overrides — tune rules |

---

*Next step after PRD approval: design spec (`docs/superpowers/specs/`) → implementation plan → Phase 1 build.*
