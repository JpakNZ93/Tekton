import { z } from "zod";

export { ScaffoldConfigSchema } from "./validate-canonical.mjs";

export type ScaffoldConfig = z.infer<
  typeof import("./validate-canonical.mjs").ScaffoldConfigSchema
>;
