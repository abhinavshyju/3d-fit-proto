import { colors, type ColorName } from "../constant/colors";
import { createPlaneFromThreePoints } from "../create-plane";
import { createPoint } from "../create-point";
import { loadModel } from "../loadModel";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getModelPlaneIntersections } from "../model-intersector";
import { getPlaneFromMesh } from "../planeFromMesh";
import { sortPointsNearestNeighbor } from "../sort";
import { landMarks } from "../landmarks";
import Chart from "chart.js/auto";
import { DragControls } from "three/addons/controls/DragControls.js";
import type { MasterJson } from "../type";
import { getCurrentDateYYYYMMDD } from "../utils";
let value = 1;
// Types
interface Level {
  name: string;
  color: string;
}

interface Landmark {
  name: string;
}

interface LevelData {
  name: string;
  intersectionPoints: THREE.Vector3[];
  planeMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  points: Array<{
    name: string;
    point: THREE.Vector3;
    color: string;
  }>;
}

// Scene setup
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xededed);

export const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Initialize viewport
const initializeViewport = () => {
  const viewPort = document.getElementById("viewPort");
  if (viewPort) {
    viewPort.appendChild(renderer.domElement);
  }
};

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting setup
const setupLighting = () => {
  const ambientLight = new THREE.AmbientLight(0xffffff, 10);
  scene.add(ambientLight);
};
// Animation loop
const animate = (): void => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

// Application state
class AppState {
  private static instance: AppState;

  public bodyModel: THREE.Object3D | null = null;
  public fileName = "";
  public unit = 0;
  public selectedLevel = "";
  public selectTool:
    | "none"
    | "Create level"
    | "Add Landmark"
    | "Unit Measurement" = "none";
  public clickPoints: THREE.Vector3[] = [];
  public tempPoints: THREE.Mesh[] = [];
  public localIntersectionPlane: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null = null;
  public chartInstance: Chart | null = null;

  public readonly levels: Level[] = [
    { name: "bust", color: "green" },
    { name: "waist", color: "blue" },
    { name: "hip", color: "yellow" },
  ];

  public readonly landmarks: Landmark[] = [
    { name: "CF" },
    { name: "LFPS" },
    { name: "LSS" },
    { name: "LBPS" },
    { name: "CB" },
    { name: "RBPS" },
    { name: "RSS" },
    { name: "RFPS" },
  ];

  public createdLevels: Level[] = [];
  public localLevelData: LevelData[] = [];

  public masterJson: MasterJson = {
    fileName: "",
    unit: 1,
    body: {
      bodyName: "",
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
    criticalMeasurement: null,
    value: null,
    trails: null,
    garment: null,
  };
  public landMarkPoints: {
    level: string;
    landmark: string;
    point: THREE.Mesh;
  }[] = [];

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }
    return AppState.instance;
  }

  public reset(): void {
    this.clickPoints = [];
    this.tempPoints.forEach((point) => scene.remove(point));
    this.tempPoints = [];
    // this.selectTool = "none";
  }

  public addLevel(levelData: LevelData): void {
    this.localLevelData.push(levelData);
    this.masterJson.bodyLevels?.push(levelData.name);
    this.masterJson.body?.levels?.push({
      name: levelData.name,
      intersectionPoints: levelData.intersectionPoints,
      landmarks: levelData.points,
    });
  }

  public getLevelByName(name: string): LevelData | undefined {
    return this.localLevelData.find((level) => level.name === name);
  }
}

// DOM utilities
class DOMUtils {
  static getElementById<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  static toggleDialog(id: string, show: boolean): void {
    const dialog = this.getElementById(id);
    if (!dialog) return;

    if (show) {
      dialog.classList.remove("hidden");
      dialog.classList.add("flex");
    } else {
      dialog.classList.remove("flex");
      dialog.classList.add("hidden");
    }
  }

  static populateSelect(
    selectId: string,
    options: Array<{ value: string; text: string }>
  ): void {
    const select = this.getElementById<HTMLSelectElement>(selectId);
    if (!select) return;

    select.innerHTML = `
      <option>Select option</option>
      ${options
        .map((opt) => `<option value="${opt.value}">${opt.text}</option>`)
        .join("")}
    `;
  }

