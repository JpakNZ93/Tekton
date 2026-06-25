"use client";

import { useQuoterStore } from "../../store/quoter-store";

const FACES = ["north", "east", "south", "west"];

export default function ScaffoldEditor() {
  const config = useQuoterStore((s) => s.config) as {
    selected_faces?: string[];
  } | null;
  const toggleFace = useQuoterStore((s) => s.toggleFace);
  const replaceBayModule = useQuoterStore((s) => s.replaceBayModule);
  const removeLift = useQuoterStore((s) => s.removeLift);
  const rederive = useQuoterStore((s) => s.rederive);
  const report = useQuoterStore((s) => s.report) as { passed?: boolean; checks?: { id: string; name: string; pass: boolean }[] } | null;

  const selected = new Set(config?.selected_faces || []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, color: "#e8e4dc" }}>Scaffold faces</h3>
      {FACES.map((f) => (
        <label key={f} style={{ color: "#ccc", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={selected.has(f)}
            onChange={() => toggleFace(f)}
            style={{ marginRight: 8 }}
          />
          {f.charAt(0).toUpperCase() + f.slice(1)} elevation
        </label>
      ))}

      <h3 style={{ margin: "8px 0 0", fontSize: 14, color: "#e8e4dc" }}>Bay overrides</h3>
      <p style={{ fontSize: 11, color: "#888", margin: 0 }}>
        Quick edits — select face and bay index (0-based).
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btn} onClick={() => replaceBayModule("east", 1, "MOD-ACC-2.0x2.4")}>
          East bay 1 → Access
        </button>
        <button type="button" style={btn} onClick={() => removeLift("north", 2)}>
          Remove north lift 2
        </button>
        <button type="button" style={btn} onClick={() => rederive()}>
          Auto-wrap refresh
        </button>
      </div>

      {report && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <strong style={{ color: report.passed ? "#3d9970" : "#c0392b" }}>
            Verifier: {report.passed ? "PASS" : "FAIL"}
          </strong>
          <ul style={{ paddingLeft: 16, color: "#aaa" }}>
            {report.checks?.map((c) => (
              <li key={c.id} style={{ color: c.pass ? "#3d9970" : "#c0392b" }}>
                {c.id}: {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#2a2b2e",
  border: "1px solid #4a4640",
  color: "#e8e4dc",
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 11,
};
