"use client";

import { useEffect, useMemo, useState } from "react";
import type { StructuralSpec } from "../../lib/tekton-spec";
import { useQuoteStore } from "../../lib/stores/quote-store";
import ComponentInspector from "./ComponentInspector";
import ProceduralScene from "./ProceduralScene";
import type { RenderableComponent } from "./SpecMesh";

interface ScaffoldConfig {
  project_id: string;
  system_id: string;
  selected_faces: string[];
  standoff_m: number;
  extra_lift_m: number;
  access_bay_every_n: number;
  overrides: unknown[];
}

interface BuildingCanonical {
  envelope: {
    faces: Array<{ id: string }>;
  };
}

interface ScaffoldDesignerProps {
  projectId: string;
}

export default function ScaffoldDesigner({ projectId }: ScaffoldDesignerProps) {
  const [buildingSpec, setBuildingSpec] = useState<StructuralSpec | null>(null);
  const [scaffoldSpec, setScaffoldSpec] = useState<StructuralSpec | null>(null);
  const [canonical, setCanonical] = useState<BuildingCanonical | null>(null);
  const [config, setConfig] = useState<ScaffoldConfig | null>(null);
  const [selected, setSelected] = useState<RenderableComponent | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provenanceVisible = useQuoteStore((state) => state.provenanceVisible);
  const toggleProvenance = useQuoteStore((state) => state.toggleProvenance);
  const highlightIds = useQuoteStore((state) => state.highlightIds);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [buildingResponse, scaffoldResponse, configResponse, canonicalResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/building-spec`),
        fetch(`/api/projects/${projectId}/scaffold-spec`),
        fetch(`/api/projects/${projectId}/scaffold-config`),
        fetch(`/api/projects/${projectId}/building-canonical`),
      ]);

      if (!buildingResponse.ok) {
        throw new Error("Building spec not found. Save ingest data and run pipeline first.");
      }

      const buildingData = (await buildingResponse.json()) as StructuralSpec;
      const configData = configResponse.ok ? ((await configResponse.json()) as ScaffoldConfig) : null;
      const canonicalData = canonicalResponse.ok
        ? ((await canonicalResponse.json()) as BuildingCanonical)
        : null;

      setBuildingSpec(buildingData);
      setConfig(configData);
      setCanonical(canonicalData);

      if (scaffoldResponse.ok) {
        const scaffoldData = (await scaffoldResponse.json()) as StructuralSpec;
        setScaffoldSpec(scaffoldData);
      } else {
        setScaffoldSpec(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const faceIds = useMemo(() => canonical?.envelope.faces.map((face) => face.id) ?? [], [canonical]);

  const toggleFace = (faceId: string) => {
    if (!config) return;
    const selectedFaces = config.selected_faces.includes(faceId)
      ? config.selected_faces.filter((value) => value !== faceId)
      : [...config.selected_faces, faceId];
    setConfig({ ...config, selected_faces: selectedFaces });
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/scaffold-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to save scaffold configuration.");
      }
      const saved = (await response.json()) as ScaffoldConfig;
      setConfig(saved);
      setStatus("Scaffold configuration saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const autoWrap = async () => {
    setRunning(true);
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/derive`, { method: "POST" });
      if (!response.ok) throw new Error("Pipeline derive failed.");
      setStatus("Pipeline complete. Scaffold spec refreshed.");
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const combinedComponents = useMemo(() => {
    const building = (buildingSpec?.components ?? []).map(
      (component) =>
        ({
          ...component,
          renderOpacity: 0.35,
          renderLayer: "building",
        }) satisfies RenderableComponent,
    );
    const scaffold = (scaffoldSpec?.components ?? []).map(
      (component) =>
        ({
          ...component,
          renderOpacity: 1,
          renderLayer: "scaffold",
        }) satisfies RenderableComponent,
    );
    return [...building, ...scaffold];
  }, [buildingSpec, scaffoldSpec]);

  const provenanceColors = scaffoldSpec?.provenance_colors ?? buildingSpec?.provenance_colors ?? {};

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Scaffold designer</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Auto-wrap and inspect scaffold geometry</h1>
          <p className="text-sm text-zinc-400">
            Building layer is rendered at 35% opacity beneath derived scaffold components.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleProvenance}
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          {provenanceVisible ? "Show material colors" : "Show provenance colors"}
        </button>
      </header>

      <section className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <p className="text-sm text-zinc-300">Faces to scaffold</p>
          <div className="flex flex-wrap gap-3">
            {faceIds.map((faceId) => (
              <label key={faceId} className="inline-flex items-center gap-2 rounded border border-zinc-700 px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={config?.selected_faces.includes(faceId) ?? false}
                  onChange={() => toggleFace(faceId)}
                />
                <span className="capitalize">{faceId}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">
              Standoff: {config?.standoff_m ?? "—"} m
            </span>
            <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">
              Extra lift: {config?.extra_lift_m ?? "—"} m
            </span>
            <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">
              Access every {config?.access_bay_every_n ?? "—"} bays
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={saveConfig}
            disabled={!config || saving}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save config"}
          </button>
          <button
            type="button"
            onClick={autoWrap}
            disabled={running}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {running ? "Running…" : "Auto-wrap"}
          </button>
        </div>
      </section>

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {loading ? <p className="text-sm text-zinc-400">Loading scaffold workspace…</p> : null}

      {!loading && buildingSpec ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[68vh]">
            <ProceduralScene
              components={combinedComponents}
              provenanceVisible={provenanceVisible}
              provenanceColors={provenanceColors}
              highlightIds={highlightIds}
              onSelect={setSelected}
            />
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
              <p>Building components: {buildingSpec.components.length}</p>
              <p>Scaffold components: {scaffoldSpec?.components.length ?? 0}</p>
              <p>Highlighted by quote rows: {highlightIds.length}</p>
            </div>
            <ComponentInspector component={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
