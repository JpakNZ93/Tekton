"use client";

import type { RenderableComponent } from "./SpecMesh";

interface ComponentInspectorProps {
  component: RenderableComponent | null;
  onClose?: () => void;
}

function geometryLabel(component: RenderableComponent): string {
  if (component.geometry.type === "cylinder") {
    return `Cylinder · r ${component.geometry.r ?? 0} m · h ${component.geometry.h ?? 0} m`;
  }
  return `Box · ${component.geometry.w ?? 0} × ${component.geometry.h ?? 0} × ${component.geometry.d ?? 0} m`;
}

export default function ComponentInspector({ component, onClose }: ComponentInspectorProps) {
  if (!component) return null;

  return (
    <aside className="rounded-lg border border-zinc-700 bg-zinc-900/95 p-4 text-sm text-zinc-100 backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-400">Selected component</p>
          <h3 className="text-base font-semibold">{component.name_en}</h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-zinc-500">ID</dt>
        <dd className="break-all">{component.id}</dd>

        <dt className="text-zinc-500">Category</dt>
        <dd>{component.category}</dd>

        <dt className="text-zinc-500">Provenance</dt>
        <dd className="capitalize">{component.provenance}</dd>

        <dt className="text-zinc-500">Geometry</dt>
        <dd>{geometryLabel(component)}</dd>

        <dt className="text-zinc-500">Position</dt>
        <dd>
          [{component.position.map((value) => value.toFixed(2)).join(", ")}]
        </dd>

        {component.face_id ? (
          <>
            <dt className="text-zinc-500">Face</dt>
            <dd>{component.face_id}</dd>
          </>
        ) : null}

        {typeof component.lift_index === "number" ? (
          <>
            <dt className="text-zinc-500">Lift</dt>
            <dd>{component.lift_index}</dd>
          </>
        ) : null}

        {component.stock_code ? (
          <>
            <dt className="text-zinc-500">Stock code</dt>
            <dd>{component.stock_code}</dd>
          </>
        ) : null}

        <dt className="text-zinc-500">Source</dt>
        <dd>{component.source}</dd>
      </dl>
    </aside>
  );
}
