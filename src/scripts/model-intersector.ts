import { BufferGeometryUtils } from "three/examples/jsm/Addons.js";
import * as THREE from "three";

export function getModelPlaneIntersections(
  model: THREE.Object3D<THREE.Object3DEventMap>,
  plane: THREE.Plane,
  pointA?: { x: any; y: any },
  pointB?: { x: any; y: any }
) {
  const intersections = [];
  const geometries: THREE.BufferGeometry[] = [];

  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);
      geometries.push(geom);
    }
  });

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  const pos = merged.attributes.position;
  const index = merged.index ? merged.index.array : null;

  for (let i = 0; i < (index ? index.length : pos.count); i += 3) {
    const i0 = index ? index[i] : i;
    const i1 = index ? index[i + 1] : i + 1;
    const i2 = index ? index[i + 2] : i + 2;

    const a = new THREE.Vector3().fromBufferAttribute(pos, i0);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i2);

    const edgeIntersections: THREE.Vector3[] = [];

    [
      [a, b],
      [b, c],
      [c, a],
    ].forEach(([p1, p2]) => {
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const denom = plane.normal.dot(dir);

      if (Math.abs(denom) > 1e-6) {
        const t = -(plane.normal.dot(p1) + plane.constant) / denom;
        if (t >= 0 && t <= 1) {
          const intersect = new THREE.Vector3()
            .copy(p1)
            .addScaledVector(dir, t);
          edgeIntersections.push(intersect);
        }
      }
    });

    if (edgeIntersections.length >= 2) {
      intersections.push(...edgeIntersections.slice(0, 2));
    }
  }

  const intersectionsPoints: THREE.Vector3[] = [];
  if (pointA && pointB) {
    intersections.map((item) => {
      if (
        (item.x, pointA.x, pointB.x) &&
        isBetween(item.y, pointA.y, pointB.y)
      ) {
        intersectionsPoints.push(item);
      }
    });
    return intersectionsPoints;
  }
  return intersections;
}
function isBetween(value: number, a: number, b: number) {
  return value >= Math.min(a, b) && value <= Math.max(a, b);
}
