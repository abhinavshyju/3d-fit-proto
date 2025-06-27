import { loadModel } from "../loadModel";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

import { createPoint } from "../create-point";
import type { ColorName } from "../constant/colors";
import { retarget } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createPlaneFromThreePoints } from "../create-plane";
import { getModelPlaneIntersections } from "../model-intersector";
import { getPlaneFromMesh } from "../planeFromMesh";
import { sortPointsNearestNeighbor } from "../sort";
import type { Landmark, MasterJson } from "../type";
import { importMasterJsonFromFile } from "../JsonImport";

export const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0x303030);

export const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  540 / 600,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(540, 600);
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
let garmentModel: THREE.Object3D | null = null;
let garmentName: string;

const masterJson: MasterJson = {
  fileName: null,
  body: {
    bodyName: null,
    levels: [],
  },
  bodyLevels: [],
  landmarks: [],
  category: null,
  date: null,
  fitName: null,
  subcategory: null,
  tolerance: null,
  version: null,
  unit: null,
  criticalMeasurement: null,
  value: null,
  trails: null,
  garment: {
    name: "",
    levels: [],
  },
};
let measure = false;
(window as any).bodyUpload = (event: Event) => {
  loadModel(
    event,
    scene,
    "body",
    (model: THREE.Object3D, LocalfileName: string) => {
      bodyModel = model;
    }
  );
};
(window as any).garmentUpload = (event: Event) => {
  loadModel(
    event,
    scene,
    "garment",
    (model: THREE.Object3D, LocalfileName: string) => {
      garmentModel = model;
      garmentName = LocalfileName;
      if (masterJson.garment) {
        masterJson.garment.name = garmentName;
      }
    }
  );
};
(window as any).jsomUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const parsedJson = await importMasterJsonFromFile(file);
    console.log(parsedJson);
    masterJson.fileName = parsedJson.fileName ?? null;
    masterJson.bodyLevels = parsedJson.bodyLevels ?? [];
    masterJson.landmarks = parsedJson.landmarks ?? [];

    // Clear previous levels before pushing new ones
    if (masterJson.body && Array.isArray(masterJson.body.levels)) {
      masterJson.body.levels.length = 0;
    } else if (masterJson.body) {
      masterJson.body.levels = [];
    }

    const landmarkTableHead = document.getElementById("landmarkTableHead");
    if (!landmarkTableHead) return;
    landmarkTableHead.innerHTML = "";
    parsedJson.bodyLevels?.forEach((item) => {
      const th = document.createElement("th");
      th.classList.add("text-left", "font-bold", "p-2");
      th.innerText = item?.toUpperCase() || "none";
      landmarkTableHead.appendChild(th);
    });
    const measurementBody = document.getElementById("measurementBody");
    if (!measurementBody) return;
    measurementBody.innerHTML = "";
    parsedJson.landmarks?.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-2 font-medium">${item}</td>
      `;
      measurementBody.appendChild(tr);
    });

    parsedJson.body?.levels?.forEach((item) => {
      if (!item?.intersectionPoints) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(
        item?.intersectionPoints
      );
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      const points: Landmark[] = [];

      item.landmarks?.forEach((point) => {
        if (!point || !point.point || !point.name || !point.color) return;
        const markerPoint = createPoint(point.color as ColorName);
        markerPoint.position.copy(point.point);
        scene.add(markerPoint);
        points.push({
          name: point.name,
          distance: 0,
          color: point.color,
          point: point.point,
        });
      });
      if (masterJson.body && Array.isArray(masterJson.body.levels)) {
        masterJson.body.levels.push({
          name: item.name,
          intersectionPoints: item.intersectionPoints,
          landmarks: points,
        });
      }
    });
  } catch (err: any) {
    console.error("Error parsing JSON:", err.message);
  }
};

(window as any).calculateMeasurement = () => {
  if (!garmentModel || !bodyModel) return;

  // Clear previous garment levels before pushing new ones
  if (masterJson.garment && Array.isArray(masterJson.garment.levels)) {
    masterJson.garment.levels.length = 0;
  } else if (masterJson.garment) {
    masterJson.garment.levels = [];
  }

  masterJson.body?.levels?.forEach((item) => {
    if (!item || !item.intersectionPoints) return;
    const points = item.intersectionPoints;
    const len = points.length;
    if (len < 3) return;

    const idx1 = Math.floor(Math.random() * (len / 3));
    const idx2 = Math.floor(len / 3) + Math.floor(Math.random() * (len / 3));
    const idx3 =
      Math.floor((2 * len) / 3) + Math.floor(Math.random() * (len / 3));
    const garmentIntersectionPlane = createPlaneFromThreePoints(
      points[idx1],
      points[idx2],
      points[idx3]
    );
    if (!garmentModel) return;
    const garmentIntersectionPoints = sortPointsNearestNeighbor(
      getModelPlaneIntersections(
        garmentModel,
        getPlaneFromMesh(garmentIntersectionPlane)
      )
    );
    const landmarkPoints: Landmark[] = [];

    item.landmarks?.forEach((point) => {
      if (!point || !point.point || !point.name || !point.color) return;
      let minDistance = Infinity;
      let nearestPoint: THREE.Vector3 | null = null;
      garmentIntersectionPoints.forEach((obj) => {
        const distance = obj.distanceTo(point.point!);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = obj.clone();
        }
      });
      if (!nearestPoint) return;
      landmarkPoints.push({
        name: point.name,
        color: point.color,
        point: nearestPoint,
        distance: minDistance * 100,
      });
      const markerPoint = createPoint(point.color as ColorName);
      markerPoint.position.copy(nearestPoint);
      scene.add(markerPoint);
    });
    if (masterJson.garment && Array.isArray(masterJson.garment.levels)) {
      masterJson.garment.levels.push({
        intersectionPoints: garmentIntersectionPoints,
        landmarks: landmarkPoints,
        name: item.name,
      });
    }
    measure = true;
  });

  const measurementBody = document.getElementById("measurementBody");
  if (!measurementBody) return;

  const rows: string[] = [];
  const distanceMatrix: number[][] = [];

  (masterJson.landmarks ?? []).forEach((landmark, i) => {
    const rowDistances: number[] = [];
    let rowCells = "";

    (masterJson.bodyLevels ?? []).forEach((bodyLevel) => {
      if (!bodyLevel) {
        rowCells += `<td class="p-2 text-center">0.00</td>`;
        rowDistances.push(0);
        return;
      }
      const level = masterJson.garment?.levels?.find(
        (lvl) => lvl?.name === bodyLevel
      );
      let distance = 0;
      if (level) {
        const point = level.landmarks?.find((pt) => pt?.name === landmark);
        if (point && typeof point.distance === "number")
          distance = point.distance;
      }
      rowCells += `<td class="p-2 text-center">${distance.toFixed(2)}</td>`;
      rowDistances.push(distance);
    });

    distanceMatrix.push(rowDistances);
    const rowHTML = `<tr><td class="p-2 font-medium">${
      landmark?.toUpperCase?.() ?? ""
    }</td>${rowCells}</tr>`;
    rows.push(rowHTML);
  });

  const getColumnStats = (index: number) => {
    const col = distanceMatrix.map((row) => row[index]);
    const min = Math.min(...col);
    const max = Math.max(...col);
    const avg = col.reduce((a, b) => a + b, 0) / col.length;
    return { min, max, avg };
  };

  const buildStatRow = (
    label: string,
    valueGetter: (stat: ReturnType<typeof getColumnStats>) => number
  ) => {
    const cells = (masterJson.bodyLevels ?? []).map((_, i) => {
      const stat = getColumnStats(i);
      return `<td class="p-2 text-center font-semibold">${valueGetter(
        stat
      ).toFixed(2)}</td>`;
    });
    return `<tr class="bg-gray-100"><td class="p-2 font-bold">${label}</td>${(
      cells ?? []
    ).join("")}</tr>`;
  };

  rows.push(buildStatRow("MAX", (s) => s.max));
  rows.push(buildStatRow("MIN", (s) => s.min));
  rows.push(buildStatRow("AVG", (s) => s.avg));

  measurementBody.innerHTML = rows.join("");
};
function initTextInputs() {
  const inputs = [
    { id: "BodyX", model: () => bodyModel, axis: "x" },
    { id: "BodyY", model: () => bodyModel, axis: "y" },
    { id: "BodyZ", model: () => bodyModel, axis: "z" },
    { id: "garmentX", model: () => garmentModel, axis: "x" },
    { id: "garmentY", model: () => garmentModel, axis: "y" },
    { id: "garmentZ", model: () => garmentModel, axis: "z" },
  ];

  inputs.forEach(({ id, model, axis }) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;

    input.addEventListener("input", () => {
      const value = parseFloat(input.value);
      if (isNaN(value)) return;

      const target = model();
      if (target) {
        (target.position as any)[axis] = value;
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", initTextInputs);
(window as any).saveJson = () => {
  console.log(masterJson);
  if (!measure) return;
  const json = JSON.stringify(masterJson, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${masterJson.fileName}_measurement.json`;
  link.click();

  URL.revokeObjectURL(url);
};
