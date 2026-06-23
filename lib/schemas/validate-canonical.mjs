import { z } from "zod";

export const ProvenanceSchema = z.enum(["surveyed", "derived", "assumed"]);

export const FaceSchema = z.object({
  id: z.string(),
  bearing_deg: z.number(),
  width_m: z.number().positive(),
  height_m: z.number().positive(),
  provenance: ProvenanceSchema,
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const BuildingCanonicalSchema = z.object({
  meta: z.object({
    project_id: z.string(),
    site_name: z.string(),
    address: z.string(),
    created_at: z.string(),
  }),
  units: z.object({ length: z.literal("m") }),
  envelope: z.object({
    footprint: z.object({
      type: z.literal("rectangle"),
      width_m: z.number().positive(),
      depth_m: z.number().positive(),
      provenance: ProvenanceSchema,
      source: z.string(),
    }),
    faces: z.array(FaceSchema),
  }),
  constraints: z.object({
    public_footpath_m: z.number(),
    no_scaffold_zones: z.array(z.any()),
    access_notes: z.string(),
  }),
  inputs: z.array(z.any()),
});

export const ScaffoldConfigSchema = z.object({
  project_id: z.string(),
  system_id: z.string(),
  selected_faces: z.array(z.string()),
  standoff_m: z.number(),
  extra_lift_m: z.number(),
  access_bay_every_n: z.number(),
  overrides: z.array(z.any()),
});

/** @param {unknown} data */
export function parseBuildingCanonical(data) {
  return BuildingCanonicalSchema.parse(data);
}

/** @param {unknown} data */
export function parseScaffoldConfig(data) {
  return ScaffoldConfigSchema.parse(data);
}
