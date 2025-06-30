import React from 'react';
import { Target, Trash2, Link } from 'lucide-react';
import { Point3D, AlignmentPair } from '../types';

interface PointManagerProps {
  bodyPoints: Point3D[];
  garmentPoints: Point3D[];
  alignmentPairs: AlignmentPair[];
  onPointRemove: (pointId: string, model: 'body' | 'garment') => void;
  onPairCreate: (bodyPointId: string, garmentPointId: string) => void;
  onPairRemove: (pairIndex: number) => void;
}

export default function PointManager({
  bodyPoints,
  garmentPoints,
  alignmentPairs,
  onPointRemove,
  onPairCreate,
  onPairRemove
}: PointManagerProps) {
  const [selectedBodyPoint, setSelectedBodyPoint] = React.useState<string>('');
  const [selectedGarmentPoint, setSelectedGarmentPoint] = React.useState<string>('');

  const handleCreatePair = () => {
    if (selectedBodyPoint && selectedGarmentPoint) {
      onPairCreate(selectedBodyPoint, selectedGarmentPoint);
      setSelectedBodyPoint('');
      setSelectedGarmentPoint('');
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Target className="w-5 h-5" />
        Point Management
      </h3>

      {/* Point Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-blue-400">Body Points</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {bodyPoints.map((point) => (
              <div
                key={point.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                  selectedBodyPoint === point.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setSelectedBodyPoint(point.id)}
              >
                <span className="text-xs text-gray-300">
                  ({point.x.toFixed(2)}, {point.y.toFixed(2)}, {point.z.toFixed(2)})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPointRemove(point.id, 'body');
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {bodyPoints.length === 0 && (
              <p className="text-xs text-gray-500 p-2">Click on body model to add points</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-400">Garment Points</h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {garmentPoints.map((point) => (
              <div
                key={point.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                  selectedGarmentPoint === point.id ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setSelectedGarmentPoint(point.id)}
              >
                <span className="text-xs text-gray-300">
                  ({point.x.toFixed(2)}, {point.y.toFixed(2)}, {point.z.toFixed(2)})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPointRemove(point.id, 'garment');
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {garmentPoints.length === 0 && (
              <p className="text-xs text-gray-500 p-2">Click on garment model to add points</p>
            )}
          </div>
        </div>
      </div>

      {/* Create Pair Button */}
      <button
        onClick={handleCreatePair}
        disabled={!selectedBodyPoint || !selectedGarmentPoint}
        className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded flex items-center justify-center gap-2"
      >
        <Link className="w-4 h-4" />
        Create Alignment Pair
      </button>

      {/* Alignment Pairs */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white">Alignment Pairs ({alignmentPairs.length})</h4>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {alignmentPairs.map((pair, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
              <div className="text-xs text-gray-300">
                <div className="text-blue-400">
                  Body: ({pair.bodyPoint.x.toFixed(2)}, {pair.bodyPoint.y.toFixed(2)}, {pair.bodyPoint.z.toFixed(2)})
                </div>
                <div className="text-red-400">
                  Garment: ({pair.garmentPoint.x.toFixed(2)}, {pair.garmentPoint.y.toFixed(2)}, {pair.garmentPoint.z.toFixed(2)})
                </div>
              </div>
              <button
                onClick={() => onPairRemove(index)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {alignmentPairs.length === 0 && (
            <p className="text-xs text-gray-500 p-2">No alignment pairs created</p>
          )}
        </div>
      </div>
    </div>
  );
}