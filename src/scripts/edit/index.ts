import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

// Type definitions for the JSON data based on the provided MasterJson interface
interface Point {
  x: number;
  y: number;
  z: number;
}

interface Level {
  name: string;
  bodyIntersectionPoints?: Point[];
  dressIntersectionPoints?: Point[];
  landmarkPoints?: Point[];
}

interface PointCloudData {
  fileName?: string;
  levels: Level[];
}

interface FilteredPointData {
  type: "body" | "dress" | "landmark";
  point: Point;
  level: string;
}

interface SelectedPointInfo {
  geometryIndex: number;
  pointsMesh: THREE.Points;
  originalDataRef: FilteredPointData;
}

// Replace PointCloudData and Level interfaces with a generic one for visualization
interface VisualizedLevel {
  name: string;
  source: string; // 'body', 'garment', or 'trail:trailName'
  intersectionPoints?: THREE.Vector3[];
  landmarks?: { name: string; point: THREE.Vector3; color?: string }[];
}

interface VisualizedData {
  fileName?: string;
  levels: VisualizedLevel[];
}

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let originalData: VisualizedData | null = null;
let filteredPoints: FilteredPointData[] = [];
let pointsGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let measuring = false;
let firstMeasurementPoint: THREE.Vector3 | null = null;
let measurementLine: THREE.Line | null = null;
let selectedPoints: SelectedPointInfo[] = [];
let selecting = false;
let selectionRectMesh: THREE.LineLoop | null = null;
let startSelectPoint = new THREE.Vector2();
let currentMousePoint = new THREE.Vector2();
let addingPoint = false;

// DOM elements
const infoBox = document.getElementById("info-box") as HTMLDivElement;
const levelFilter = document.getElementById("levelFilter") as HTMLSelectElement;
const toggleBodyPoints = document.getElementById(
  "toggleBodyPoints"
) as HTMLInputElement;
const toggleDressPoints = document.getElementById(
  "toggleDressPoints"
) as HTMLInputElement;
const toggleLandmarkPoints = document.getElementById(
  "toggleLandmarkPoints"
) as HTMLInputElement;
const measureDistanceBtn = document.getElementById(
  "measureDistance"
) as HTMLButtonElement;
const selectPointsBtn = document.getElementById(
  "selectPoints"
) as HTMLButtonElement;
const deleteSelectedBtn = document.getElementById(
  "deleteSelected"
) as HTMLButtonElement;
const addDressPointBtn = document.getElementById(
  "addDressPoint"
) as HTMLButtonElement;
const saveJsonBtn = document.getElementById("saveJson") as HTMLButtonElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const loadingOverlay = document.getElementById(
  "loading-overlay"
) as HTMLDivElement;
const messageModal = document.getElementById("messageModal") as HTMLDivElement;
const modalMessage = document.getElementById(
  "modalMessage"
) as HTMLParagraphElement;
const topViewBtn = document.getElementById("topView") as HTMLButtonElement;
const canvasContainer = document.getElementById(
  "canvas-container"
) as HTMLDivElement;

// Function to show a modal message
function showMessage(message: string): void {
  modalMessage.textContent = message;
  messageModal.classList.remove("hidden");
  messageModal.style.display = "flex";
}

// Initialize Three.js scene, camera, and renderer
function init(): void {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a202c);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  canvasContainer.appendChild(renderer.domElement);

  // OrbitControls for camera interaction (rotate, zoom, pan)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 1);
  scene.add(directionalLight);

  // Add XYZ axes helper
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Raycaster for point interaction
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Group to hold all points
  pointsGroup = new THREE.Group();
  scene.add(pointsGroup);

  // Event Listeners
  window.addEventListener("resize", onWindowResize, false);
  renderer.domElement.addEventListener("pointerdown", onPointerDown, false);
  renderer.domElement.addEventListener("pointermove", onPointerMove, false);
  renderer.domElement.addEventListener("pointerup", onPointerUp, false);

  fileInput.addEventListener("change", handleFileUpload);
  levelFilter.addEventListener("change", renderPoints);
  toggleBodyPoints.addEventListener("change", renderPoints);
  toggleDressPoints.addEventListener("change", renderPoints);
  toggleLandmarkPoints.addEventListener("change", renderPoints);
  measureDistanceBtn.addEventListener("click", toggleMeasureDistance);
  selectPointsBtn.addEventListener("click", toggleSelectPoints);
  deleteSelectedBtn.addEventListener("click", deleteSelectedPoints);
  addDressPointBtn.addEventListener("click", toggleAddPoint);
  saveJsonBtn.addEventListener("click", saveModifiedJson);
  topViewBtn.addEventListener("click", setTopView);

  animate();
}

