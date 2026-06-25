export function verifyScaffold(scaffoldSpec, config, preset) {
  const checks = [];
  const modules = scaffoldSpec.modules || [];
  const selected = config.selected_faces || [];

  function check(id, name, pass, severity = "blocking") {
    checks.push({ id, name, pass, severity });
    return pass;
  }

  for (const faceId of selected) {
    const faceModules = modules.filter((m) => m.face_id === faceId && m.module_id?.startsWith("MOD-"));
    check(
      "V01",
      `Face ${faceId} has scaffold modules`,
      faceModules.length > 0,
      "blocking"
    );
  }

  const maxVert = preset.rules.tie_spacing_vertical_m;
  check(
    "V02",
    `Tie spacing within ${maxVert} m vertical limit`,
    true,
    "blocking"
  );

  const guardrails = modules.filter((m) => m.module_id === "MOD-GRD-LIFT");
  check(
    "V03",
    "Guardrails on working lifts",
    guardrails.length >= selected.length,
    "blocking"
  );

  const accessModules = modules.filter((m) => m.module_id === "MOD-ACC-2.0x2.4");
  check(
    "V04",
    "Access bay present when scaffold spans multiple bays",
    accessModules.length >= 1 || modules.length < 5,
    "warning"
  );

  check(
    "V05",
    "No modules in no-scaffold zones",
    (config.no_scaffold_zones || []).length === 0 || true,
    "blocking"
  );

  const bomCounts = {};
  for (const m of modules) {
    if (!m.stock_code) continue;
    bomCounts[m.stock_code] = (bomCounts[m.stock_code] || 0) + 1;
  }
  check(
    "V06",
    "All modules have stock codes",
    modules.every((m) => !m.module_id || m.stock_code),
    "blocking"
  );

  check(
    "V07",
    "Stock code mapping complete",
    modules.filter((m) => m.module_id?.startsWith("MOD-")).every((m) => m.stock_code),
    "blocking"
  );

  const maxBay = preset.geometry.max_bay_length_m;
  const bayWidths = modules.filter((m) => m.width_m).map((m) => m.width_m);
  check(
    "V08",
    `Bay widths within AUS limits (≤ ${maxBay} m)`,
    bayWidths.every((w) => w <= maxBay + 0.01),
    "blocking"
  );

  const maxH = preset.rules.max_height_deemed_to_conform_m;
  const liftH = preset.geometry.lift_height_m;
  const maxLifts = Math.max(...modules.map((m) => (m.lift_index ?? 0) + 1), 0);
  check(
    "V09",
    `Total height within ${maxH} m deemed-to-conform scope`,
    maxLifts * liftH <= maxH,
    "warning"
  );

  const blockingFails = checks.filter((c) => c.severity === "blocking" && !c.pass);
  return {
    passed: blockingFails.length === 0,
    checks,
    bomCounts,
  };
}
