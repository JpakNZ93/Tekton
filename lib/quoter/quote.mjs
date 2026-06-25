export function buildQuote(scaffoldSpec, canonical, priceList, config, preset) {
  const modules = scaffoldSpec.modules.filter((m) => m.stock_code && m.module_id !== "MOD-TIE-KIT" || m.stock_code);
  const counts = {};
  for (const m of scaffoldSpec.modules) {
    if (!m.stock_code) continue;
    counts[m.stock_code] = (counts[m.stock_code] || 0) + 1;
  }

  const bom = Object.entries(counts).map(([stock_code, qty]) => {
    const item = priceList.items[stock_code] || { description: stock_code, unit_cost: 0 };
    return {
      stock_code,
      description: item.description,
      qty,
      unit: "each",
      unit_cost: item.unit_cost,
      line_total: r2(qty * item.unit_cost),
      derivation: `scaffold-spec:modules:${stock_code}`,
    };
  });

  const totalModules = scaffoldSpec.modules.filter((m) =>
    ["MOD-STD-2.0x2.4", "MOD-ACC-2.0x2.4", "MOD-CRN-2.0", "MOD-HOP-1.0"].includes(m.module_id)
  ).length;

  const laborCfg = priceList.labor || preset.labor;
  const erectDays = r2((totalModules * laborCfg.days_per_module) / 1);
  const crew = laborCfg.crew_size;
  const rate = laborCfg.rate_per_day;
  const erectTotal = r2(crew * erectDays * rate);
  const dismantleDays = r2(erectDays * laborCfg.dismantle_factor);
  const dismantleTotal = r2(crew * dismantleDays * rate);

  const hireWeeks = priceList.hire.weeks_default;
  const hireRate = priceList.hire.rate_per_week;
  const hireTotal = r2(hireWeeks * hireRate);

  const materials = r2(bom.reduce((s, l) => s + l.line_total, 0));
  const labor = r2(erectTotal + dismantleTotal);
  const hire = hireTotal;
  const delivery = priceList.charges.delivery;
  const subtotal = r2(materials + labor + hire + delivery);
  const marginPct = priceList.charges.margin_percent;
  const margin = r2(subtotal * (marginPct / 100));
  const grand_total = r2(subtotal + margin);

  const faces = canonical.envelope.faces;
  const provCounts = { surveyed: 0, derived: 0, assumed: 0 };
  for (const f of faces) {
    provCounts[f.provenance] = (provCounts[f.provenance] || 0) + 1;
  }
  const total = faces.length || 1;

  const assumptions = [];
  for (const f of faces) {
    if (f.provenance === "assumed") {
      assumptions.push(
        `${f.id.charAt(0).toUpperCase() + f.id.slice(1)} elevation height ${f.height_m} m assumed — not site measured.`
      );
    }
  }
  for (const ov of config.overrides || []) {
    if (ov.reason) assumptions.push(ov.reason);
  }
  assumptions.push(
    `Access bay every ${config.auto_wrap?.access_bay_every_n ?? 5} bays per AUS deemed-to-conform default.`
  );

  return {
    project_id: canonical.meta.project_id,
    scaffold_system: config.system_id,
    bom,
    labor: [
      {
        task: "erect",
        crew,
        days: erectDays,
        rate_per_day: rate,
        line_total: erectTotal,
        rule: `${totalModules} modules × ${laborCfg.days_per_module} days/module × ${crew} crew @ $${rate}/day`,
      },
      {
        task: "dismantle",
        crew,
        days: dismantleDays,
        rate_per_day: rate,
        line_total: dismantleTotal,
        rule: `erect × ${laborCfg.dismantle_factor}`,
      },
    ],
    hire: {
      weeks: hireWeeks,
      rate_per_week: hireRate,
      line_total: hireTotal,
      hireable_codes: Object.keys(priceList.items).filter((k) => priceList.items[k].hireable),
    },
    charges: [
      { type: "delivery", amount: delivery },
      { type: "margin", percent: marginPct, applied_to: "subtotal" },
    ],
    totals: {
      materials,
      labor,
      hire,
      charges: delivery,
      subtotal,
      margin,
      grand_total,
    },
    confidence: {
      surveyed_pct: r2((provCounts.surveyed || 0) / total),
      derived_pct: r2((provCounts.derived || 0) / total),
      assumed_pct: r2((provCounts.assumed || 0) / total),
    },
    assumptions,
  };
}

function r2(n) {
  return Math.round(n * 100) / 100;
}
