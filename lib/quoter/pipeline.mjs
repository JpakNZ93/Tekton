import { deriveBuilding } from "./derive-building.mjs";
import { deriveScaffold } from "./derive-scaffold.mjs";
import { verifyScaffold } from "./verify-scaffold.mjs";
import { buildQuote } from "./quote.mjs";

export function runProjectPipeline(canonical, config, preset, priceList) {
  const buildingSpec = deriveBuilding(canonical);
  const scaffoldSpec = deriveScaffold(buildingSpec, config, preset);
  const report = verifyScaffold(scaffoldSpec, config, preset);
  const quote = buildQuote(scaffoldSpec, canonical, priceList, config, preset);
  return { buildingSpec, scaffoldSpec, report, quote };
}

export { deriveBuilding, deriveScaffold, verifyScaffold, buildQuote };
