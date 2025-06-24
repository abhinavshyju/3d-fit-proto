import { loadModel } from "../loadModel";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { importMasterJson } from "./import-master-json";
import { createPoint } from "../create-point";
import type { ColorName } from "../constant/colors";
import { retarget } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createPlaneFromThreePoints } from "../create-plane";
import { getModelPlaneIntersections } from "../model-intersector";
import { getPlaneFromMesh } from "../planeFromMesh";
import { sortPointsNearestNeighbor } from "../sort";
import { intersectThreePlanes } from "../planes-intersection";
import { alignMeshToXZPlane } from "../utils";

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

const directionalLight1 = new THREE.DirectionalLight(0xffffff);
directionalLight1.position.set(5, 10, 7.5);
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffffff);
directionalLight2.position.set(5, 10, -7.5);
scene.add(directionalLight2);

const directionalLight3 = new THREE.DirectionalLight(0xffffff);
directionalLight3.position.set(-5, 10, 7.5);
scene.add(directionalLight3);

const directionalLight4 = new THREE.DirectionalLight(0xffffff);
directionalLight4.position.set(-5, 10, -7.5);
scene.add(directionalLight4);

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

const axesHelper: THREE.AxesHelper = new THREE.AxesHelper(100);
axesHelper.position.set(0, 0, 0);
scene.add(axesHelper);

let bodyModel: THREE.Object3D | null = null;
let gramentModel: THREE.Object3D | null = null;
let fileName: string;
let garmentName: string;
let sagittalPlane: THREE.Mesh | null = null;
let coronalPlane: THREE.Mesh | null = null;
let transversePlane: THREE.Mesh | null = null;
const modelGroup = new THREE.Group();
scene.add(modelGroup);

interface MasterJson {
  fileName: string;
  garmentName: string;
  bodyLevels: string[];
  landmarkPoints: string[];
  levels: Array<{
    name: string;
    bodyIntersectionPoints: THREE.Vector3[];
    dressIntersectionPoints: THREE.Vector3[];
    points: Array<{
      name: string;
      bodyPoint: THREE.Vector3;
      dressPoint: THREE.Vector3;
      distance: number;
      color: string;
    }>;
  }>;
}

const masterJson: MasterJson = {
  fileName: "",
  garmentName: "",
  levels: [],
  bodyLevels: [],
  landmarkPoints: [],
};
let measure = false;

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
      fileName = LocalfileName;
      scene.remove(bodyModel);
      modelGroup.add(bodyModel);
    }
  );
};
const pivotHelper = new THREE.AxesHelper(10);
modelGroup.add(pivotHelper);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickPoints: THREE.Vector3[] = [];
const points: { name: string; type: string; point: THREE.Mesh }[] = [];
let currentPlaneToCreate: "sagittal" | "coronal" | "transverse" | null = null;

function onClick(event: { clientX: number; clientY: number }) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (!bodyModel) return;

  const getIntersection = (model: THREE.Object3D) => {
    const intersects = raycaster.intersectObject(model, true);
    return intersects.length ? intersects[0].point.clone() : null;
  };

  if (!currentPlaneToCreate) {
    alert("Select which plane to create first.");
    return;
  }

  const point = getIntersection(bodyModel);
  if (!point) return;

  const marker = createPoint("red");
  marker.position.copy(point);
  scene.add(marker);
  points.push({ name: "temp points", type: "temp", point: marker });
  clickPoints.push(point);

  if (clickPoints.length === 3) {
    const planeMesh = createPlaneFromThreePoints(
      clickPoints[0],
      clickPoints[1],
      clickPoints[2]
    );
    scene.add(planeMesh);

    if (currentPlaneToCreate === "sagittal") {
      sagittalPlane = planeMesh;
    } else if (currentPlaneToCreate === "coronal") {
      coronalPlane = planeMesh;
    } else if (currentPlaneToCreate === "transverse") {
      transversePlane = planeMesh;
    }

    clickPoints.length = 0;
    currentPlaneToCreate = null;
  }
}

function startPlaneCreation(planeType: "sagittal" | "coronal" | "transverse") {
  currentPlaneToCreate = planeType;
  clickPoints.length = 0;

  points.filter((p) => p.type === "temp").forEach((p) => scene.remove(p.point));
  const nonTempPoints = points.filter((p) => p.type !== "temp");
  points.length = 0;
  points.push(...nonTempPoints);

  if (planeType === "sagittal" && sagittalPlane) scene.remove(sagittalPlane);
  if (planeType === "coronal" && coronalPlane) scene.remove(coronalPlane);
  if (planeType === "transverse" && transversePlane)
    scene.remove(transversePlane);

  alert(`Click 3 points on the body to define the ${planeType} plane.`);
}

(window as any).createSaPlane = () => startPlaneCreation("sagittal");
(window as any).createCrPlane = () => startPlaneCreation("coronal");
(window as any).createTrPlane = () => startPlaneCreation("transverse");

(window as any).alignBody = () => {
  if (!sagittalPlane || !coronalPlane || !transversePlane) {
    alert("Please define all three planes first.");
    return;
  }

  const intersectionPoint = intersectThreePlanes(
    getPlaneFromMesh(sagittalPlane),
    getPlaneFromMesh(transversePlane),
    getPlaneFromMesh(coronalPlane)
  );

  const sagittalNormal = getPlaneFromMesh(sagittalPlane).normal;
  const transverseNormal = getPlaneFromMesh(transversePlane).normal;

  const newX = sagittalNormal.clone().normalize();
  const newY = transverseNormal.clone().projectOnPlane(newX).normalize();
  const newZ = newX.clone().cross(newY);

  const rotationMatrix = new THREE.Matrix4().makeBasis(newX, newY, newZ);
  const worldToModelRotation = rotationMatrix.clone().invert();

  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    worldToModelRotation
  );

  if (intersectionPoint && bodyModel) {
    const worldToGroup = new THREE.Matrix4();
    modelGroup.updateWorldMatrix(true, false);
    worldToGroup.copy(modelGroup.matrixWorld).invert();

    const intersectionPointInGroup = intersectionPoint
      .clone()
      .applyMatrix4(worldToGroup);

    bodyModel.position.sub(intersectionPointInGroup);
  }

  modelGroup.quaternion.premultiply(quaternion);

  scene.remove(sagittalPlane);
  scene.remove(coronalPlane);
  scene.remove(transversePlane);
  sagittalPlane = null;
  coronalPlane = null;
  transversePlane = null;
  points.filter((p) => p.type === "temp").forEach((p) => scene.remove(p.point));
  camera.position.set(0, 0, 10);
};

(window as any).rotateX180 = () => {
  if (modelGroup) {
    modelGroup.rotation.x += Math.PI;
  }
};

(window as any).rotateY180 = () => {
  if (modelGroup) {
    modelGroup.rotation.y += Math.PI;
  }
};

(window as any).rotateZ180 = () => {
  if (modelGroup) {
    modelGroup.rotation.z += Math.PI;
  }
};

window.addEventListener("dblclick", onClick);