  static addTableRow(tableId: string, content: string): void {
    const table = this.getElementById(tableId);
    if (!table) return;

    const row = document.createElement("tr");
    row.classList.add("hover:bg-gray-50", "transition");
    row.innerHTML = content;
    table.appendChild(row);
  }
}

// Chart utilities
class ChartUtils {
  static createScatterChart(
    canvasId: string,
    levelData: LevelData
  ): Chart | null {
    const ctx = DOMUtils.getElementById<HTMLCanvasElement>(canvasId);
    if (!ctx) {
      console.error("Canvas element not found");
      return null;
    }

    const pointDatasets = levelData.points.map((point) => ({
      label: point.name,
      data: [{ x: point.point.x, y: point.point.z }],
      borderColor: "red",
      showLine: false,
      pointRadius: 3,
    }));

    const bodyDataset = {
      label: "Body",
      data: levelData.intersectionPoints.map((p) => ({ x: p.x, y: p.z })),
      borderColor: "blue",
      showLine: true,
      pointRadius: 0,
      borderWidth: 2,
      pointHitRadius: 0,
    };
    function rotatePoints180(dataset: {
      label?: string;
      data: any;
      borderColor?: string;
      showLine?: boolean;
      pointRadius?: number;
      borderWidth?: number;
      pointHitRadius?: number;
    }) {
      return {
        ...dataset,
        data: dataset.data.map(({ x, y }: { x: number; y: number }) => ({
          x: x,
          y: -y,
        })),
      };
    }

    const rotatedPointDatasets = pointDatasets.map(rotatePoints180);
    const rotatedBodyDataset = rotatePoints180(bodyDataset);

    return new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [...rotatedPointDatasets, rotatedBodyDataset],
      },
      options: {
        plugins: {
          legend: {
            position: "bottom",
            display: true,
            labels: {
              boxHeight: 4,
              boxWidth: 4,
              font: {
                size: 12,
              },
            },
          },
        },
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "linear",
            min: -2,
            max: 2,
            ticks: {
              stepSize: 0.5,
              display: false,
            },
          },
          y: {
            min: -2,
            max: 2,
            ticks: {
              display: false,
              stepSize: 0.5,
            },
          },
        },
      },
    });
  }

  static updateChart(levelName: string): void {
    const state = AppState.getInstance();
    const levelData = state.getLevelByName(levelName);

    if (!levelData) return;

    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    state.chartInstance = this.createScatterChart("myChart", levelData);
  }
}

// Event handlers
class EventHandlers {
  private static raycaster = new THREE.Raycaster();
  private static mouse = new THREE.Vector2();

  static setupEventListeners(): void {
    window.addEventListener("dblclick", this.onDoubleClick.bind(this));
    window.addEventListener("click", this.onOneClick.bind(this));
    window.addEventListener("load", this.onWindowLoad.bind(this));

    // Level selector change handler
    const levelSelector = DOMUtils.getElementById<HTMLSelectElement>(
      "levelSelecterForLandmarking"
    );
    if (levelSelector) {
      levelSelector.addEventListener(
        "change",
        this.onLevelSelectorChange.bind(this)
      );
    }
  }

