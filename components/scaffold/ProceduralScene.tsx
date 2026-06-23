"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Component } from "../../lib/tekton-spec";
import SpecMesh, { type RenderableComponent } from "./SpecMesh";

interface ProceduralSceneProps {
  components: RenderableComponent[];
  provenanceVisible: boolean;
  provenanceColors: Record<string, string>;
  highlightIds: string[];
  onSelect?: (component: RenderableComponent | null) => void;
}

function focusTargetFromComponents(components: Component[]): [number, number, number] {
  if (!components.length) return [0, 2, 0];
  const total = components.reduce(
    (acc, comp) => {
      acc.x += comp.position[0];
      acc.y += comp.position[1];
      acc.z += comp.position[2];
      return acc;
    },
    { x: 0, y: 0, z: 0 },
  );

  return [
    total.x / components.length,
    Math.max(1.5, total.y / components.length),
    total.z / components.length,
  ];
}

export default function ProceduralScene({
  components,
  provenanceVisible,
  provenanceColors,
  highlightIds,
  onSelect,
}: ProceduralSceneProps) {
  const target = focusTargetFromComponents(components);

  return (
    <div className="h-full w-full rounded-lg border border-zinc-800 bg-zinc-950">
      <Canvas camera={{ position: [18, 14, 18], fov: 45 }} shadows onPointerMissed={() => onSelect?.(null)}>
        <color attach="background" args={["#09090b"]} />
        <fog attach="fog" args={["#09090b", 35, 90]} />

        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#8aa0be", "#1e1f24", 0.45]} />
        <directionalLight
          position={[20, 28, 18]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <group>
          {components.map((component) => (
            <SpecMesh
              key={component.id}
              component={component}
              highlighted={highlightIds.includes(component.id)}
              provenanceVisible={provenanceVisible}
              provenanceColors={provenanceColors}
              onSelect={onSelect}
            />
          ))}
        </group>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <circleGeometry args={[200, 64]} />
          <meshStandardMaterial color="#0f1013" roughness={1} />
        </mesh>

        <OrbitControls
          makeDefault
          target={target}
          maxDistance={120}
          minDistance={2}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
