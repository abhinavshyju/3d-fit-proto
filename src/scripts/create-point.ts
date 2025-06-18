import * as THREE from "three";
import { colors, type ColorName } from "./constant/colors";

export const createPoint = (
  color: ColorName
): THREE.Mesh<
  THREE.SphereGeometry,
  THREE.MeshBasicMaterial,
  THREE.Object3DEventMap
> => {
  const pointMaterial = new THREE.MeshBasicMaterial({
    color: colors[color as ColorName].hexNum || 0x000000,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    pointMaterial
  );
  return sphere;
};
