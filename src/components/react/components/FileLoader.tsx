import { useRef } from "react";
import { Upload, File, X } from "lucide-react";
import type { ScanModel } from "../types";

interface FileLoaderProps {
  onBodyModelLoad: (model: ScanModel) => void;
  onGarmentModelLoad: (model: ScanModel) => void;
  bodyModel?: ScanModel;
  garmentModel?: ScanModel;
}

export default function FileLoader({
  onBodyModelLoad,
  onGarmentModelLoad,
  bodyModel,
  garmentModel,
}: FileLoaderProps) {
  const bodyFileRef = useRef<HTMLInputElement>(null);
  const garmentFileRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (file: File, type: "body" | "garment") => {
    const model: ScanModel = {
      id: `${type}-${Date.now()}`,
      name: file.name,
      file,
      points: [],
    };

    if (type === "body") {
      onBodyModelLoad(model);
    } else {
      onGarmentModelLoad(model);
    }
  };

  const clearModel = (type: "body" | "garment") => {
    const emptyModel: ScanModel = {
      id: "",
      name: "",
      points: [],
    };

    if (type === "body") {
      onBodyModelLoad(emptyModel);
    } else {
      onGarmentModelLoad(emptyModel);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Upload className="w-5 h-5" />
        Load 3D Models
      </h3>

      {/* Body Model */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Body Scan</h4>
        {bodyModel?.name ? (
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">{bodyModel.name}</span>
            </div>
            <button
              onClick={() => clearModel("body")}
              className="p-1 text-gray-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => bodyFileRef.current?.click()}
            className="w-full p-4 border-2 border-dashed border-gray-600 hover:border-blue-400 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
          >
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">Click to upload body scan</p>
            <p className="text-xs text-gray-500">OBJ, STL, PLY files</p>
          </button>
        )}
        <input
          ref={bodyFileRef}
          type="file"
          accept=".obj,.stl,.ply"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileLoad(file, "body");
          }}
          className="hidden"
        />
      </div>

      {/* Garment Model */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white">Garment Scan</h4>
        {garmentModel?.name ? (
          <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-300">{garmentModel.name}</span>
            </div>
            <button
              onClick={() => clearModel("garment")}
              className="p-1 text-gray-400 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => garmentFileRef.current?.click()}
            className="w-full p-4 border-2 border-dashed border-gray-600 hover:border-red-400 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
          >
            <Upload className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">Click to upload garment scan</p>
            <p className="text-xs text-gray-500">OBJ, STL, PLY files</p>
          </button>
        )}
        <input
          ref={garmentFileRef}
          type="file"
          accept=".obj,.stl,.ply"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileLoad(file, "garment");
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
