import React, { useState } from "react";
import { Scan, Info } from "lucide-react";
import ModelViewer from "./components/ModelViewer";
import ControlPanel from "./components/ControlPanel";
import FileLoader from "./components/FileLoader";
import PointManager from "./components/PointManager";
import { useAlignment } from "./hooks/useAlignment";
import type { ScanModel, Transform, AlignmentSettings, Point3D } from "./types";

function App() {
  const [bodyModel, setBodyModel] = useState<ScanModel>();
  const [garmentModel, setGarmentModel] = useState<ScanModel>();
  const [transform, setTransform] = useState<Transform>({
    translation: {
      x: 0,
      y: 0,
      z: 0,
      id: "",
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
      id: "",
    },
    scale: {
      x: 1,
      y: 1,
      z: 1,
      id: "",
    },
  });
  const [settings, setSettings] = useState<AlignmentSettings>({
    autoAlign: false,
    showWireframe: false,
    transparency: 0.8,
    showPoints: true,
    snapToGrid: false,
    gridSize: 0.1,
  });

  const {
    alignmentPairs,
    addAlignmentPair,
    removeAlignmentPair,
    clearAlignmentPairs,
    calculateTransform,
    performAutoAlignment,
  } = useAlignment();

  const handlePointSelect = (point: Point3D, model: "body" | "garment") => {
    if (model === "body" && bodyModel) {
      setBodyModel({
        ...bodyModel,
        points: [...(bodyModel.points || []), point],
      });
    } else if (model === "garment" && garmentModel) {
      setGarmentModel({
        ...garmentModel,
        points: [...(garmentModel.points || []), point],
      });
    }
  };

  const handlePointRemove = (pointId: string, model: "body" | "garment") => {
    if (model === "body" && bodyModel) {
      setBodyModel({
        ...bodyModel,
        points: (bodyModel.points || []).filter((p) => p.id !== pointId),
      });
    } else if (model === "garment" && garmentModel) {
      setGarmentModel({
        ...garmentModel,
        points: (garmentModel.points || []).filter((p) => p.id !== pointId),
      });
    }
  };

  const handlePairCreate = (bodyPointId: string, garmentPointId: string) => {
    const bodyPoint = bodyModel?.points?.find((p) => p.id === bodyPointId);
    const garmentPoint = garmentModel?.points?.find(
      (p) => p.id === garmentPointId
    );

    if (bodyPoint && garmentPoint) {
      addAlignmentPair(bodyPoint, garmentPoint);
    }
  };

  const handleAutoAlign = () => {
    if (bodyModel?.points && garmentModel?.points) {
      const newTransform = performAutoAlignment(
        bodyModel.points,
        garmentModel.points
      );
      setTransform(newTransform);
    }
  };

  const handleManualAlign = () => {
    if (alignmentPairs.length > 0) {
      const newTransform = calculateTransform(alignmentPairs);
      setTransform(newTransform);
    }
  };

  const handleReset = () => {
    setTransform({
      translation: {
        x: 0,
        y: 0,
        z: 0,
        id: "",
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        id: "",
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
        id: "",
      },
    });
    clearAlignmentPairs();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scan className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">3D Scan Alignment Tool</h1>
              <p className="text-gray-400 text-sm">
                Align garment scans to body models with precision
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Info className="w-4 h-4" />
            <span>Click models to add alignment points</span>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)] gap-6 p-6">
        {/* Left Sidebar */}
        <div className="w-80 space-y-6 overflow-y-auto">
          <FileLoader
            onBodyModelLoad={setBodyModel}
            onGarmentModelLoad={setGarmentModel}
            bodyModel={bodyModel}
            garmentModel={garmentModel}
          />

          <PointManager
            bodyPoints={bodyModel?.points || []}
            garmentPoints={garmentModel?.points || []}
            alignmentPairs={alignmentPairs}
            onPointRemove={handlePointRemove}
            onPairCreate={handlePairCreate}
            onPairRemove={removeAlignmentPair}
          />
        </div>

        {/* Main 3D Viewer */}
        <div className="flex-1">
          <ModelViewer
            bodyModel={bodyModel}
            garmentModel={garmentModel}
            transform={transform}
            showWireframe={settings.showWireframe}
            transparency={settings.transparency}
            showPoints={settings.showPoints}
            onPointSelect={handlePointSelect}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 space-y-6 overflow-y-auto">
          <ControlPanel
            transform={transform}
            onTransformChange={setTransform}
            settings={settings}
            onSettingsChange={setSettings}
            onAutoAlign={handleAutoAlign}
            onReset={handleReset}
          />

          {/* Manual Alignment */}
          {alignmentPairs.length > 0 && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <button
                onClick={handleManualAlign}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded"
              >
                Apply Point-Based Alignment
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {alignmentPairs.length} alignment pairs selected
              </p>
            </div>
          )}

          {/* Alignment Statistics */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">
              Alignment Status
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Body Points:</span>
                <span className="text-white">
                  {bodyModel?.points?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Garment Points:</span>
                <span className="text-white">
                  {garmentModel?.points?.length || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Alignment Pairs:</span>
                <span className="text-white">{alignmentPairs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transform Applied:</span>
                <span className="text-white">
                  {transform.translation.x !== 0 ||
                  transform.translation.y !== 0 ||
                  transform.translation.z !== 0
                    ? "Yes"
                    : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
