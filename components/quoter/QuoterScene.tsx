"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { SceneContent, SceneComp } from "./Member";
import { useQuoterStore } from "../../store/quoter-store";

export default function QuoterScene() {
  const [provenanceOn, setProvenanceOn] = useState(true);
  const [scaffoldActive, setScaffoldActive] = useState(true);
  const buildingSpec = useQuoterStore((s) => s.buildingSpec);
  const scaffoldSpec = useQuoterStore((s) => s.scaffoldSpec);
  const highlightStockCode = useQuoterStore((s) => s.highlightStockCode);
  const selectedModuleId = useQuoterStore((s) => s.selectedModuleId);
  const selectModule = useQuoterStore((s) => s.selectModule);

  const buildingComponents = (buildingSpec?.components as SceneComp[]) || [];
  const modules = (scaffoldSpec?.modules as { id: string; stock_code: string; position: number[] }[]) || [];
  const details = (scaffoldSpec?.components as SceneComp[]) || [];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#1c1d20" }}>
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 10,
          display: "flex",
          gap: 8,
          fontSize: 12,
        }}
      >
        <button type="button" onClick={() => setProvenanceOn(!provenanceOn)} style={btnStyle}>
          Provenance {provenanceOn ? "ON" : "OFF"}
        </button>
        <button type="button" onClick={() => setScaffoldActive(!scaffoldActive)} style={btnStyle}>
          Scaffold {scaffoldActive ? "ON" : "OFF"}
        </button>
      </div>
      <Canvas camera={{ position: [15, 10, 15], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <SceneContent
            buildingComponents={buildingComponents}
            scaffoldModules={modules}
            scaffoldDetails={scaffoldActive ? details : []}
            provenanceOn={provenanceOn}
            scaffoldActive={scaffoldActive}
            highlightStockCode={highlightStockCode}
            selectedModuleId={selectedModuleId}
            onSelectModule={selectModule}
          />
          <OrbitControls makeDefault target={[6, 3, 4]} />
        </Suspense>
      </Canvas>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#2a2b2e",
  border: "1px solid #4a4640",
  color: "#e8e4dc",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 11,
};
