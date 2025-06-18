import * as THREE from "three";
export const createPlaneFromThreePoints = (
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  point3: THREE.Vector3,
  size: number = 10
): THREE.Mesh<
  THREE.PlaneGeometry,
  THREE.MeshBasicMaterial,
  THREE.Object3DEventMap
> => {
  const vector1 = new THREE.Vector3().subVectors(point2, point1);
  const vector2 = new THREE.Vector3().subVectors(point3, point1);
  const normal = new THREE.Vector3().crossVectors(vector1, vector2).normalize();
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const planeMesh = new THREE.Mesh(geometry, material);
  planeMesh.lookAt(normal);
  planeMesh.position.copy(point1);
  return planeMesh;
};

export const createPlaneFromFourPoints = (
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  p4: THREE.Vector3
): THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshBasicMaterial,
  THREE.Object3DEventMap
> => {
  const geometry = new THREE.BufferGeometry();

  // Define the vertices (two triangles to form the quad)
  const vertices = new Float32Array([
    p1.x,
    p1.y,
    p1.z,
    p2.x,
    p2.y,
    p2.z,
    p3.x,
    p3.y,
    p3.z,

    p3.x,
    p3.y,
    p3.z,
    p4.x,
    p4.y,
    p4.z,
    p1.x,
    p1.y,
    p1.z,
  ]);

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
};

export const createPlaneWithNormal = (
  center: THREE.Vector3,
  normal: THREE.Vector3,
  size: number = 10
) => {
  const geometry = new THREE.PlaneGeometry(size, size);

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(geometry, material);
  const defaultNormal = new THREE.Vector3(0, 0, 1);

  const targetNormal = normal.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    defaultNormal,
    targetNormal
  );

  plane.quaternion.copy(quaternion);

  plane.position.copy(center);
  return plane;
};
