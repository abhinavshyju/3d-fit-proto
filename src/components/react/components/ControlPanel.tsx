import {
  Settings,
  RotateCcw,
  Move3D,
  Maximize2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Transform, AlignmentSettings } from "../types";

interface ControlPanelProps {
  transform: Transform;
  onTransformChange: (transform: Transform) => void;
  settings: AlignmentSettings;
  onSettingsChange: (settings: AlignmentSettings) => void;
  onAutoAlign: () => void;
  onReset: () => void;
}

export default function ControlPanel({
  transform,
  onTransformChange,
  settings,
  onSettingsChange,
  onAutoAlign,
  onReset,
}: ControlPanelProps) {
  const handleTranslationChange = (axis: "x" | "y" | "z", value: number) => {
    onTransformChange({
      ...transform,
      translation: { ...transform.translation, [axis]: value },
    });
  };

  const handleRotationChange = (axis: "x" | "y" | "z", value: number) => {
    onTransformChange({
      ...transform,
      rotation: { ...transform.rotation, [axis]: (value * Math.PI) / 180 },
    });
  };

  const handleScaleChange = (axis: "x" | "y" | "z", value: number) => {
    onTransformChange({
      ...transform,
      scale: { ...transform.scale, [axis]: value },
    });
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Alignment Controls
        </h3>
        <button
          onClick={onReset}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm flex items-center gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Auto Alignment */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Auto Alignment</h4>
        <button
          onClick={onAutoAlign}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center gap-2"
        >
          <Move3D className="w-4 h-4" />
          Auto Align Models
        </button>
      </div>

      {/* Translation Controls - adjusted for human scale */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Translation (meters)</h4>
        <div className="grid grid-cols-3 gap-3">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="space-y-1">
              <label className="text-sm text-gray-300 uppercase">{axis}</label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.01"
                value={transform.translation[axis]}
                onChange={(e) =>
                  handleTranslationChange(axis, parseFloat(e.target.value))
                }
                className="w-full"
              />
              <input
                type="number"
                value={transform.translation[axis].toFixed(3)}
                onChange={(e) =>
                  handleTranslationChange(axis, parseFloat(e.target.value) || 0)
                }
                className="w-full px-2 py-1 bg-gray-700 text-white text-xs rounded"
                step="0.001"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rotation Controls */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Rotation (degrees)</h4>
        <div className="grid grid-cols-3 gap-3">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="space-y-1">
              <label className="text-sm text-gray-300 uppercase">{axis}</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={(transform.rotation[axis] * 180) / Math.PI}
                onChange={(e) =>
                  handleRotationChange(axis, parseFloat(e.target.value))
                }
                className="w-full"
              />
              <input
                type="number"
                value={((transform.rotation[axis] * 180) / Math.PI).toFixed(1)}
                onChange={(e) =>
                  handleRotationChange(axis, parseFloat(e.target.value) || 0)
                }
                className="w-full px-2 py-1 bg-gray-700 text-white text-xs rounded"
                step="0.1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scale Controls */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Scale</h4>
        <div className="grid grid-cols-3 gap-3">
          {(["x", "y", "z"] as const).map((axis) => (
            <div key={axis} className="space-y-1">
              <label className="text-sm text-gray-300 uppercase">{axis}</label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.01"
                value={transform.scale[axis]}
                onChange={(e) =>
                  handleScaleChange(axis, parseFloat(e.target.value))
                }
                className="w-full"
              />
              <input
                type="number"
                value={transform.scale[axis].toFixed(2)}
                onChange={(e) =>
                  handleScaleChange(axis, parseFloat(e.target.value) || 1)
                }
                className="w-full px-2 py-1 bg-gray-700 text-white text-xs rounded"
                step="0.01"
                min="0.1"
                max="3"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Display Settings */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Display Settings</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">Wireframe Mode</label>
            <button
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  showWireframe: !settings.showWireframe,
                })
              }
              className={`p-1 rounded ${
                settings.showWireframe ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              {settings.showWireframe ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-300">Transparency</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.transparency}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  transparency: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-300">Show Points</label>
            <button
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  showPoints: !settings.showPoints,
                })
              }
              className={`p-1 rounded ${
                settings.showPoints ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              {settings.showPoints ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
