"use client";

const MAT: Record<string, string> = {
  steel: "#7d8590",
  board: "#c4a574",
  marker: "#c0392b",
  bai: "#e8e4dc",
};

type Geo = {
  type: string;
  w?: number;
  h?: number;
  d?: number;
  r?: number;
};

export type SceneComp = {
  id: string;
  geometry: Geo;
  position: number[];
  rotation_deg?: number[];
  provenance?: string;
  source?: string;
  material?: string;
  parent_module?: string;
  render_only?: boolean;
  stock_code?: string;
};

export function Member({
  c,
  provenanceOn,
  highlight,
  onClick,
}: {
  c: SceneComp;
  provenanceOn: boolean;
  highlight: boolean;
  onClick?: (id: string) => void;
}) {
  const g = c.geometry;
  const rot = c.rotation_deg || [0, 0, 0];
  const provColors: Record<string, string> = {
    surveyed: "#3d9970",
    derived: "#d4a017",
    assumed: "#c0392b",
    rule_derived: "#5e6ca8",
  };
  const color = highlight
    ? "#ffd700"
    : provenanceOn && c.provenance
      ? provColors[c.provenance] || "#888"
      : MAT[c.material || "steel"] || "#888";

  const emissive = highlight ? "#665500" : "#000000";

  if (g.type === "cylinder") {
    return (
      <mesh
        position={c.position as [number, number, number]}
        rotation={[rot[0], rot[2] || rot[1], rot[2] ? rot[1] : 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(c.id);
        }}
      >
        <cylinderGeometry args={[g.r!, g.r!, g.h!, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={highlight ? 0.4 : 0} />
      </mesh>
    );
  }

  return (
    <mesh
      position={c.position as [number, number, number]}
      rotation={[rot[0], rot[1], rot[2] || 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(c.id);
      }}
    >
      <boxGeometry args={[g.w!, g.h!, g.d!]} />
      <meshStandardMaterial
        color={color}
        transparent={c.material === "marker"}
        opacity={c.material === "marker" ? 0.7 : 1}
        emissive={emissive}
        emissiveIntensity={highlight ? 0.3 : 0}
      />
    </mesh>
  );
}

export function SceneContent({
  buildingComponents,
  scaffoldModules,
  scaffoldDetails,
  provenanceOn,
  scaffoldActive,
  highlightStockCode,
  selectedModuleId,
  onSelectModule,
}: {
  buildingComponents: SceneComp[];
  scaffoldModules: { id: string; stock_code: string; position: number[] }[];
  scaffoldDetails: SceneComp[];
  provenanceOn: boolean;
  scaffoldActive: boolean;
  highlightStockCode: string | null;
  selectedModuleId: string | null;
  onSelectModule: (id: string) => void;
}) {
  const highlightIds = new Set<string>();
  if (highlightStockCode) {
    for (const m of scaffoldModules) {
      if (m.stock_code === highlightStockCode) highlightIds.add(m.id);
    }
  }
  if (selectedModuleId) highlightIds.add(selectedModuleId);

  return (
    <>
      {buildingComponents.map((c) => (
        <Member
          key={c.id}
          c={{
            ...c,
            material: scaffoldActive ? "marker" : c.material,
          }}
          provenanceOn={provenanceOn}
          highlight={false}
          onClick={undefined}
        />
      ))}
      {scaffoldDetails.map((c) => {
        const parent = c.parent_module || "";
        const hl = highlightIds.has(parent);
        return (
          <Member
            key={c.id}
            c={c}
            provenanceOn={false}
            highlight={hl}
            onClick={() => parent && onSelectModule(parent)}
          />
        );
      })}
    </>
  );
}
