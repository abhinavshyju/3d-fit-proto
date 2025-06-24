import * as THREE from "three";

interface MasterJson {
  fileName: string;
  bodyLevels: string[];
  landmarkPoints: string[];
  levels: Array<{
    name: string;
    intersectionPoints: THREE.Vector3[];
    planeMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    points: Array<{
      name: string;
      point: THREE.Vector3;
      color: string;
    }>;
  }>;
}

export function importMasterJson(json: string | object): MasterJson {
  let data: any;

  if (typeof json === "string") {
    try {
      data = JSON.parse(json);
    } catch (err: any) {
      throw new Error(`Invalid JSON string: ${err.message}`);
    }
  } else {
    data = json;
  }

  if (
    typeof data.fileName !== "string" ||
    !Array.isArray(data.bodyLevels) ||
    !Array.isArray(data.landmarkPoints) ||
    !Array.isArray(data.levels)
  ) {
    throw new Error("Invalid MasterJson structure");
  }

  const dummyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dummyGeometry = new THREE.PlaneGeometry(1, 1);

  const levels = data.levels.map((level: any) => {
    if (
      typeof level.name !== "string" ||
      !Array.isArray(level.intersectionPoints) ||
      !Array.isArray(level.points)
    ) {
      throw new Error("Invalid level structure");
    }

    const intersectionPoints = level.intersectionPoints.map((p: any) => {
      if (
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        typeof p.z === "number"
      ) {
        return new THREE.Vector3(p.x, p.y, p.z);
      }
      throw new Error("Invalid intersection point");
    });

    const points = level.points.map((pt: any) => {
      if (
        typeof pt.name === "string" &&
        pt.point &&
        typeof pt.point.x === "number" &&
        typeof pt.point.y === "number" &&
        typeof pt.point.z === "number" &&
        typeof pt.color === "string"
      ) {
        return {
          name: pt.name,
          point: new THREE.Vector3(pt.point.x, pt.point.y, pt.point.z),
          color: pt.color,
        };
      }
      throw new Error("Invalid point structure");
    });

    return {
      name: level.name,
      intersectionPoints,
      planeMesh: new THREE.Mesh(dummyGeometry, dummyMaterial),
      points,
    };
  });

  return {
    fileName: data.fileName,
    bodyLevels: data.bodyLevels,
    landmarkPoints: data.landmarkPoints,
    levels,
  };
}
