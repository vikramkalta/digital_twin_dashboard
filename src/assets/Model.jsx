import React, { useMemo } from "react";
import { useGLTF, Text } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from "three";

export function Model({ kpi, value, visibleFloor }) {
  const minMaxValues = {
    CO2: { min: 350, max: 1200 },
    Humidity: { min: 20, max: 80 },
    Temperature: { min: 0, max: 22 },
    Occupancy: { min: 0, max: 20 },
  };
  const { min, max } = minMaxValues[kpi] || { min: 0, max: 100 };

  const { scene } = useGLTF("/SampleBuilding.gltf");

  const ballColor = useMemo(() => {
    const normalize = (value, min, max) =>
      Math.max(0, Math.min(1, (value - min) / (max - min)));
    const t = normalize(value, min, max);
    return new THREE.Color().lerpColors(
      new THREE.Color("green"),
      new THREE.Color("red"),
      t
    );
  }, [value, min, max]);

  // Helper function to get transparent material
  const getTransparentMaterial = (node) => {
    const isBall = node.name.toLowerCase().includes("ball");
    return new THREE.MeshStandardMaterial({
      color: isBall ? ballColor : "lightgray",
      transparent: true,
      opacity: 0.7,
    });
  };

  // Determine if a node should be visible based on the visibleFloor state
  const isNodeVisible = (node) => {
    const name = node.name.toLowerCase();
    if (visibleFloor === "1st") {
      return (
        name.includes("first") ||
        node.parent?.userData?.name?.toLowerCase?.()?.includes?.("first")
      );
    } else if (visibleFloor === "2nd") {
      return (
        name.includes("second") ||
        node.parent?.userData?.name?.toLowerCase?.()?.includes?.("second")
      );
    }
    return true; // Show all floors by default
  };
  const texture = new TextureLoader().load("/Texture7.jpg");
  // Traverse the scene to set visibility and materials
  scene.traverse((node) => {
    if (node.isMesh) {
      node.visible = isNodeVisible(node);
      node.material = getTransparentMaterial(node);
      node.material.metalness = 0.6; // Adds a metallic look
      node.material.roughness = 0.5; // Makes it smoother
      node.material.wireframe = false; // Disable wireframe
      node.material.edgeWidth = 0; // Disable edge outlines
      node.material.lineWidth = 0;
      node.material.wireframe = false;
      node.material.outlineColor = null;
      if (!node.name?.toLowerCase()?.includes?.('furniture'))
        node.material.map = texture;
      }
      if (node.name?.toLowerCase()?.includes?.('furniture')) {
        if (node.material) {
          node.material.color.set('white'); // Dark Gray
          node.material.needsUpdate = true;
        }
      }
  });

  return (
    <primitive
      object={scene}
      scale={[0.08, 0.08, 0.08]}
      position={[-0.3, 0.2, 0]}
      rotation={[0.6, 1, 0]}
      dispose={null}
    >
    </primitive>
  );
}

useGLTF.preload("/SampleBuilding.gltf");