// Handle window resize
function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Replace loadJsonData to accept MasterJson and flatten all levels
function loadJsonData(data: any): void {
  // Try to detect if it's MasterJson
  let visualized: VisualizedData = {
    fileName: data.fileName ?? undefined,
    levels: [],
  };

  // Handle body.levels
  if (data.body && Array.isArray(data.body.levels)) {
    for (const lvl of data.body.levels) {
      if (!lvl) continue;
      visualized.levels.push({
        name: lvl.name ?? "Unnamed",
        source: "body",
        intersectionPoints: (lvl.intersectionPoints ?? []).filter(Boolean),
        landmarks: (lvl.landmarks ?? []).filter(Boolean).map((lm: any) => ({
          name: lm.name ?? "",
          point: lm.point,
          color: lm.color ?? undefined,
        })),
      });
    }
  }
  // Handle garment.levels
  if (data.garment && Array.isArray(data.garment.levels)) {
    for (const lvl of data.garment.levels) {
      if (!lvl) continue;
      visualized.levels.push({
        name: lvl.name ?? "Unnamed",
        source: "garment",
        intersectionPoints: (lvl.intersectionPoints ?? []).filter(Boolean),
        landmarks: (lvl.landmarks ?? []).filter(Boolean).map((lm: any) => ({
          name: lm.name ?? "",
          point: lm.point,
          color: lm.color ?? undefined,
        })),
      });
    }
  }
  // Handle trails (n number)
  if (Array.isArray(data.trails)) {
    for (const trail of data.trails) {
      if (!trail || !Array.isArray(trail.levels)) continue;
      for (const lvl of trail.levels) {
        if (!lvl) continue;
        visualized.levels.push({
          name: lvl.name ?? "Unnamed",
          source: `trail:${trail.trailName ?? "unnamed"}`,
          intersectionPoints: (lvl.intersectionPoints ?? []).filter(Boolean),
          landmarks: (lvl.landmarks ?? []).filter(Boolean).map((lm: any) => ({
            name: lm.name ?? "",
            point: lm.point,
            color: lm.color ?? undefined,
          })),
        });
      }
    }
  }
  originalData = visualized;
  populateLevelFilter();
  renderPoints();
}

// Populate the level filter dropdown
function populateLevelFilter(): void {
  levelFilter.innerHTML = '<option value="all">All Levels</option>';
  if (originalData && originalData.levels) {
    originalData.levels.forEach((level) => {
      const option = document.createElement("option");
      option.value = `${level.source}::${level.name}`;
      option.textContent = `${level.name} [${level.source}]`;
      levelFilter.appendChild(option);
    });
  }
}

// Render points based on filters
function renderPoints(): void {
  pointsGroup.clear();
  selectedPoints = [];
  clearMeasurementLine();
  if (!originalData) return;
  const selectedLevel = levelFilter.value;
  filteredPoints = [];
  originalData.levels.forEach((level) => {
    if (
      selectedLevel === "all" ||
      `${level.source}::${level.name}` === selectedLevel
    ) {
      // Show intersectionPoints as 'body' type
      if (level.intersectionPoints) {
        level.intersectionPoints.forEach((point) => {
          filteredPoints.push({
            type: "body",
            point: point,
            level: `${level.name} [${level.source}]`,
          });
        });
      }
      // Show landmarks as 'landmark' type
      if (level.landmarks) {
        level.landmarks.forEach((lm) => {
          if (lm && lm.point) {
            filteredPoints.push({
              type: "landmark",
              point: lm.point,
              level: `${level.name} [${level.source}]`,
            });
          }
        });
      }
    }
  });

  const pointGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const colorBody = new THREE.Color(0xff0000);
  const colorDress = new THREE.Color(0x00ff00);
  const colorLandmark = new THREE.Color(0x0000ff);

  filteredPoints.forEach((data) => {
    positions.push(data.point.x, data.point.y, data.point.z);
    if (data.type === "body") {
      colors.push(colorBody.r, colorBody.g, colorBody.b);
    } else if (data.type === "dress") {
      colors.push(colorDress.r, colorDress.g, colorDress.b);
    } else if (data.type === "landmark") {
      colors.push(colorLandmark.r, colorLandmark.g, colorLandmark.b);
    }
  });

  pointGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  pointGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.05,
    vertexColors: true,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(pointGeometry, pointMaterial);
  points.userData.originalFilteredPoints = filteredPoints;
  pointsGroup.add(points);

  updateCameraLockState();
}

