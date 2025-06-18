import * as THREE from "three";
function distance(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
export function sortPointsNearestNeighbor(
  points: THREE.Vector3[]
): THREE.Vector3[] {
  const remaining: THREE.Vector3[] = [...points];
  const sorted: THREE.Vector3[] = [];

  if (remaining.length === 0) return sorted;

  let current = remaining.shift()!;
  sorted.push(current);

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = distance(current, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const d = distance(current, remaining[i]);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    sorted.push(current);
  }
  sorted.push(sorted[0]);

  return sorted;
}

export const filterXInRange = (
  points: { x: number; y: number; z: number }[]
): THREE.Vector3[] => {
  return points
    .filter((p) => p.x >= -1.56 && p.x <= 1.56)
    .map((p) => new THREE.Vector3(p.x, p.y, p.z));
};
