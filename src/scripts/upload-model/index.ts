import { loadModel } from "../loadModel";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { createPoint } from "../create-point";
import { createPlaneFromThreePoints } from "../create-plane";
import { getPlaneFromMesh } from "../planeFromMesh";
import { intersectThreePlanes } from "../planes-intersection";

export const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0xededed);

export const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
const viewPort: HTMLElement | null = document.getElementById("viewPort");
if (viewPort) viewPort.appendChild(renderer.domElement);

const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
[1, 2, 3, 4].forEach((i) => {
  const light = new THREE.DirectionalLight(0xffffff);
  const x = i <= 2 ? 5 : -5;
  const z = i % 2 === 1 ? 7.5 : -7.5;
  light.position.set(x, 10, z);
  scene.add(light);
});

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);

const modelGroup = new THREE.Group();
scene.add(modelGroup);

let bodyModel: THREE.Object3D | null = null;
let sagittalPlane: THREE.Mesh | null = null;
let coronalPlane: THREE.Mesh | null = null;
let transversePlane: THREE.Mesh | null = null;

const clickPoints: THREE.Vector3[] = [];
let currentPlaneToCreate: "sagittal" | "coronal" | "transverse" | null = null;

function setDoubleSide(model: THREE.Object3D) {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => (m.side = THREE.DoubleSide));
      } else {
        child.material.side = THREE.DoubleSide;
      }
    }
  });
}

(window as any).bodyUpload = (event: Event) => {
  loadModel(
    event,
    scene,
    "body",
    (model: THREE.Object3D, LocalfileName: string) => {
      bodyModel = model;
      setDoubleSide(bodyModel);
      scene.remove(bodyModel);
      modelGroup.add(bodyModel);
    }
  );
};

function onClick(event: MouseEvent) {
  if (!currentPlaneToCreate || !bodyModel) return;

  const mouse = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersect = raycaster.intersectObject(bodyModel, true);
  if (!intersect.length) return;
  const point = intersect[0].point.clone();

  const marker = createPoint("red");
  marker.position.copy(point);
  scene.add(marker);
  clickPoints.push(point);

  if (clickPoints.length === 3) {
    const planeMesh = createPlaneFromThreePoints(
      clickPoints[0],
      clickPoints[1],
      clickPoints[2]
    );
    scene.add(planeMesh);

    if (currentPlaneToCreate === "sagittal") sagittalPlane = planeMesh;
    if (currentPlaneToCreate === "coronal") coronalPlane = planeMesh;
    if (currentPlaneToCreate === "transverse") transversePlane = planeMesh;

    clickPoints.length = 0;
    currentPlaneToCreate = null;
  }
}
window.addEventListener("dblclick", onClick);

function startPlaneCreation(type: "sagittal" | "coronal" | "transverse") {
  currentPlaneToCreate = type;
  clickPoints.length = 0;
  alert(`Click 3 points on the body to define the ${type} plane.`);
}

(window as any).createSaPlane = () => startPlaneCreation("sagittal");
(window as any).createCrPlane = () => startPlaneCreation("coronal");
(window as any).createTrPlane = () => startPlaneCreation("transverse");

// New unified alignment function
function alignAndPivot() {
  if (!sagittalPlane || !coronalPlane || !transversePlane || !bodyModel) {
    alert("Please define all three planes and load a model first.");
    return;
  }

  const sagittal = getPlaneFromMesh(sagittalPlane);
  const coronal = getPlaneFromMesh(coronalPlane);
  const transverse = getPlaneFromMesh(transversePlane);

  const intersectionPoint = intersectThreePlanes(sagittal, coronal, transverse);
  if (!intersectionPoint) {
    alert("Planes do not intersect properly.");
    return;
  }

  // Build orthonormal basis
  const xAxis = sagittal.normal.clone().normalize();
  const yAxisUn = transverse.normal.clone().normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxisUn).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const rotQuat = new THREE.Quaternion().setFromRotationMatrix(
    rotMat.clone().invert()
  );

  // Translate pivot to origin
  const invWorld = new THREE.Matrix4().copy(modelGroup.matrixWorld).invert();
  const localPivot = intersectionPoint.clone().applyMatrix4(invWorld);
  bodyModel.position.sub(localPivot);

  // Apply rotation
  modelGroup.quaternion.premultiply(rotQuat);

  // Cleanup
  camera.position.set(0, 0, 10);
  scene.remove(sagittalPlane, coronalPlane, transversePlane);
  sagittalPlane = coronalPlane = transversePlane = null;
}
(window as any).alignBody = alignAndPivot;