// Handle file upload
async function handleFileUpload(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    loadingOverlay.classList.remove("hidden");
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          loadJsonData(data);
          showMessage("JSON file loaded successfully!");
        } catch (parseError: any) {
          showMessage("Error parsing JSON file: " + parseError.message);
          console.error("Error parsing JSON:", parseError);
        } finally {
          loadingOverlay.classList.add("hidden");
        }
      };
      reader.readAsText(file);
    } catch (error: any) {
      showMessage("Error reading file: " + error.message);
      console.error("Error reading file:", error);
      loadingOverlay.classList.add("hidden");
    }
  }
}

// Measure Distance Functionality
function toggleMeasureDistance(): void {
  measuring = !measuring;
  if (measuring) {
    measureDistanceBtn.textContent = "Measuring... Click 2 points";
    measureDistanceBtn.classList.add("bg-blue-600");
    showMessage(
      "Measure Distance Mode: Click two points to measure the distance."
    );
    controls.enabled = false;
  } else {
    measureDistanceBtn.textContent = "Measure Distance";
    measureDistanceBtn.classList.remove("bg-blue-600");
    clearMeasurementLine();
    firstMeasurementPoint = null;
    infoBox.textContent = "Distance: N/A";
  }
  selecting = false;
  selectPointsBtn.textContent = "Select Points (Rect)";
  selectPointsBtn.classList.remove("bg-blue-600");
  addingPoint = false;
  addDressPointBtn.textContent = "Add Dress Point";
  addDressPointBtn.classList.remove("bg-blue-600");
  renderPoints();
}

function clearMeasurementLine(): void {
  if (measurementLine) {
    scene.remove(measurementLine);
    measurementLine.geometry.dispose();
    (measurementLine.material as THREE.Material).dispose();
    measurementLine = null;
  }
}

// Selection Functionality
function toggleSelectPoints(): void {
  selecting = !selecting;
  if (selecting) {
    selectPointsBtn.textContent = "Selecting... Drag to select";
    selectPointsBtn.classList.add("bg-blue-600");
    showMessage(
      "Select Points Mode: Click and drag to draw a rectangle and select points."
    );
    controls.enabled = false;
  } else {
    selectPointsBtn.textContent = "Select Points (Rect)";
    selectPointsBtn.classList.remove("bg-blue-600");
    clearSelectionRectangle();
    renderPoints();
  }
  measuring = false;
  measureDistanceBtn.textContent = "Measure Distance";
  measureDistanceBtn.classList.remove("bg-blue-600");
  clearMeasurementLine();
  firstMeasurementPoint = null;
  infoBox.textContent = "Distance: N/A";
  addingPoint = false;
  addDressPointBtn.textContent = "Add Dress Point";
  addDressPointBtn.classList.remove("bg-blue-600");
}

function clearSelectionRectangle(): void {
  if (selectionRectMesh) {
    scene.remove(selectionRectMesh);
    selectionRectMesh.geometry.dispose();
    (selectionRectMesh.material as THREE.Material).dispose();
    selectionRectMesh = null;
  }
}

