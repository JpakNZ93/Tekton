export function parseCsvToFaces(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { faces: [], error: "CSV must have header and at least one row" };

  const headers = lines[0].split(",").map((h) => h.trim());
  const idx = (name) => headers.indexOf(name);
  const required = ["face_id", "width_m", "height_m", "bearing_deg"];
  for (const r of required) {
    if (idx(r) === -1) return { faces: [], error: `Missing column: ${r}` };
  }

  const faces = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (!cols[0]) continue;
    faces.push({
      id: cols[idx("face_id")],
      bearing_deg: parseFloat(cols[idx("bearing_deg")]),
      width_m: parseFloat(cols[idx("width_m")]),
      height_m: parseFloat(cols[idx("height_m")]),
      setbacks: [],
      openings: [],
      provenance: idx("provenance") >= 0 ? cols[idx("provenance")] : "surveyed",
      source: "dimensions.csv",
      confidence: 1.0,
    });
  }
  return { faces, error: null };
}

export function applyCsvToCanonical(canonical, csvText) {
  const { faces, error } = parseCsvToFaces(csvText);
  if (error) return { canonical, error };
  const next = structuredClone(canonical);
  for (const face of faces) {
    const existing = next.envelope.faces.find((f) => f.id === face.id);
    if (existing) {
      Object.assign(existing, face);
    } else {
      next.envelope.faces.push(face);
    }
  }
  return { canonical: next, error: null };
}
