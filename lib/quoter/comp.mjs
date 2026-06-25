const VALID = new Set(["surveyed", "derived", "assumed", "rule_derived"]);

export function createComp(components) {
  let seq = 0;
  return function comp(c) {
    if (!c.provenance || !c.source) {
      throw new Error(`UNSOURCED COMPONENT: ${c.id} — nothing renders without a source.`);
    }
    if (!VALID.has(c.provenance)) {
      throw new Error(`INVALID PROVENANCE: ${c.id} has "${c.provenance}"`);
    }
    const out = { ...c, seq: seq++ };
    components.push(out);
    return out;
  };
}