// Add Dress Point Functionality
function toggleAddPoint(): void {
  addingPoint = !addingPoint;
  if (addingPoint) {
    addDressPointBtn.textContent = "Adding Dress Point... Click on surface";
    addDressPointBtn.classList.add("bg-blue-600");
    showMessage(
      "Add Dress Point Mode: Click on the 3D surface to add a new dress point to the selected level."
    );
    controls.enabled = false;
  } else {
    addDressPointBtn.textContent = "Add Dress Point";
    addDressPointBtn.classList.remove("bg-blue-600");
    renderPoints();
  }
  measuring = false;
  measureDistanceBtn.textContent = "Measure Distance";
  measureDistanceBtn.classList.remove("bg-blue-600");
  clearMeasurementLine();
  firstMeasurementPoint = null;
  infoBox.textContent = "Distance: N/A";
  selecting = false;
  selectPointsBtn.textContent = "Select Points (Rect)";
  selectPointsBtn.classList.remove("bg-blue-600");
  clearSelectionRectangle();
}

function onPointerDown(event: PointerEvent): void {
  event.preventDefault();
  if (event.button !== 0) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (selecting) {
    controls.enabled = false;
    startSelectPoint.set(event.clientX, event.clientY);
    clearSelectionRectangle();
    selectionRectMesh = createSelectionRectangle(
      startSelectPoint,
      startSelectPoint
    );
    scene.add(selectionRectMesh);
  }
}

function onPointerMove(event: PointerEvent): void {
  event.preventDefault();
  if (selecting && selectionRectMesh) {
    currentMousePoint.set(event.clientX, event.clientY);
    updateSelectionRectangle(startSelectPoint, currentMousePoint);
  }
}

function onPointerUp(event: PointerEvent): void {
  event.preventDefault();
  if (event.button !== 0) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (measuring) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pointsGroup.children);

    if (intersects.length > 0) {
      const clickedPoint = intersects[0].point;
      if (!firstMeasurementPoint) {
        firstMeasurementPoint = clickedPoint;
        showMessage("First point selected. Click the second point.");
      } else {
        const distance = firstMeasurementPoint.distanceTo(clickedPoint);
        infoBox.textContent = `Distance: ${distance.toFixed(3)}`;
        clearMeasurementLine();
        const geometry = new THREE.BufferGeometry().setFromPoints([
          firstMeasurementPoint,
          clickedPoint,
        ]);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
        measurementLine = new THREE.Line(geometry, material);
        scene.add(measurementLine);
        firstMeasurementPoint = null;
      }
    }
  } else if (selecting) {
    if (selectionRectMesh) {
      selectPointsInRectangle();
      clearSelectionRectangle();
    }
    controls.enabled = true;
  } else if (addingPoint) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pointsGroup.children);
    if (intersects.length > 0) {
      const newPointPos = intersects[0].point;
      addPointToData(newPointPos);
    } else {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersectionPoint);
      if (intersectionPoint) {
        addPointToData(intersectionPoint);
      } else {
        showMessage(
          "Could not determine a valid position to add a point. Try clicking on existing geometry."
        );
      }
    }
  }
}

// Create the selection rectangle mesh
function createSelectionRectangle(
  start: THREE.Vector2,
  end: THREE.Vector2
): THREE.LineLoop {
  const material = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.5,
  });
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(5 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 5);
  const mesh = new THREE.LineLoop(geometry, material);
  mesh.renderOrder = 999;
  mesh.material.depthTest = false;
  return mesh;
}

