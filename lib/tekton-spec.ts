export type Provenance = "surveyed" | "derived" | "assumed";

export interface Component {
  id: string;
  name_en: string;
  phase: string;
  category: string;
  role?: string;
  geometry: { type: "box" | "cylinder"; w?: number; h?: number; d?: number; r?: number };
  position: [number, number, number];
  rotation_deg?: [number, number, number];
  provenance: Provenance;
  source: string;
  stock_code?: string;
  face_id?: string;
  lift_index?: number;
  material?: string;
}

export interface StructuralSpec {
  meta: Record<string, unknown>;
  units: { length: string; note?: string };
  phases: string[];
  key_dimensions: Record<string, unknown>;
  provenance_colors: Record<Provenance, string>;
  components: Component[];
}
