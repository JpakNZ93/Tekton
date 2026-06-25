# Scaffold Quoter Phase 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Engine MVP — file-based project pipeline from building canonical JSON through AUS modular scaffold derivation to quote + verifier, with a `/quoter` workspace UI reading the same shared derive logic in-browser.

**Architecture:** Shared pure functions live in `lib/quoter/` (no filesystem). Node scripts in `scripts/` read/write JSON artifacts. React workspace imports the same lib for client-side re-derive. Heritage demos remain untouched. Static Next.js export preserved; demo-warehouse artifacts committed under `public/projects/demo-warehouse/`.

**Tech Stack:** Node ESM, Next.js 15, React 19, R3F, Zustand, Tailwind 4, Node built-in test runner (`node --test`).

**Spec reference:** `docs/superpowers/specs/2026-06-25-scaffold-quoter-phase1-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `lib/quoter/comp.mjs` | Provenance audit gate for quoter components |
| `lib/quoter/derive-building.mjs` | Canonical → building-spec |
| `lib/quoter/derive-scaffold.mjs` | building-spec + config + preset → scaffold-spec |
| `lib/quoter/verify-scaffold.mjs` | scaffold-spec checks → report |
| `lib/quoter/quote.mjs` | scaffold-spec + price-list → quote |
| `lib/quoter/csv-ingest.mjs` | CSV string → canonical patch |
| `scripts/orchestrate-project.mjs` | CLI pipeline wrapper |
| `scripts/project-test.mjs` | Integration tests via node:test |
| `data/scaffold-systems/aus-modular-2.0x2.4.json` | AUS preset |
| `data/price-list.json` | Unit costs |
| `data/projects/demo-warehouse/*` | Sample project inputs |
| `public/projects/demo-warehouse/*` | Committed artifacts for static export |
| `components/quoter/*` | Workspace UI |
| `app/quoter/page.tsx` | Quoter route |
| `store/quoter-store.ts` | Zustand state |

---

### Task 1: Foundation data files

**Files:**
- Create: `data/scaffold-systems/aus-modular-2.0x2.4.json`
- Create: `data/price-list.json`
- Create: `data/projects/demo-warehouse/building-canonical.json`
- Create: `data/projects/demo-warehouse/scaffold-config.json`
- Create: `data/projects/demo-warehouse/uploads/dimensions.csv`

- [ ] **Step 1: Create AUS scaffold preset**

Create `data/scaffold-systems/aus-modular-2.0x2.4.json` with lift 2.0 m, max bay 2.4 m, module catalog (MOD-STD, MOD-ACC, MOD-CRN, MOD-HOP, MOD-TIE-KIT, MOD-GRD-LIFT), stock codes, tie/guardrail rules per spec §4.

- [ ] **Step 2: Create price list**

Create `data/price-list.json` with unit costs for each stock code, labor defaults (crew 3, rate 850/day, dismantle factor 0.6), hire rate 2400/week, delivery 350, default margin 15%.

- [ ] **Step 3: Create demo-warehouse canonical + config + CSV**

12×8 m footprint, 6.5 m faces, north door opening, mixed surveyed/assumed provenance. Default scaffold on north/east/west with one override (access bay on east).

- [ ] **Step 4: Commit**

```bash
git add data/scaffold-systems data/price-list.json data/projects/demo-warehouse
git commit -m "feat(quoter): add AUS preset, price list, demo-warehouse project data"
```

---

### Task 2: Shared comp audit gate

**Files:**
- Create: `lib/quoter/comp.mjs`
- Create: `lib/quoter/constants.mjs`

- [ ] **Step 1: Write failing test**

Create `scripts/project-test.mjs` with:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createComp } from "../lib/quoter/comp.mjs";

test("comp throws on missing provenance", () => {
  const comp = createComp([]);
  assert.throws(() => comp({ id: "x", provenance: "", source: "manual" }));
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node --test scripts/project-test.mjs`
Expected: FAIL module not found

- [ ] **Step 3: Implement comp.mjs**

```javascript
const VALID = new Set(["surveyed", "derived", "assumed", "rule_derived"]);

export function createComp(components) {
  let seq = 0;
  return function comp(c) {
    if (!c.provenance || !c.source) throw new Error(`UNSOURCED: ${c.id}`);
    if (!VALID.has(c.provenance)) throw new Error(`INVALID PROVENANCE: ${c.id}`);
    const out = { ...c, seq: seq++ };
    components.push(out);
    return out;
  };
}
```

Export `PROVENANCE_COLORS` from constants.mjs: surveyed `#3d9970`, derived `#d4a017`, assumed `#c0392b`, rule_derived `#5e6ca8`.

- [ ] **Step 4: Run test — expect PASS**

Run: `node --test scripts/project-test.mjs`

- [ ] **Step 5: Commit**

```bash
git add lib/quoter scripts/project-test.mjs
git commit -m "feat(quoter): add comp audit gate with tests"
```

---

### Task 3: derive-building

**Files:**
- Create: `lib/quoter/derive-building.mjs`
- Modify: `scripts/project-test.mjs`

- [ ] **Step 1: Write failing test**

Add to `scripts/project-test.mjs`:

```javascript
import { deriveBuilding } from "../lib/quoter/derive-building.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = JSON.parse(readFileSync(join(ROOT, "data/projects/demo-warehouse/building-canonical.json"), "utf8"));

test("deriveBuilding emits footprint and 4 faces", () => {
  const spec = deriveBuilding(canonical);
  assert.ok(spec.components.find((c) => c.id === "footprint-slab"));
  assert.equal(spec.components.filter((c) => c.id.startsWith("face-")).length, 4);
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement derive-building.mjs**

Export `deriveBuilding(canonical)` returning `{ meta, units, provenance_colors, phases, components }`:
- `footprint-slab` box from polygon bounds
- `face-<id>` box per face positioned by `bearing_deg`
- Opening markers as red boxes (`opening-<face>-<n>`)
- All components via `createComp`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/quoter/derive-building.mjs scripts/project-test.mjs
git commit -m "feat(quoter): add derive-building"
```

---

### Task 4: derive-scaffold

**Files:**
- Create: `lib/quoter/derive-scaffold.mjs`
- Modify: `scripts/project-test.mjs`

- [ ] **Step 1: Write failing test**

```javascript
test("deriveScaffold emits modules for selected faces", () => {
  const buildingSpec = deriveBuilding(canonical);
  const config = JSON.parse(readFileSync(join(ROOT, "data/projects/demo-warehouse/scaffold-config.json"), "utf8"));
  const preset = JSON.parse(readFileSync(join(ROOT, "data/scaffold-systems/aus-modular-2.0x2.4.json"), "utf8"));
  const scaffold = deriveScaffold(buildingSpec, config, preset);
  assert.ok(scaffold.modules.length > 0);
  assert.ok(scaffold.modules.every((m) => m.stock_code));
  assert.ok(scaffold.components.some((c) => c.render_only === true));
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement derive-scaffold.mjs**

Auto-wrap algorithm per spec §6.3:
1. Bay division ≤ 2.4 m
2. Lift stacking 2.0 m
3. Corner/access/hop-up modules
4. Apply overrides
5. Expand detail templates (cylinders/boxes) with `render_only: true`

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 5: verify-scaffold + quote

**Files:**
- Create: `lib/quoter/verify-scaffold.mjs`
- Create: `lib/quoter/quote.mjs`
- Modify: `scripts/project-test.mjs`

- [ ] **Step 1: Write failing tests**

Tests for verify (returns pass + checks array) and quote (bom qty matches module count, grand_total > 0).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement verify-scaffold.mjs**

Checks V01–V09 per spec §6.4. Return `{ passed, checks: [{ id, name, pass, severity }] }`.

- [ ] **Step 4: Implement quote.mjs**

Aggregate modules → BOM, labor from module count, hire, charges, confidence from face provenance, assumptions array.

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

---

### Task 6: Orchestrator + npm scripts

**Files:**
- Create: `scripts/orchestrate-project.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement orchestrate-project.mjs**

```javascript
// Usage: node scripts/orchestrate-project.mjs demo-warehouse
// Writes artifacts/projects/<id>/ and copies to public/projects/<id>/
```

Pipeline: load → derive building → derive scaffold → verify → quote → write JSON files.

- [ ] **Step 2: Add npm scripts**

```json
"project:derive": "node scripts/orchestrate-project.mjs",
"project:test": "node --test scripts/project-test.mjs",
"build:quoter": "node scripts/orchestrate-project.mjs demo-warehouse"
```

- [ ] **Step 3: Run derive**

Run: `npm run project:derive demo-warehouse`
Expected: artifacts written, exit 0

- [ ] **Step 4: Run tests**

Run: `npm run project:test`
Expected: all pass

- [ ] **Step 5: Commit artifacts + scripts**

```bash
git add scripts/orchestrate-project.mjs artifacts/projects public/projects package.json
git commit -m "feat(quoter): add orchestrate-project pipeline"
```

---

### Task 7: Zustand store + CSV ingest

**Files:**
- Create: `lib/quoter/csv-ingest.mjs`
- Create: `store/quoter-store.ts`

- [ ] **Step 1: Implement csv-ingest.mjs**

Parse CSV rows with columns `face_id,width_m,height_m,bearing_deg,provenance` into canonical face patches.

- [ ] **Step 2: Implement quoter-store.ts**

State: `projectId`, `canonical`, `config`, `buildingSpec`, `scaffoldSpec`, `quote`, `report`, `selectedModuleId`, `highlightStockCode`.

Actions: `loadProject`, `setCanonical`, `setConfig`, `rederive` (imports lib/quoter functions client-side), `selectBomLine`.

- [ ] **Step 3: Commit**

---

### Task 8: BuildingViewer + ScaffoldViewer

**Files:**
- Create: `components/quoter/Member.tsx`
- Create: `components/quoter/BuildingViewer.tsx`
- Create: `components/quoter/ScaffoldLayer.tsx`

- [ ] **Step 1: Member.tsx**

Fork procedural geometry from CathedralViewer (box, cylinder). Provenance colors from quoter constants.

- [ ] **Step 2: BuildingViewer.tsx**

R3F canvas, orbit controls, provenance toggle, click-to-inspect building components.

- [ ] **Step 3: ScaffoldLayer.tsx**

Render modules (steel) + render_only detail. Click module → store.selectModule. Highlight when `highlightStockCode` matches.

- [ ] **Step 4: Commit**

---

### Task 9: QuotePanel + IngestForm + ProjectWorkspace

**Files:**
- Create: `components/quoter/QuotePanel.tsx`
- Create: `components/quoter/IngestForm.tsx`
- Create: `components/quoter/ScaffoldEditor.tsx`
- Create: `components/quoter/ProjectWorkspace.tsx`

- [ ] **Step 1: QuotePanel**

BOM/labor/hire tables. Row click → `highlightStockCode`. Confidence summary. Assumption log. Export JSON button.

- [ ] **Step 2: IngestForm**

Manual fields for footprint + 4 faces. CSV file input → csv-ingest → update canonical → rederive.

- [ ] **Step 3: ScaffoldEditor**

Face checkboxes, auto-wrap toggle, override buttons (replace bay with access, remove lift).

- [ ] **Step 4: ProjectWorkspace**

Split layout 60/40, tabs: Dimensions | Scaffold | Quote.

- [ ] **Step 5: Commit**

---

### Task 10: Quoter route + nav link

**Files:**
- Create: `app/quoter/page.tsx`
- Modify: `components/BuildingRouter.tsx` (add link to /quoter, do not remove heritage)

- [ ] **Step 1: Create app/quoter/page.tsx**

Dynamic import ProjectWorkspace, default project demo-warehouse.

- [ ] **Step 2: Add nav link**

Small "Scaffold Quoter →" link in BuildingRouter header without changing heritage selector behavior.

- [ ] **Step 3: Verify dev server**

Run: `npm run build:quoter && npm run build`
Expected: build succeeds, heritage + quoter routes work

- [ ] **Step 4: Commit**

---

### Task 11: PDF export

**Files:**
- Create: `lib/quoter/export-quote-pdf.mjs`
- Modify: `components/quoter/QuotePanel.tsx`

- [ ] **Step 1: Implement export-quote-pdf.mjs**

Generate printable HTML string from quote JSON (cover, BOM table, labor, assumptions). Browser opens print dialog / downloads HTML.

- [ ] **Step 2: Wire Export PDF button**

Client-side only (no Puppeteer in static export).

- [ ] **Step 3: Commit**

---

### Task 12: Heritage regression check

**Files:**
- Modify: `package.json` (optional `build:heritage` script unchanged)

- [ ] **Step 1: Run heritage build**

Run: `npm run derive && npm run verify && npm run build`
Expected: exit 0, no changes to heritage artifacts

- [ ] **Step 2: Run quoter tests + derive**

Run: `npm run project:test && npm run project:derive demo-warehouse`
Expected: exit 0

- [ ] **Step 3: Final commit + update plan checkboxes**

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| AUS modular preset | 1 |
| demo-warehouse sample | 1 |
| building-canonical schema | 1, 7 |
| derive-building | 3 |
| derive-scaffold + editable config | 4, 9 |
| verify-scaffold V01–V09 | 5 |
| quote.json | 5 |
| orchestrate CLI | 6 |
| 3D viewer + provenance | 8 |
| BOM highlight | 8, 9 |
| Manual + CSV ingest | 7, 9 |
| PDF export | 11 |
| Heritage unchanged | 12 |
| DoD #1–12 | All tasks |

## Self-review

- No TBD/TODO placeholders in plan
- Shared lib avoids static-export server dependency
- Type/property names consistent: `scaffold-config.json` uses `working_lift_extra_m`, `selected_faces`, `overrides`
- Phase 1B (DB, photo trace) explicitly out of scope
