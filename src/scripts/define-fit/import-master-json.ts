import * as THREE from "three";

interface MasterJson {
  fileName: string;
  garmentName: string;
  bodyLevels: string[];
  landmarkPoints: string[];
  levels: Array<{
    name: string;
    bodyIntersectionPoints: THREE.Vector3[];
    dressIntersectionPoints: THREE.Vector3[];
    garmentLandmark: Array<{
      name: string;
      bodyPoint: THREE.Vector3;
      dressPoint: THREE.Vector3;
      distance: number;
      color: string;
    }>;
  }>;
}

function parseVector3(obj: any): THREE.Vector3 {
  return new THREE.Vector3(obj.x, obj.y, obj.z);
}

export async function importMasterJsonFromFile(
  file: File
): Promise<MasterJson> {
  return new Promise<MasterJson>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);

        const hydrated: MasterJson = {
          fileName: parsed.fileName,
          garmentName: parsed.garmentName,
          bodyLevels: parsed.bodyLevels,
          landmarkPoints: parsed.landmarkPoints,
          levels: parsed.levels.map((level: any) => ({
            name: level.name,
            bodyIntersectionPoints:
              level.bodyIntersectionPoints.map(parseVector3),
            dressIntersectionPoints:
              level.dressIntersectionPoints.map(parseVector3),
            garmentLandmark: level.garmentLandmark.map((pt: any) => ({
              name: pt.name,
              bodyPoint: parseVector3(pt.bodyPoint),
              dressPoint: parseVector3(pt.dressPoint),
              distance: pt.distance,
              color: pt.color,
            })),
          })),
        };

        resolve(hydrated);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.readAsText(file);
  });
}
