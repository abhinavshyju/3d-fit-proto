import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Sphere } from "@react-three/drei";
import * as THREE from "three";
import type { Point3D, ScanModel, Transform } from "../types";
import {
  loadModelFile,
  createModelMaterial,
  type LoadedModel,
} from "../utils/modelLoaders";

interface ModelViewerProps {
  bodyModel?: ScanModel;
  garmentModel?: ScanModel;
  transform: Transform;
  showWireframe: boolean;
  transparency: number;
  showPoints: boolean;
  onPointSelect?: (point: Point3D, model: "body" | "garment") => void;
}

function ModelMesh({
  model,
  transform,
  showWireframe,
  transparency,
  color,
  onPointSelect,
  modelType,
}: {
  model: ScanModel;
  transform: Transform;
  showWireframe: boolean;
  transparency: number;
  color: string;
  onPointSelect?: (point: Point3D, model: "body" | "garment") => void;
  modelType: "body" | "garment";
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [loadedModel, setLoadedModel] = useState<LoadedModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the 3D model file
  useEffect(() => {
    if (model.file && !loadedModel && !isLoading) {
      setIsLoading(true);
      setError(null);

      loadModelFile(model.file)
        .then(setLoadedModel)
        .catch((err) => {
          console.error("Error loading model:", err);
          setError(err.message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [model.file, loadedModel, isLoading]);

  useFrame(() => {
    if (meshRef.current && modelType === "garment") {
      meshRef.current.position.set(
        transform.translation.x,
        transform.translation.y,
        transform.translation.z
      );
      meshRef.current.rotation.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z
      );
      meshRef.current.scale.set(
        transform.scale.x,
        transform.scale.y,
        transform.scale.z
      );
    }
  });

  const handleClick = (event: any) => {
    if (!onPointSelect) return;

    event.stopPropagation();
    const intersect = event.intersections?.[0];
    if (intersect) {
      const point: Point3D = {
        x: intersect.point.x,
        y: intersect.point.y,
        z: intersect.point.z,
        id: `${modelType}-${Date.now()}`,
      };
      onPointSelect(point, modelType);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <mesh
        position={modelType === "body" ? [-0.5, 0.875, 0] : [0.5, 0.875, 0]}
      >
        <boxGeometry args={[0.3, 1.75, 0.3]} />
        <meshBasicMaterial color="#666666" wireframe />
      </mesh>
    );
  }

  // Show error state
  if (error) {
    return (
      <mesh position={modelType === "body" ? [-0.5, 0, 0] : [0.5, 0, 0]}>
        <boxGeometry args={[0.4, 1.75, 0.4]} />
        <meshBasicMaterial color="#ff0000" wireframe />
      </mesh>
    );
  }

  // Show placeholder if no model loaded - human proportions
  if (!loadedModel) {
    return (
      <mesh
        ref={meshRef}
        onClick={handleClick}
        position={modelType === "body" ? [-0.5, 0.875, 0] : [0.5, 0.875, 0]}
      >
        <boxGeometry args={[0.4, 1.75, 0.2]} />
        <meshStandardMaterial
          color={color}
          wireframe={showWireframe}
          transparent={transparency < 1}
          opacity={transparency}
        />
      </mesh>
    );
  }

  // Render the actual loaded model
  return (
    <mesh
      ref={meshRef}
      onClick={handleClick}
      geometry={loadedModel.geometry}
      material={createModelMaterial(color, showWireframe, transparency)}
      position={modelType === "body" ? [0, 0, 0] : [0, 0, 0]}
    />
  );
}

function PointMarkers({ points, color }: { points: Point3D[]; color: string }) {
  return (
    <>
      {points.map((point) => (
        <Sphere
          key={point.id}
          position={[point.x, point.y, point.z]}
          args={[0.02]}
        >
          <meshBasicMaterial color={color} />
        </Sphere>
      ))}
    </>
  );
}

function LoadingIndicator({ message }: { message: string }) {
  return (
    <div className="absolute top-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">
      {message}
    </div>
  );
}

function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    // Position camera to view human-sized models properly
    camera.position.set(3, 1.5, 3);
    camera.lookAt(0, 0.875, 0); // Look at center of human body
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

export default function ModelViewer({
  bodyModel,
  garmentModel,
  transform,
  showWireframe,
  transparency,
  showPoints,
  onPointSelect,
}: ModelViewerProps) {
  const [loadingMessage, setLoadingMessage] = useState<string>("");

  useEffect(() => {
    const messages = [];
    if (bodyModel?.file && !bodyModel.mesh)
      messages.push("Loading body model...");
    if (garmentModel?.file && !garmentModel.mesh)
      messages.push("Loading garment model...");
    setLoadingMessage(messages.join(" "));
  }, [bodyModel, garmentModel]);

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden relative">
      {loadingMessage && <LoadingIndicator message={loadingMessage} />}

      <Canvas
        camera={{
          position: [3, 1.5, 3],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
      >
        <CameraController />

        {/* Enhanced lighting for better model visibility */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1.0} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} />
        <pointLight position={[0, 5, 0]} intensity={0.5} />

        {/* Grid scaled for human size - 2m x 2m grid with 10cm spacing */}
        <Grid
          args={[20, 20]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#444444"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#666666"
          position={[0, 0, 0]}
        />

        {bodyModel && (
          <ModelMesh
            model={bodyModel}
            transform={{
              translation: { x: 0, y: 0, z: 0, id: "" },
              rotation: { x: 0, y: 0, z: 0, id: "" },
              scale: { x: 1, y: 1, z: 1, id: "" },
            }}
            showWireframe={showWireframe}
            transparency={transparency}
            color="#3b82f6"
            onPointSelect={onPointSelect}
            modelType="body"
          />
        )}

        {garmentModel && (
          <ModelMesh
            model={garmentModel}
            transform={transform}
            showWireframe={showWireframe}
            transparency={transparency}
            color="#ef4444"
            onPointSelect={onPointSelect}
            modelType="garment"
          />
        )}

        {showPoints && bodyModel?.points && (
          <PointMarkers points={bodyModel.points} color="#3b82f6" />
        )}

        {showPoints && garmentModel?.points && (
          <PointMarkers points={garmentModel.points} color="#ef4444" />
        )}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          target={[0, 0.875, 0]}
          minDistance={1}
          maxDistance={20}
          maxPolarAngle={Math.PI}
        />
      </Canvas>
    </div>
  );
}