  static onWindowLoad(): void {
    initializeViewport();
    setupLighting();

    // Add axes helper
    // const axesHelper = new THREE.AxesHelper(100);
    // scene.add(axesHelper);

    animate();
  }
  static onOneClick(event: MouseEvent): void {
    const state = AppState.getInstance();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    const intersects = this.raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const selectedObject = intersects[0].object;
      console.log("Clicked on object:", selectedObject);
    } else {
      console.log("No object clicked");
    }
  }
  static onDoubleClick(event: MouseEvent): void {
    const state = AppState.getInstance();

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    if (!state.bodyModel) {
      console.error("Model not found");
      return;
    }

    if (state.selectTool === "none") {
      alert("Select create tool");
      return;
    }

    if (state.selectTool === "Create level") {
      this.handleCreateLevel();
    } else if (state.selectTool === "Add Landmark") {
      this.handleAddLandmark();
    } else if (state.selectTool === "Unit Measurement") {
      this.handleUnitMeasure();
    }
  }

  static handleCreateLevel(): void {
    const state = AppState.getInstance();
    const point = this.getIntersectionPoint(state.bodyModel!);

    if (!point) {
      console.error("Point intersection failed");
      return;
    }

    const markerPoint = createPoint("red");
    markerPoint.position.copy(point);
    scene.add(markerPoint);

    state.clickPoints.push(point);
    state.tempPoints.push(markerPoint);

    if (state.clickPoints.length === 3) {
      state.localIntersectionPlane = createPlaneFromThreePoints(
        state.clickPoints[0],
        state.clickPoints[1],
        state.clickPoints[2]
      );
      scene.add(state.localIntersectionPlane);

      DOMUtils.populateSelect(
        "levelSelecter",
        state.levels.map((level) => ({
          value: level.name,
          text: level.name.toLocaleUpperCase(),
        }))
      );

      DOMUtils.toggleDialog("selectLevelDialog", true);
    }
  }

  static handleUnitMeasure(): void {
    const state = AppState.getInstance();
    const point = this.getIntersectionPoint(state.bodyModel!);
    if (!point) {
      console.error("Point intersection failed");
      return;
    }

    const markerPoint = createPoint("red");
    markerPoint.position.copy(point);
    scene.add(markerPoint);

    state.clickPoints.push(point);
    state.tempPoints.push(markerPoint);
    if (state.clickPoints.length === 2) {
      const distance = state.clickPoints[0].distanceTo(state.clickPoints[1]);
      console.log(distance);
      DOMUtils.toggleDialog("unitMeasurementContainer", true);
      const unitMeasurementInput = document.getElementById(
        "unitMeasurementInput"
      ) as HTMLInputElement;
      unitMeasurementInput.value = (distance * 100).toFixed(2).toString();
      value = distance * 100;
      state.tempPoints.forEach((point) => scene.remove(point));
      state.reset();
    }
  }

  static handleAddLandmark(): void {
    const state = AppState.getInstance();
    this.raycaster.params.Line!.threshold = 0.01;

    const levelData = state.getLevelByName(state.selectedLevel);
    if (!levelData) {
      console.log("Level not found");
      return;
    }

    const point = this.getIntersectionPoint(levelData.line);
    if (!point) {
      console.error("Point intersection failed");
      return;
    }

    state.clickPoints.push(point);

    DOMUtils.populateSelect(
      "landmarkSelect",
      state.landmarks.map((landmark) => ({
        value: landmark.name,
        text: landmark.name,
      }))
    );

    DOMUtils.toggleDialog("selectLandmarkDialog", true);
  }

  static getIntersectionPoint(object: THREE.Object3D): THREE.Vector3 | null {
    const intersects = this.raycaster.intersectObject(object, true);
    return intersects.length ? intersects[0].point.clone() : null;
  }

  static onLevelSelectorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const state = AppState.getInstance();

    if (target.value === "Select option") return; // Updated validation

    state.selectedLevel = target.value;
    ChartUtils.updateChart(target.value);
  }
}

// Global functions (keeping for backward compatibility)
(window as any).bodyUpload = (event: Event) => {
  const state = AppState.getInstance();
  loadModel(event, scene, "body", (model: THREE.Object3D, fileName: string) => {
    state.bodyModel = model;
    state.fileName = fileName;
    if (state.masterJson.body) {
      state.masterJson.body.bodyName = fileName;
    }
    state.masterJson.fileName = fileName;
  });
};

(window as any).createLevelBtn = () => {
  AppState.getInstance().selectTool = "Create level";
};

(window as any).addLandMark = () => {
  AppState.getInstance().selectTool = "Add Landmark";
};
(window as any).unitMeasurement = () => {
  AppState.getInstance().selectTool = "Unit Measurement";
};

