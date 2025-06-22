import type { Scene } from "three";
import * as THREE from "three";
import { MTLLoader, OBJLoader } from "three/examples/jsm/Addons.js";

let fileMap: Record<string, File> = {};
export const loadModel = (
  event: Event,
  scene: Scene,
  type: string,
  onLoad: { (loaded: any, fileName: string): void }
) => {
  // Show loading spinner
  const spinner = document.getElementById("loading-spinner");
  if (spinner) spinner.style.display = "block";

  const input = event.target as HTMLInputElement;
  const files = input.files;

  fileMap = {};

  if (!files) return;

  for (const file of Array.from(files)) {
    fileMap[file.name] = file;
  }

  const objFile = Object.values(fileMap).find((f) => f.name.endsWith(".obj"));
  const mtlFile = Object.values(fileMap).find((f) => f.name.endsWith(".mtl"));

  if (objFile && mtlFile) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url: string): string => {
      const normalizedUrl = url.replace(/^.*[\\\/]/, "");
      const file = fileMap[normalizedUrl];
      return file ? URL.createObjectURL(file) : url;
    });

    const mtlLoader = new MTLLoader(manager);
    mtlLoader.load(
      URL.createObjectURL(mtlFile),
      (materials) => {
        materials.preload();

        const objLoader = new OBJLoader(manager);
        objLoader.setMaterials(materials);

        objLoader.load(
          URL.createObjectURL(objFile),
          (object) => {
            object.position.set(0, 0, 0);
            object.scale.set(0.01, 0.01, 0.01);

            if (type == "body") {
            } else {
              object.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  const material = mesh.material as THREE.MeshStandardMaterial;
                  if (material) {
                    material.transparent = true;
                    material.opacity = 0.3;
                    material.color.set(0xffffff);
                  }
                }
              });
            }
            scene.add(object);
            if (onLoad) onLoad(object, objFile.name.replace(".obj", ""));
            // Hide loading spinner on success
            if (spinner) spinner.style.display = "none";
          },
          undefined,
          (error) => {
            // Hide loading spinner on error
            if (spinner) spinner.style.display = "none";
            alert("Failed to load OBJ file.");
          }
        );
      },
      undefined,
      (error) => {
        // Hide loading spinner on error
        if (spinner) spinner.style.display = "none";
        alert("Failed to load MTL file.");
      }
    );
  } else {
    // Hide loading spinner if files are missing
    if (spinner) spinner.style.display = "none";
    alert("Please select both OBJ and MTL files.");
  }
};
