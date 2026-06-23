import { z } from "zod";

export {
  BuildingCanonicalSchema,
  FaceSchema,
  ProvenanceSchema,
} from "./validate-canonical.mjs";

export type Provenance = z.infer<typeof import("./validate-canonical.mjs").ProvenanceSchema>;
export type Face = z.infer<typeof import("./validate-canonical.mjs").FaceSchema>;
export type BuildingCanonical = z.infer<
  typeof import("./validate-canonical.mjs").BuildingCanonicalSchema
>;