// levelSelectSubmit function
(window as any).levelSelectSubmit = () => {
  const state = AppState.getInstance();
  const levelSelecter =
    DOMUtils.getElementById<HTMLSelectElement>("levelSelecter");

  if (
    !levelSelecter?.value ||
    levelSelecter.value === "Select option" || // Add this validation
    !state.bodyModel ||
    !state.localIntersectionPlane
  ) {
    console.error(
      "Missing required data for level creation or invalid selection"
    );
    if (levelSelecter?.value === "Select option") {
      alert("Please select a valid level option");
    }
    return;
  }

  const levelName = levelSelecter.value;

  // Check if level already exists in created levels
  if (state.createdLevels.find((l) => l.name === levelName)) {
    alert(`Level "${levelName}" already exists!`);
    DOMUtils.toggleDialog("selectLevelDialog", false);
    // Clean up temporary objects
    scene.remove(state.localIntersectionPlane);
    state.tempPoints.forEach((point) => scene.remove(point));
    state.reset();
    return;
  }

  // Check if level already exists in local level data
  if (state.getLevelByName(levelName)) {
    alert(`Level "${levelName}" already exists!`);
    DOMUtils.toggleDialog("selectLevelDialog", false);
    // Clean up temporary objects
    scene.remove(state.localIntersectionPlane);
    state.tempPoints.forEach((point) => scene.remove(point));
    state.reset();
    return;
  }

  const intersectionPoints = getModelPlaneIntersections(
    state.bodyModel,
    getPlaneFromMesh(state.localIntersectionPlane)
  );

  const level = state.levels.find((l) => l.name === levelName);
  const color = level?.color || "red";

  // Create line geometry
  const sortedPoints = sortPointsNearestNeighbor(intersectionPoints);
  const geometry = new THREE.BufferGeometry().setFromPoints(sortedPoints);
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  // Clean up temporary objects
  scene.remove(state.localIntersectionPlane);
  state.tempPoints.forEach((point) => scene.remove(point));

  // Create level data
  const levelData: LevelData = {
    name: levelName,
    intersectionPoints: sortedPoints,
    planeMesh: state.localIntersectionPlane,
    line: line,
    points: [],
  };

  state.addLevel(levelData);
  state.createdLevels.push({ name: levelName, color });

  // Update UI
  DOMUtils.addTableRow(
    "levelTable",
    `
    <td class="py-2 px-4 text-sm">${levelName.toUpperCase()}</td>
    <td class="py-2 px-4">
      <div style="background-color: ${
        colors[color as ColorName].hex
      }; border-color: ${colors[color as ColorName].hex};"
           class="size-4 rounded border-2 shadow-sm"></div>
    </td>
  `
  );

  // Add to level selectors
  const option = document.createElement("option");
  option.value = levelName;
  option.text = levelName.toUpperCase();

  const landmarkingSelector = DOMUtils.getElementById(
    "levelSelecterForLandmarking"
  );
  if (landmarkingSelector) {
    landmarkingSelector.appendChild(option.cloneNode(true));
  }

  DOMUtils.toggleDialog("selectLevelDialog", false);
  state.reset();
};

