import * as THREE from "three";

export interface MasterJson {
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

function parseVector3Array(arr: any[]): THREE.Vector3[] {
  return arr.map((v) => new THREE.Vector3(v.x, v.y, v.z));
}

export async function importMasterJsonFromFile(
  file: File
): Promise<MasterJson> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);

        const parsed: MasterJson = {
          fileName: raw.fileName,
          fitName: raw.fitName,
          tolerance: raw.tolerance,
          subcategory: raw.subcategory,
          date: raw.date,
          category: raw.category,
          version: raw.version,
          models: [], // fill if needed; cannot deserialize THREE.Object3D from JSON directly
          value: raw.value.map((item: any) => ({
            levelName: item.levelName,
            bodyIntersectionPoints: parseVector3Array(
              item.bodyIntersectionPoints
            ),
            dressIntersectionPoints: parseVector3Array(
              item.dressIntersectionPoints
            ),
            landmarks: item.landmarks.map((lm: any) => ({
              name: lm.name,
              point: new THREE.Vector3(lm.point.x, lm.point.y, lm.point.z),
              dis: lm.dis,
              value: lm.value,
              avg: lm.avg,
            })),
          })),
          bodyLevels: raw.bodyLevels,
          landmarkPoints: raw.landmarkPoints,
          criticalMeasurement: raw.criticalMeasurement,
          trails: raw.trails.map((trail: any) => ({
            trailname: trail.trailname,
            levels: trail.levels.map((level: any) => ({
              name: level.name,
              bodyIntersectionPoints: parseVector3Array(
                level.bodyIntersectionPoints
              ),
              dressIntersectionPoints: parseVector3Array(
                level.dressIntersectionPoints
              ),
              points: level.points.map((pt: any) => ({
                name: pt.name,
                bodyPoint: new THREE.Vector3(
                  pt.bodyPoint.x,
                  pt.bodyPoint.y,
                  pt.bodyPoint.z
                ),
                dressPoint: new THREE.Vector3(
                  pt.dressPoint.x,
                  pt.dressPoint.y,
                  pt.dressPoint.z
                ),
                distance: pt.distance,
                color: pt.color,
              })),
            })),
          })),
        };

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
