import * as THREE from "three";

export function alignMeshToXZPlane(
  planeMesh: THREE.Mesh,
  targetNormal: [number, number, number]
) {
  const normal = new THREE.Vector3(0, 0, 1);
  normal.applyQuaternion(planeMesh.quaternion);

  const target = new THREE.Vector3().fromArray(targetNormal).normalize();

  const rotationQuat = new THREE.Quaternion().setFromUnitVectors(
    normal,
    target
  );

  return { rotationQuat };
}

export function rotatePoints180(dataset: {
  label?: string;
  data: any;
  borderColor?: string;
  showLine?: boolean;
  pointRadius?: number;
  borderWidth?: number;
  pointHitRadius?: number;
}) {
  return {
    ...dataset,
    data: dataset.data.map(({ x, y }: { x: number; y: number }) => ({
      x: x,
      y: -y,
    })),
  };
}