// landmarkSelectSubmit function
(window as any).landmarkSelectSubmit = () => {
  const state = AppState.getInstance();
  const landmarkSelect =
    DOMUtils.getElementById<HTMLSelectElement>("landmarkSelect");

  if (
    !landmarkSelect?.value ||
    landmarkSelect.value === "Select option" ||
    state.clickPoints.length === 0
  ) {
    console.error("Missing landmark selection or click point");
    if (landmarkSelect?.value === "Select option") {
      alert("Please select a valid landmark option");
    }
    return;
  }

  const landmarkName = landmarkSelect.value;
  const levelData = state.getLevelByName(state.selectedLevel);
  const landmarkData = state.masterJson.landmarks;

  if (!levelData) {
    console.error("Level data not found");
    return;
  }

  // Check if landmark already exists in this level
  if (levelData.points.find((p) => p.name === landmarkName)) {
    alert(`Landmark "${landmarkName}" already exists in this level!`);
    DOMUtils.toggleDialog("selectLandmarkDialog", false);
    state.reset();
    return;
  }

  const landmarkColor =
    landMarks.find((l) => l.name === landmarkName.toUpperCase())?.colour ||
    "red";

  // Create marker
  const marker = createPoint(landmarkColor as ColorName);
  marker.position.copy(state.clickPoints[0]);
  scene.add(marker);

  // Create the landmark point object
  const landmarkPoint = {
    name: landmarkName,
    color: landmarkColor,
    point: state.clickPoints[0],
  };

  // Add to level data only (this automatically updates masterJson since they share the same reference)
  levelData.points.push(landmarkPoint);

  if (!landmarkData?.includes(landmarkName)) {
    landmarkData?.push(landmarkName);
  }
  state.landMarkPoints.push({
    landmark: landmarkName,
    level: levelData.name,
    point: marker,
  });
  // REMOVED: The duplicate addition to masterLevel.points
  // The masterJson.levels array contains references to the same objects as localLevelData
  // So adding to levelData.points automatically updates the masterJson

  DOMUtils.toggleDialog("selectLandmarkDialog", false);
  ChartUtils.updateChart(state.selectedLevel);
  state.reset();
};

(window as any).createCustomLevelSave = () => {
  const state = AppState.getInstance();
  const input = DOMUtils.getElementById<HTMLInputElement>("customLevelInput");
  const errorElement = DOMUtils.getElementById("customLevelDialogError");

  if (!input?.value) return;

  if (state.levels.find((l) => l.name === input.value)) {
    if (errorElement) {
      errorElement.textContent = "Level already exists";
    }
    return;
  }

  const newLevel = { name: input.value, color: "red" };
  state.levels.push(newLevel);

  DOMUtils.toggleDialog("customLevelDialog", false);
  input.value = "";
};

(window as any).createCustomLandmarkSave = () => {
  const state = AppState.getInstance();
  const input = DOMUtils.getElementById<HTMLInputElement>(
    "customLandmarkInput"
  );
  const errorElement = DOMUtils.getElementById("customLandmarkDialogError");

  if (!input?.value) return;

  if (state.landmarks.find((l) => l.name === input.value)) {
    if (errorElement) {
      errorElement.textContent = "Landmark already exists";
    }
    return;
  }

  state.landmarks.push({ name: input.value });
  DOMUtils.toggleDialog("customLandmarkDialog", false);
  input.value = "";
};
(window as any).unitMeasurementSave = () => {
  const state = AppState.getInstance();
  const input = DOMUtils.getElementById<HTMLInputElement>(
    "unitMeasurementInput"
  );

  if (!input?.value) return;
  const unit = Number(input?.value) / value;
  state.masterJson.unit = Number(unit);
  DOMUtils.toggleDialog("unitMeasurementContainer", false);
  input.value = "";
};
(window as any).undo = () => {
  const state = AppState.getInstance();

  if (state.landMarkPoints.length === 0) {
    return;
  }

  const undoItem = state.landMarkPoints[state.landMarkPoints.length - 1];
  console.log(undoItem);

  const levelData = state.getLevelByName(undoItem.level);

  if (levelData) {
    const index = levelData.points.findIndex(
      (i) => i.name === undoItem.landmark
    );
    if (index !== -1) {
      levelData.points.splice(index, 1);
    }
  }

  scene.remove(undoItem.point);

  state.landMarkPoints.pop();

  ChartUtils.updateChart(state.selectedLevel);
};
(window as any).resetCam = () => {
  camera.position.set(0, 0, 10);
};

(window as any).saveBodyJson = () => {
  const state = AppState.getInstance();

  if (!state.masterJson.fileName) {
    console.error("No filename available for saving");
    return;
  }

  const json = JSON.stringify(state.masterJson, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${getCurrentDateYYYYMMDD()}-Body-Landmarks-${
    state.masterJson.body?.bodyName
  }.json`;
  link.click();

  URL.revokeObjectURL(url);
};

// Initialize the application
EventHandlers.setupEventListeners();
