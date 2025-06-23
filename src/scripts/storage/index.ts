import { atom } from "nanostores";
import * as THREE from "three";

// Type Definitions
export interface FinalJson {
  fileName: string;
  fitName: string;
  tolerance: number;
  subcategory: string;
  date: string;
  category: string;
  version: string;
  models: Array<{
    name: string;
    body: boolean;
    model: THREE.Object3D<THREE.Object3DEventMap>;
  }>;
  value: Array<{
    levelName: string;
    bodyIntersectionPoints: THREE.Vector3[];
    dressIntersectionPoints: THREE.Vector3[];
    landmarks: Array<{
      name: string;
      point: THREE.Vector3;
      dis: number;
      value: number;
      avg: number;
    }>;
  }>;
  bodyLevels: string[];
  landmarkPoints: string[];
  criticalMeasurement: Array<{
    level: string;
    landmark: string;
    critical: boolean;
  }>;
  trails: Array<{
    trailname: string;
    levels: Array<{
      name: string;
      bodyIntersectionPoints: THREE.Vector3[];
      dressIntersectionPoints: THREE.Vector3[];
      points: Array<{
        name: string;
        bodyPoint: THREE.Vector3;
        dressPoint: THREE.Vector3;
        distance: number;
        color: string;
      }>;
    }>;
  }>;
}

// Store
export const finalJsonStore = atom<FinalJson | null>(null);

// Actions
export const setFinalJson = (data: FinalJson | null) => {
  finalJsonStore.set(data);
};

export const updateFinalJson = (updater: (current: FinalJson) => FinalJson) => {
  const current = finalJsonStore.get();
  if (current) {
    finalJsonStore.set(updater(current));
  }
};
