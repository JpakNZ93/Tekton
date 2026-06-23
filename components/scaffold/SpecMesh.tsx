"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Component } from "../../lib/tekton-spec";

export type RenderableComponent = Component & {
  renderOpacity?: number;
  renderColor?: string;
  renderLayer?: "building" | "scaffold";
};

const CATEGORY_COLORS: Record<string, string> = {
  "building-slab": "#4e5f6b",
  "building-face": "#7f8d98",
  "no-scaffold-zone": "#c94a4a",
  tube: "#92a2b3",
  ledger: "#9babbb",
  transom: "#8f9faf",
  board: "#8b6a43",
  coupler: "#7a858f",
  tie: "#d2aa58",
  guardrail: "#e0b64d",
  toe_board: "#b68c4f",
  access: "#5da7bf",
};

interface SpecMeshProps {
  component: RenderableComponent;
  highlighted: boolean;
  provenanceVisible: boolean;
  provenanceColors: Record<string, string>;
  onSelect?: (component: RenderableComponent) => void;
}

function toRadians(rotationDeg?: [number, number, number]): [number, number, number] {
  const [x, y, z] = rotationDeg ?? [0, 0, 0];
  return [(x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180];
}

function getBaseColor(component: RenderableComponent): string {
  if (component.renderColor) return component.renderColor;
  if (component.material === "concrete") return "#6f757d";
  return CATEGORY_COLORS[component.category] ?? "#8d949c";
}

export default function SpecMesh({
  component,
  highlighted,
  provenanceVisible,
  provenanceColors,
  onSelect,
}: SpecMeshProps) {
  const color = useMemo(() => {
    if (provenanceVisible) {
      return provenanceColors[component.provenance] ?? "#8c8c8c";
    }
    return getBaseColor(component);
  }, [component, provenanceColors, provenanceVisible]);

  const opacity = component.renderOpacity ?? 1;
  const geometry = component.geometry;
  const rotation = toRadians(component.rotation_deg);
  const isTransparent = opacity < 1;

  const meshMaterial = (
    <meshStandardMaterial
      color={color}
      transparent={isTransparent}
      opacity={opacity}
      metalness={component.category === "tube" ? 0.55 : 0.18}
      roughness={component.category === "board" ? 0.85 : 0.65}
      emissive={highlighted ? new THREE.Color("#ffd369") : new THREE.Color("#000000")}
      emissiveIntensity={highlighted ? 0.85 : 0}
    />
  );

  const handleClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect?.(component);
  };

  if (geometry.type === "cylinder") {
    return (
      <mesh position={component.position} rotation={rotation} castShadow receiveShadow onClick={handleClick}>
        <cylinderGeometry args={[geometry.r ?? 0.025, geometry.r ?? 0.025, geometry.h ?? 0.5, 16]} />
        {meshMaterial}
      </mesh>
    );
  }

  return (
    <mesh position={component.position} rotation={rotation} castShadow receiveShadow onClick={handleClick}>
      <boxGeometry args={[geometry.w ?? 0.1, geometry.h ?? 0.1, geometry.d ?? 0.1]} />
      {meshMaterial}
    </mesh>
  );
}
