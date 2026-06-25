"use client";

import { useQuoterStore } from "../../store/quoter-store";

export default function IngestForm() {
  const canonical = useQuoterStore((s) => s.canonical) as {
    meta?: { site_name?: string };
    envelope?: { faces?: { id: string; width_m: number; height_m: number; provenance: string; source?: string }[] };
  } | null;
  const setCanonical = useQuoterStore((s) => s.setCanonical);
  const rederive = useQuoterStore((s) => s.rederive);

  if (!canonical?.envelope?.faces) return <p style={{ color: "#888" }}>Loading…</p>;

  function updateFace(id: string, field: "width_m" | "height_m", value: number) {
    const next = structuredClone(canonical!) as typeof canonical & {
      envelope: { faces: { id: string; width_m: number; height_m: number; provenance: string; source: string }[] };
    };
    const face = next.envelope!.faces!.find((f) => f.id === id);
    if (face) {
      face[field] = value;
      face.provenance = "assumed";
      face.source = "manual-entry";
    }
    setCanonical(next as Record<string, unknown>);
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { applyCsvToCanonical } = await import("../../lib/quoter/csv-ingest.mjs");
    const { canonical: patched, error } = applyCsvToCanonical(canonical, text);
    if (error) {
      alert(error);
      return;
    }
    setCanonical(patched);
    rederive();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, color: "#e8e4dc" }}>{canonical.meta?.site_name}</h3>
      <label style={labelStyle}>
        Import CSV
        <input type="file" accept=".csv" onChange={onCsv} style={{ display: "block", marginTop: 4 }} />
      </label>
      {canonical.envelope.faces.map((f) => (
        <div key={f.id} style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
          <strong style={{ color: "#e8e4dc", textTransform: "capitalize" }}>{f.id}</strong>
          <span style={{ marginLeft: 8, fontSize: 11, color: provColor(f.provenance) }}>{f.provenance}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            <label style={labelStyle}>
              Width (m)
              <input
                type="number"
                step="0.1"
                value={f.width_m}
                onChange={(e) => updateFace(f.id, "width_m", parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Height (m)
              <input
                type="number"
                step="0.1"
                value={f.height_m}
                onChange={(e) => updateFace(f.id, "height_m", parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => rederive()} style={primaryBtn}>
        Re-derive model
      </button>
    </div>
  );
}

function provColor(p: string) {
  return p === "surveyed" ? "#3d9970" : p === "assumed" ? "#c0392b" : "#d4a017";
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "#aaa" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#2a2b2e",
  border: "1px solid #444",
  color: "#e8e4dc",
  padding: "4px 6px",
  marginTop: 2,
};
const primaryBtn: React.CSSProperties = {
  background: "#3d9970",
  border: "none",
  color: "#fff",
  padding: "8px 12px",
  cursor: "pointer",
  marginTop: 8,
};
