"use client";

import { useEffect, useState } from "react";
import type { StructuralSpec } from "../../lib/tekton-spec";
import { useQuoteStore } from "../../lib/stores/quote-store";
import ComponentInspector from "./ComponentInspector";
import ProceduralScene from "./ProceduralScene";
import type { RenderableComponent } from "./SpecMesh";

interface BuildingViewerProps {
  projectId: string;
}

export default function BuildingViewer({ projectId }: BuildingViewerProps) {
  const [spec, setSpec] = useState<StructuralSpec | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<RenderableComponent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const provenanceVisible = useQuoteStore((state) => state.provenanceVisible);
  const toggleProvenance = useQuoteStore((state) => state.toggleProvenance);
  const highlightIds = useQuoteStore((state) => state.highlightIds);

  useEffect(() => {
    let active = true;
    const loadSpec = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/building-spec`);
        if (!response.ok) {
          throw new Error(`Building spec unavailable (${response.status}). Run the pipeline first.`);
        }
        const data = (await response.json()) as StructuralSpec;
        if (active) setSpec(data);
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadSpec();
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Building viewer</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Procedural building spec</h1>
          <p className="text-sm text-zinc-400">
            Building components from <code>building-spec.json</code> with provenance overlays.
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

      {loading ? <p className="text-sm text-zinc-400">Loading building model…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {spec ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[68vh]">
            <ProceduralScene
              components={spec.components}
              provenanceVisible={provenanceVisible}
              provenanceColors={spec.provenance_colors}
              highlightIds={highlightIds}
              onSelect={setSelectedComponent}
            />
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-300">
              <p>Components: {spec.components.length}</p>
              <p>Phases: {spec.phases.join(", ")}</p>
            </div>
            <ComponentInspector component={selectedComponent} onClose={() => setSelectedComponent(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
