"use client";

import { FormEvent, useEffect, useState } from "react";

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
      type: "rectangle";
      width_m: number;
      depth_m: number;
      provenance: Provenance;
      source: string;
    };
    faces: Array<{
      id: "north" | "south" | "east" | "west";
      bearing_deg: number;
      width_m: number;
      height_m: number;
      provenance: Provenance;
      source: string;
      confidence: number;
    }>;
  };
  constraints: {
    public_footpath_m: number;
    no_scaffold_zones: unknown[];
    access_notes: string;
  };
  inputs: unknown[];
}

interface IngestFormProps {
  projectId: string;
}

function confidenceFromProvenance(provenance: Provenance): number {
  if (provenance === "surveyed") return 1;
  if (provenance === "derived") return 0.7;
  return 0.45;
}

export default function IngestForm({ projectId }: IngestFormProps) {
  const [canonical, setCanonical] = useState<BuildingCanonical | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [footprintWidth, setFootprintWidth] = useState("20");
  const [footprintDepth, setFootprintDepth] = useState("12");
  const [northHeight, setNorthHeight] = useState("8");
  const [southHeight, setSouthHeight] = useState("8");
  const [eastHeight, setEastHeight] = useState("8");
  const [westHeight, setWestHeight] = useState("8");
  const [provenance, setProvenance] = useState<Provenance>("surveyed");
  const [publicFootpath, setPublicFootpath] = useState("1.2");
  const [source, setSource] = useState("manual-form");

  useEffect(() => {
    let active = true;
    const loadCanonical = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/building-canonical`);
        if (!response.ok) {
          throw new Error(`Failed to load canonical building data (${response.status})`);
        }
        const data = (await response.json()) as BuildingCanonical;
        if (!active) return;
        setCanonical(data);
        setSiteName(data.meta.site_name ?? "");
        setAddress(data.meta.address ?? "");
        setFootprintWidth(String(data.envelope.footprint.width_m ?? 20));
        setFootprintDepth(String(data.envelope.footprint.depth_m ?? 12));
        setPublicFootpath(String(data.constraints.public_footpath_m ?? 1.2));
        setSource(data.envelope.footprint.source || "manual-form");
        setProvenance(data.envelope.footprint.provenance ?? "surveyed");

        const faceMap = Object.fromEntries(data.envelope.faces.map((face) => [face.id, face]));
        setNorthHeight(String(faceMap.north?.height_m ?? 8));
        setSouthHeight(String(faceMap.south?.height_m ?? 8));
        setEastHeight(String(faceMap.east?.height_m ?? 8));
        setWestHeight(String(faceMap.west?.height_m ?? 8));
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadCanonical();
    return () => {
      active = false;
    };
  }, [projectId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canonical) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const width = Number(footprintWidth);
    const depth = Number(footprintDepth);
    const nHeight = Number(northHeight);
    const sHeight = Number(southHeight);
    const eHeight = Number(eastHeight);
    const wHeight = Number(westHeight);
    const footpath = Number(publicFootpath);

    const nextCanonical: BuildingCanonical = {
      ...canonical,
      meta: {
        ...canonical.meta,
        site_name: siteName.trim() || canonical.meta.site_name,
        address: address.trim(),
      },
      envelope: {
        footprint: {
          type: "rectangle",
          width_m: width,
          depth_m: depth,
          provenance,
          source: source.trim() || "manual-form",
        },
        faces: [
          {
            id: "north",
            bearing_deg: 0,
            width_m: width,
            height_m: nHeight,
            provenance,
            source: source.trim() || "manual-form",
            confidence: confidenceFromProvenance(provenance),
          },
          {
            id: "south",
            bearing_deg: 180,
            width_m: width,
            height_m: sHeight,
            provenance,
            source: source.trim() || "manual-form",
            confidence: confidenceFromProvenance(provenance),
          },
          {
            id: "east",
            bearing_deg: 90,
            width_m: depth,
            height_m: eHeight,
            provenance,
            source: source.trim() || "manual-form",
            confidence: confidenceFromProvenance(provenance),
          },
          {
            id: "west",
            bearing_deg: 270,
            width_m: depth,
            height_m: wHeight,
            provenance,
            source: source.trim() || "manual-form",
            confidence: confidenceFromProvenance(provenance),
          },
        ],
      },
      constraints: {
        ...canonical.constraints,
        public_footpath_m: footpath,
      },
      inputs: canonical.inputs?.length
        ? canonical.inputs
        : [{ type: "manual", rights: "client_provided", extracted_fields: ["envelope"] }],
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/building-canonical`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextCanonical),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Failed to save canonical building (${response.status})`);
      }
      const saved = (await response.json()) as BuildingCanonical;
      setCanonical(saved);
      setMessage("Building canonical saved. Run Pipeline to refresh building/scaffold/quote outputs.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading ingest form…</p>;
  }

  if (error && !canonical) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-50">Manual building dimensions</h3>
        <p className="text-sm text-zinc-400">
          Capture scaffold-grade envelope dimensions with explicit provenance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Site name</span>
          <input
            value={siteName}
            onChange={(event) => setSiteName(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Address</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Footprint width (m)</span>
          <input
            type="number"
            min="1"
            step="0.1"
            value={footprintWidth}
            onChange={(event) => setFootprintWidth(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Footprint depth (m)</span>
          <input
            type="number"
            min="1"
            step="0.1"
            value={footprintDepth}
            onChange={(event) => setFootprintDepth(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Public footpath clearance (m)</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={publicFootpath}
            onChange={(event) => setPublicFootpath(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">North height (m)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={northHeight}
            onChange={(event) => setNorthHeight(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">South height (m)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={southHeight}
            onChange={(event) => setSouthHeight(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">East height (m)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={eastHeight}
            onChange={(event) => setEastHeight(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">West height (m)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={westHeight}
            onChange={(event) => setWestHeight(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Provenance</span>
          <select
            value={provenance}
            onChange={(event) => setProvenance(event.target.value as Provenance)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
          >
            <option value="surveyed">Surveyed</option>
            <option value="derived">Derived</option>
            <option value="assumed">Assumed</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Source</span>
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            placeholder="manual-form"
          />
        </label>
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save canonical building"}
      </button>
    </form>
  );
}