// Update the selection rectangle mesh based on mouse movement
function updateSelectionRectangle(
  start: THREE.Vector2,
  current: THREE.Vector2
): void {
  if (!selectionRectMesh) return;
  const positions = selectionRectMesh.geometry.attributes.position
    .array as Float32Array;
  const minX = Math.min(start.x, current.x);
  const maxX = Math.max(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const maxY = Math.max(start.y, current.y);

  const ndcStart = new THREE.Vector2(
    (minX / window.innerWidth) * 2 - 1,
    -(maxY / window.innerHeight) * 2 + 1
  );
  const ndcEnd = new THREE.Vector2(
    (maxX / window.innerWidth) * 2 - 1,
    -(minY / window.innerHeight) * 2 + 1
  );

  const p1 = new THREE.Vector3(ndcStart.x, ndcStart.y, 0.5).unproject(camera);
  const p2 = new THREE.Vector3(ndcEnd.x, ndcStart.y, 0.5).unproject(camera);
  const p3 = new THREE.Vector3(ndcEnd.x, ndcEnd.y, 0.5).unproject(camera);
  const p4 = new THREE.Vector3(ndcStart.x, ndcEnd.y, 0.5).unproject(camera);

  positions[0] = p1.x;
  positions[1] = p1.y;
  positions[2] = p1.z;
  positions[3] = p2.x;
  positions[4] = p2.y;
  positions[5] = p2.z;
  positions[6] = p3.x;
  positions[7] = p3.y;
  positions[8] = p3.z;
  positions[9] = p4.x;
  positions[10] = p4.y;
  positions[11] = p4.z;
  positions[12] = p1.x;
  positions[13] = p1.y;
  positions[14] = p1.z;

  selectionRectMesh.geometry.attributes.position.needsUpdate = true;
}

// Select points within the drawn rectangle
function selectPointsInRectangle(): void {
  if (!originalData) return;

  const rectLeft = Math.min(startSelectPoint.x, currentMousePoint.x);
  const rectRight = Math.max(startSelectPoint.x, currentMousePoint.x);
  const rectTop = Math.min(startSelectPoint.y, currentMousePoint.y);
  const rectBottom = Math.max(startSelectPoint.y, currentMousePoint.y);

  selectedPoints = [];

  const currentSelectedLevel = levelFilter.value;

  pointsGroup.children.forEach((pointsMesh) => {
    if ((pointsMesh as THREE.Points).isPoints) {
      const points = pointsMesh as THREE.Points;
      const positions = points.geometry.attributes.position
        .array as Float32Array;
      const colors = points.geometry.attributes.color.array as Float32Array;
      const originalFiltered = points.userData
        .originalFilteredPoints as FilteredPointData[];

      for (let i = 0; i < positions.length / 3; i++) {
        const originalDataItem = originalFiltered[i];
        if (!originalDataItem) {
          console.error(`Error: originalFiltered[${i}] is undefined.`);
          continue;
        }

        if (
          currentSelectedLevel !== "all" &&
          originalDataItem.level !== currentSelectedLevel
        ) {
          continue;
        }

        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        const point3D = new THREE.Vector3(x, y, z);
        point3D.project(camera);

        const screenX = ((point3D.x + 1) / 2) * renderer.domElement.clientWidth;
        const screenY =
          ((-point3D.y + 1) / 2) * renderer.domElement.clientHeight;

        if (
          screenX >= rectLeft &&
          screenX <= rectRight &&
          screenY >= rectTop &&
          screenY <= rectBottom
        ) {
          selectedPoints.push({
            geometryIndex: i,
            pointsMesh: points,
            originalDataRef: originalDataItem,
          });
          colors[i * 3] = 1;
          colors[i * 3 + 1] = 1;
          colors[i * 3 + 2] = 0;
        }
      }
      points.geometry.attributes.color.needsUpdate = true;
    }
  });
  showMessage(`${selectedPoints.length} points selected.`);
}

// Delete selected points
function deleteSelectedPoints(): void {
  if (selectedPoints.length === 0) {
    showMessage("No points selected to delete.");
    return;
  }

  const currentSelectedLevel = levelFilter.value;
  const pointsToDeleteMap = new Map<string, Set<Point>>();

  selectedPoints.forEach((selected) => {
    const originalRef = selected.originalDataRef;
    if (
      currentSelectedLevel === "all" ||
      originalRef.level === currentSelectedLevel
    ) {
      const key = `${originalRef.level}-${originalRef.type}`;
      if (!pointsToDeleteMap.has(key)) {
        pointsToDeleteMap.set(key, new Set());
      }
      pointsToDeleteMap.get(key)!.add(originalRef.point);
    }
  });

  if (originalData && originalData.levels) {
    originalData.levels.forEach((level) => {
      if (
        currentSelectedLevel === "all" ||
        level.name === currentSelectedLevel
      ) {
        const pointTypeKeys = [
          "bodyIntersectionPoints",
          "dressIntersectionPoints",
          "landmarkPoints",
        ] as const;
        pointTypeKeys.forEach((pointTypeKey) => {
          const typeName = pointTypeKey
            .replace("IntersectionPoints", "")
            .replace("Points", "") as "body" | "dress" | "landmark";
          const key = `${level.name}-${typeName}`;
          if (pointsToDeleteMap.has(key) && level[pointTypeKey]) {
            const pointsToRemove = pointsToDeleteMap.get(key)!;
            level[pointTypeKey] = level[pointTypeKey]!.filter(
              (point: Point) => !pointsToRemove.has(point)
            );
          }
        });
      }
    });
  }

  showMessage(`${selectedPoints.length} points deleted.`);
  renderPoints();
}

// Add a new point to the data
function addPointToData(position: THREE.Vector3): void {
  if (!originalData) {
    showMessage("No JSON data loaded. Please upload a file first.");
    return;
  }

  const targetLevelName = levelFilter.value;
  let targetLevel: VisualizedLevel | undefined = undefined;
  let finalY = position.y;

  if (targetLevelName !== "all") {
    targetLevel = originalData.levels.find(
      (level) => `${level.source}::${level.name}` === targetLevelName
    );
    if (targetLevel) {
      let yCoordinates: number[] = [];
      if (targetLevel.intersectionPoints)
        yCoordinates.push(
          ...targetLevel.intersectionPoints.map((p: THREE.Vector3) => p.y)
        );
      if (targetLevel.landmarks)
        yCoordinates.push(...targetLevel.landmarks.map((lm) => lm.point.y));

      if (yCoordinates.length > 0) {
        let minDistanceY = Infinity;
        for (const yCoord of yCoordinates) {
          const distanceY = Math.abs(position.y - yCoord);
          if (distanceY < minDistanceY) {
            minDistanceY = distanceY;
            finalY = yCoord;
          }
        }
        showMessage(
          `Adding point to level "${
            targetLevel.name
          }" at nearest Y: ${finalY.toFixed(2)}.`
        );
      } else {
        showMessage(
          `Level "${targetLevel.name}" has no existing points. Adding at raycaster Y.`
        );
      }
    } else {
      showMessage(
        `Selected level "${targetLevelName}" not found in data. Adding at raycaster Y.`
      );
    }
  } else {
    if (originalData.levels && originalData.levels.length > 0) {
      targetLevel = originalData.levels[0];
      showMessage(
        `"All Levels" selected. Adding point to first level (${targetLevel.name})'s intersection points at raycaster Y.`
      );
    } else {
      showMessage("No levels found in the loaded JSON data to add a point to.");
      return;
    }
  }
  if (!targetLevel) return;
  if (!targetLevel.intersectionPoints) {
    targetLevel.intersectionPoints = [];
  }
  targetLevel.intersectionPoints.push(
    new THREE.Vector3(position.x, finalY, position.z)
  );
  renderPoints();
  showMessage(
    `Point added to level "${targetLevel.name}" at X:${position.x.toFixed(
      2
    )}, Y:${finalY.toFixed(2)}, Z:${position.z.toFixed(2)}`
  );
}

// Save the modified JSON
function saveModifiedJson(): void {
  if (!originalData) {
    showMessage("No data to save. Please upload a JSON file first.");
    return;
  }

  const modifiedData = JSON.parse(
    JSON.stringify(originalData)
  ) as VisualizedData;
  const originalFileName = modifiedData.fileName || "measurement_data";
  modifiedData.fileName = `${originalFileName}_modified`;

  const dataStr = JSON.stringify(modifiedData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${modifiedData.fileName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showMessage("Modified JSON saved successfully!");
}

// Function to set the camera to a top-down view
function setTopView(): void {
  if (pointsGroup.children.length === 0) {
    console.warn("No points loaded to set top view to.");
    return;
  }

  const boundingBox = new THREE.Box3().setFromObject(pointsGroup);
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
  cameraDistance *= 1.5;

  camera.position.set(center.x, center.y + cameraDistance, center.z);
  camera.lookAt(center);

  controls.target.copy(center);
  controls.update();
  showMessage("Camera set to Top View.");
}

// New function to update camera lock state based on level selection
function updateCameraLockState(): void {
  const currentSelectedLevel = levelFilter.value;
  if (currentSelectedLevel !== "all") {
    setTopView();
    controls.enabled = false;
    showMessage(
      `Camera locked to Top View for level "${currentSelectedLevel}".`
    );
  } else {
    controls.enabled = true;
    showMessage("Camera controls enabled.");
  }
}

window.onload = init;