(window as any).rotateX180 = () => {
  modelGroup.rotation.x += Math.PI;
};
(window as any).rotateY180 = () => {
  modelGroup.rotation.y += Math.PI;
};
(window as any).rotateZ180 = () => {
  modelGroup.rotation.z += Math.PI;
};
function saveAlignedOBJ() {
  if (!bodyModel) {
    alert("Please load a model first.");
    return;
  }

  const objContent = generateOBJContent(bodyModel, modelGroup);

  const blob = new Blob([objContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aligned_model.obj";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function generateOBJContent(
  model: THREE.Object3D,
  parentGroup: THREE.Group
): string {
  let objContent = "# Aligned OBJ file\n";
  let vertexOffset = 0;
  let normalOffset = 0;
  let uvOffset = 0;

  const worldMatrix = new THREE.Matrix4();
  parentGroup.updateMatrixWorld(true);

  function processObject(obj: THREE.Object3D) {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      const geometry = obj.geometry;

      obj.updateMatrixWorld(true);
      const objWorldMatrix = obj.matrixWorld.clone();

      const geo = geometry.clone();
      geo.applyMatrix4(objWorldMatrix);

      const vertices = geo.attributes.position;
      const normals = geo.attributes.normal;
      const uvs = geo.attributes.uv;

      if (vertices) {
        for (let i = 0; i < vertices.count; i++) {
          const x = vertices.getX(i);
          const y = vertices.getY(i);
          const z = vertices.getZ(i);
          objContent += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
        }
      }

      if (normals) {
        for (let i = 0; i < normals.count; i++) {
          const x = normals.getX(i);
          const y = normals.getY(i);
          const z = normals.getZ(i);
          objContent += `vn ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
        }
      }

      if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
          const u = uvs.getX(i);
          const v = uvs.getY(i);
          objContent += `vt ${u.toFixed(6)} ${v.toFixed(6)}\n`;
        }
      }

      objContent += `o ${obj.name || "Object"}\n`;

      if (geo.index) {
        const indices = geo.index;
        for (let i = 0; i < indices.count; i += 3) {
          const a = indices.getX(i) + vertexOffset + 1;
          const b = indices.getX(i + 1) + vertexOffset + 1;
          const c = indices.getX(i + 2) + vertexOffset + 1;

          if (normals && uvs) {
            const na = indices.getX(i) + normalOffset + 1;
            const nb = indices.getX(i + 1) + normalOffset + 1;
            const nc = indices.getX(i + 2) + normalOffset + 1;
            const ua = indices.getX(i) + uvOffset + 1;
            const ub = indices.getX(i + 1) + uvOffset + 1;
            const uc = indices.getX(i + 2) + uvOffset + 1;
            objContent += `f ${a}/${ua}/${na} ${b}/${ub}/${nb} ${c}/${uc}/${nc}\n`;
          } else if (normals) {
            const na = indices.getX(i) + normalOffset + 1;
            const nb = indices.getX(i + 1) + normalOffset + 1;
            const nc = indices.getX(i + 2) + normalOffset + 1;
            objContent += `f ${a}//${na} ${b}//${nb} ${c}//${nc}\n`;
          } else if (uvs) {
            const ua = indices.getX(i) + uvOffset + 1;
            const ub = indices.getX(i + 1) + uvOffset + 1;
            const uc = indices.getX(i + 2) + uvOffset + 1;
            objContent += `f ${a}/${ua} ${b}/${ub} ${c}/${uc}\n`;
          } else {
            objContent += `f ${a} ${b} ${c}\n`;
          }
        }
      } else {
        const vertexCount = vertices.count;
        for (let i = 0; i < vertexCount; i += 3) {
          const a = i + vertexOffset + 1;
          const b = i + 1 + vertexOffset + 1;
          const c = i + 2 + vertexOffset + 1;

          if (normals && uvs) {
            const na = i + normalOffset + 1;
            const nb = i + 1 + normalOffset + 1;
            const nc = i + 2 + normalOffset + 1;
            const ua = i + uvOffset + 1;
            const ub = i + 1 + uvOffset + 1;
            const uc = i + 2 + uvOffset + 1;
            objContent += `f ${a}/${ua}/${na} ${b}/${ub}/${nb} ${c}/${uc}/${nc}\n`;
          } else if (normals) {
            const na = i + normalOffset + 1;
            const nb = i + 1 + normalOffset + 1;
            const nc = i + 2 + normalOffset + 1;
            objContent += `f ${a}//${na} ${b}//${nb} ${c}//${nc}\n`;
          } else if (uvs) {
            const ua = i + uvOffset + 1;
            const ub = i + 1 + uvOffset + 1;
            const uc = i + 2 + uvOffset + 1;
            objContent += `f ${a}/${ua} ${b}/${ub} ${c}/${uc}\n`;
          } else {
            objContent += `f ${a} ${b} ${c}\n`;
          }
        }
      }

      if (vertices) vertexOffset += vertices.count;
      if (normals) normalOffset += normals.count;
      if (uvs) uvOffset += uvs.count;
    }

    obj.children.forEach((child) => processObject(child));
  }

  processObject(model);
  return objContent;
}

(window as any).saveAlignedOBJ = saveAlignedOBJ;
