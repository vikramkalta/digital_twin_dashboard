import React, { useEffect, useMemo, useState } from "react";
import { useGLTF, Text } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from "three";

export function Model({ kpi, value, visibleFloor, roomValues }) {
  // Store text positions in state
  const [textPositions, setTextPositions] = useState({});
  const [heatmapPlanes, setHeatmapPlanes] = useState([]);

  const minMaxValues = {
    CO2: { min: 350, max: 1000 },
    Humidity: { min: 20, max: 70 },
    Temperature: { min: 0, max: 22 },
    Occupancy: { min: 0, max: 20 },
    SpaceUtil: { min: 0, max: 46 },
  };
  const { min, max } = minMaxValues[kpi] || { min: 0, max: 100 };

  const { scene } = useGLTF("/SampleBuilding.gltf");

  // Memoize `roomSpheres` to avoid unnecessary re-renders
  const roomSpheres = useMemo(
    () => ({
      SecondFloorRoom1: scene.getObjectByName("SecondFloorRoom1"),
      SecondFloorRoom2: scene.getObjectByName("SecondFloorRoom2"),
      SecondFloorRoom3: scene.getObjectByName("SecondFloorRoom3"),
      SecondFloorRoom4: scene.getObjectByName("SecondFloorRoom4"),
    }),
    [scene]
  ); // Only re-run when `scene` changes

  // Add a heatmap to Room1
  const roomMap = useMemo(
    () => ({
      SecondFloorRoom1: {
        scene: scene.getObjectByName("SecondFloorR1Floor"),
        value: roomValues.SecondFloorRoom1,
      },
      SecondFloorRoom2: {
        scene: scene.getObjectByName("SecondFloorR2Floor"),
        value: roomValues.SecondFloorRoom2,
      },
      SecondFloorRoom3: {
        scene: scene.getObjectByName("SecondFloorR3Floor"),
        value: roomValues.SecondFloorRoom3,
      },
      SecondFloorRoom4: {
        scene: scene.getObjectByName("SecondFloorR4Floor"),
        value: roomValues.SecondFloorRoom4,
      },
    }),
    [scene, roomValues]
  );

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
      if (
        !node.name?.toLowerCase()?.includes?.("furniture") &&
        !node.name?.toLowerCase()?.includes?.("room")
      )
        node.material.map = texture;
    }
    if (
      node.name?.toLowerCase()?.includes?.("furniture") ||
      node.name?.toLowerCase()?.includes?.("room")
    ) {
      if (node.material) {
        node.material.color.set("white"); // Dark Gray
        node.material.needsUpdate = true;
      }
    }
  });

  const getBoundingBoxCenter = (object) => {
    if (!object) return new THREE.Vector3(0, 0, 0);

    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    return center;
  };

  useEffect(() => {
    const newPositions = {};
    Object.keys(roomSpheres).forEach((room) => {
      const sphere = roomSpheres[room];
      if (sphere) {
        const centerPosition = getBoundingBoxCenter(sphere);
        newPositions[room] = [
          centerPosition.x,
          centerPosition.y + 1,
          centerPosition.z,
        ];
      }
    });

    // Only update state if values have changed
    setTextPositions((prevPositions) => {
      return !Object.keys(prevPositions).length ? newPositions : prevPositions;
    });
  }, [roomSpheres, roomValues]); // Depend on both roomSpheres and roomValues

  const normalizeKPIValue = (value) => {
    const min = minMaxValues[kpi]?.min;
    const max = minMaxValues[kpi]?.max;
    return Math.min(Math.max((value - min) / (max - min), 0), 1);
  };

  const createHeatmapTexture = (width, height, value = 100) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // Generate a simple gradient heatmap
    const gradient = ctx.createLinearGradient(0, 0, 0, height);

    const normalizedValue = normalizeKPIValue(value);
    if (normalizedValue <= 0.7) {
      // Gradient from transparent green to yellow
      gradient.addColorStop(0, "rgb(5, 255, 10)"); // Transparent green
    } else {
      // Gradient from yellow to transparent red
      gradient.addColorStop(normalizedValue, "rgba(255, 0, 0, 0.97)");
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  useEffect(() => {
    if (Object.keys(textPositions).length) {
      createHeatmap();
    }
  }, [textPositions, roomValues, kpi]); // Regenerate heatmap when room values change

  const createHeatmap = () => {
    const newHeatmapPlanes = [];

    for (let key in roomMap) {
      const room = roomMap[key].scene;
      if (!room) continue; // Skip if room is not found
      // Create heatmap texture based on room value
      const heatmapTexture = createHeatmapTexture(512, 512, roomMap[key].value);

      // Create a plane for the heatmap
      const boxGeometry = new THREE.BoxGeometry(
        5.2,
        5,
        key.includes("4") ? 1.4 : 2
      ); // Match room floor size
      const planeMaterial = new THREE.MeshBasicMaterial({
        map: heatmapTexture,
        transparent: true,
        opacity: 0.3, // Semi-transparent
        side: THREE.DoubleSide, // Ensure it's visible from both sides
      });
      const heatmapPlane = new THREE.Mesh(boxGeometry, planeMaterial);

      // Set position and rotation to align with the floor
      heatmapPlane.position.set(
        textPositions[key]?.[0],
        textPositions[key]?.[1] - 2,
        textPositions[key]?.[2]
      );
      heatmapPlane.rotation.x = -Math.PI / 2; // Rotate to align with the floor

      newHeatmapPlanes.push(heatmapPlane);
    }

    setHeatmapPlanes(newHeatmapPlanes);
  };

  useEffect(() => {
    heatmapPlanes.forEach((plane) => {
      scene.add(plane);
    });

    return () => {
      heatmapPlanes.forEach((plane) => {
        scene.remove(plane);
      });
    };
  }, [heatmapPlanes]);

  return (
    <primitive
      object={scene}
      scale={[0.08, 0.08, 0.08]}
      position={[-0.3, 0.2, 0]}
      rotation={[0.6, 1, 0]}
      dispose={null}
    >
      {/* Loop Through Room Spheres and Add Labels */}
      {Object.keys(roomSpheres).map((room, _index) => {
        if (!roomSpheres[room] || !textPositions[room]) return null;

        return (
          <Text
            key={room} // Use room name as key
            position={textPositions[room]} // Set position from state
            fontSize={0.7}
            color="#0f3257"
            fontWeight={500}
          >
            {roomValues[room]}
          </Text>
        );
      })}
    </primitive>
  );
}

useGLTF.preload("/SampleBuilding.gltf");
