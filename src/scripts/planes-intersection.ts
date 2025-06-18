import * as THREE from "three";

export const intersectThreePlanes = (
  p1: THREE.Plane,
  p2: THREE.Plane,
  p3: THREE.Plane
): THREE.Vector3 | null => {
  const n1 = p1.normal;
  const n2 = p2.normal;
  const n3 = p3.normal;

  const d1 = -p1.constant;
  const d2 = -p2.constant;
  const d3 = -p3.constant;

  const n1xn2 = new THREE.Vector3().crossVectors(n1, n2);
  const n2xn3 = new THREE.Vector3().crossVectors(n2, n3);
  const n3xn1 = new THREE.Vector3().crossVectors(n3, n1);

  const numerator = new THREE.Vector3()
    .addScaledVector(n2xn3, d1)
    .addScaledVector(n3xn1, d2)
    .addScaledVector(n1xn2, d3);

  const denominator = n1.dot(n2xn3);

  if (Math.abs(denominator) < 1e-6) {
    return null;
  }

  return numerator.divideScalar(denominator);
};
