import { create } from "zustand";

export interface QuoterState {
  projectId: string;
  canonical: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  preset: Record<string, unknown> | null;
  priceList: Record<string, unknown> | null;
  buildingSpec: Record<string, unknown> | null;
  scaffoldSpec: Record<string, unknown> | null;
  quote: Record<string, unknown> | null;
  report: Record<string, unknown> | null;
  highlightStockCode: string | null;
  selectedModuleId: string | null;
  activeTab: "dimensions" | "scaffold" | "quote";
  loading: boolean;
  error: string | null;
  loadProject: (projectId: string) => Promise<void>;
  rederive: () => Promise<void>;
  setCanonical: (canonical: Record<string, unknown>) => void;
  setConfig: (config: Record<string, unknown>) => void;
  setActiveTab: (tab: "dimensions" | "scaffold" | "quote") => void;
  highlightBom: (stockCode: string | null) => void;
  selectModule: (moduleId: string | null) => void;
  toggleFace: (faceId: string) => void;
  replaceBayModule: (faceId: string, bayIndex: number, module: string) => void;
  removeLift: (faceId: string, liftIndex: number) => void;
}

async function fetchJson(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

export const useQuoterStore = create<QuoterState>((set, get) => ({
  projectId: "demo-warehouse",
  canonical: null,
  config: null,
  preset: null,
  priceList: null,
  buildingSpec: null,
  scaffoldSpec: null,
  quote: null,
  report: null,
  highlightStockCode: null,
  selectedModuleId: null,
  activeTab: "dimensions",
  loading: false,
  error: null,

  loadProject: async (projectId) => {
    set({ loading: true, error: null, projectId });
    try {
      const base = `/projects/${projectId}`;
      const [buildingSpec, scaffoldSpec, quote, report] = await Promise.all([
        fetchJson(`${base}/building-spec.json`),
        fetchJson(`${base}/scaffold-spec.json`),
        fetchJson(`${base}/quote.json`),
        fetchJson(`${base}/verifier-report.json`),
      ]);
      const canonicalRes = await fetch(`/data/projects/${projectId}/building-canonical.json`).catch(() => null);
      const configRes = await fetch(`/data/projects/${projectId}/scaffold-config.json`).catch(() => null);
      let canonical = null;
      let config = null;
      if (canonicalRes?.ok) canonical = await canonicalRes.json();
      if (configRes?.ok) config = await configRes.json();
      if (!canonical) {
        canonical = {
          meta: { project_id: projectId, site_name: projectId },
          envelope: { footprint: { points: [[0, 0], [12, 0], [12, 8], [0, 8]], provenance: "surveyed", source: "default" }, faces: [] },
        };
      }
      if (!config) {
        config = { system_id: "aus-modular-2.0x2.4", selected_faces: ["north", "east", "west"], standoff_m: 0.3, overrides: [] };
      }
      const [preset, priceList] = await Promise.all([
        fetchJson("/data/scaffold-systems/aus-modular-2.0x2.4.json"),
        fetchJson("/data/price-list.json"),
      ]);
      set({
        canonical,
        config,
        preset,
        priceList,
        buildingSpec,
        scaffoldSpec,
        quote,
        report,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Load failed" });
    }
  },

  rederive: async () => {
    const { canonical, config, preset, priceList } = get();
    if (!canonical || !config || !preset || !priceList) return;
    set({ loading: true, error: null });
    try {
      const { runProjectPipeline } = await import("../lib/quoter/pipeline.mjs");
      const result = runProjectPipeline(canonical, config, preset, priceList);
      set({
        buildingSpec: result.buildingSpec,
        scaffoldSpec: result.scaffoldSpec,
        quote: result.quote,
        report: result.report,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Derive failed" });
    }
  },

  setCanonical: (canonical) => set({ canonical }),
  setConfig: (config) => set({ config }),
  setActiveTab: (activeTab) => set({ activeTab }),

  highlightBom: (highlightStockCode) => set({ highlightStockCode, selectedModuleId: null }),

  selectModule: (selectedModuleId) => {
    const { scaffoldSpec } = get();
    const mod = (scaffoldSpec as { modules?: { id: string; stock_code: string }[] })?.modules?.find(
      (m) => m.id === selectedModuleId
    );
    set({ selectedModuleId, highlightStockCode: mod?.stock_code ?? null });
  },

  toggleFace: (faceId) => {
    const config = structuredClone(get().config) as {
      selected_faces: string[];
      overrides: unknown[];
    };
    const set_ = new Set(config.selected_faces);
    if (set_.has(faceId)) set_.delete(faceId);
    else set_.add(faceId);
    config.selected_faces = [...set_];
    set({ config });
    get().rederive();
  },

  replaceBayModule: (faceId, bayIndex, module) => {
    const config = structuredClone(get().config) as {
      overrides: { face_id: string; bay_index: number; action: string; module: string; reason?: string }[];
    };
    config.overrides = config.overrides.filter(
      (o) => !(o.face_id === faceId && o.bay_index === bayIndex && o.action === "replace")
    );
    config.overrides.push({
      face_id: faceId,
      bay_index: bayIndex,
      action: "replace",
      module,
      reason: `Bay ${bayIndex} on ${faceId} set to ${module}`,
    });
    set({ config });
    get().rederive();
  },

  removeLift: (faceId, liftIndex) => {
    const config = structuredClone(get().config) as {
      overrides: { face_id: string; lift_index: number; action: string }[];
    };
    config.overrides.push({ face_id: faceId, lift_index: liftIndex, action: "remove" });
    set({ config });
    get().rederive();
  },
}));
