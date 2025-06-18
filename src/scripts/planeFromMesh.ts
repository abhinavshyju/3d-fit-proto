import * as THREE from "three";
export const getPlaneFromMesh = (mesh: THREE.Mesh): THREE.Plane => {
  const normal = new THREE.Vector3(0, 0, 1);
  normal.applyQuaternion(mesh.quaternion).normalize();
  const point = mesh.getWorldPosition(new THREE.Vector3());
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
};
