import * as THREE from "three";

import {
  type JSONData,
  type FilteredPoint,
  type SelectedPoint,
  InteractionMode,
  type Point3D,
} from "./types";
import { Editor2D } from "./Editor2D";
import { OrbitControls } from "three/examples/jsm/Addons.js";

interface FilterOptions {
  level: string;
  trial: string;
  showBody: boolean;
  showGarment: boolean;
  showLandmark: boolean;
  showGarmentLandmark: boolean;
}

export class JSONViewer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private pointsGroup: THREE.Group;
  private originalData: JSONData | null = null;
  private filteredPoints: FilteredPoint[] = [];
  private selectedPoints: SelectedPoint[] = [];

  // Color mapping for consistent trial colors
  private trialColorMap: Map<string, THREE.Color> = new Map();
  private garmentColors: THREE.Color[] = [
    new THREE.Color(0x00ff00), // Green
    new THREE.Color(0xffff00), // Yellow
    new THREE.Color(0xff00ff), // Magenta
    new THREE.Color(0x00ffff), // Cyan
    new THREE.Color(0xff8800), // Orange
    new THREE.Color(0x8800ff), // Purple
    new THREE.Color(0x008800), // Dark Green
    new THREE.Color(0x880000), // Dark Red
    new THREE.Color(0xff0088), // Pink
    new THREE.Color(0x0088ff), // Light Blue
    new THREE.Color(0x88ff00), // Lime
    new THREE.Color(0xff8800), // Orange
  ];

  private interactionMode: InteractionMode = InteractionMode.NONE;
  private firstMeasurementPoint: THREE.Vector3 | null = null;
  private measurementLine: THREE.Line | null = null;
  private selectionRectMesh: THREE.LineLoop | null = null;
  private startSelectPoint: THREE.Vector2;
  private currentMousePoint: THREE.Vector2;

  // 2D Editor integration
  private editor2D: Editor2D | null = null;
  private is2DEditingMode: boolean = false;
  private currentEditingLevel: string = "";
  private currentEditingTrial: string = "";
  private show3DLandmarkLabels: boolean = true; // Control 3D landmark label visibility

  // Enhanced point highlighting and measurement system
  private selectedPointHighlights: Map<string, THREE.Mesh> = new Map();

  // Measurement system
  private measurementPoints: THREE.Vector3[] = [];
  private measurementMode: boolean = false;
  private measurementLines: THREE.Line[] = [];
  private measurementLabels: THREE.Sprite[] = [];
  private measurementPointMarkers: THREE.Mesh[] = [];
  private measurementPointHighlights: Map<string, THREE.Mesh> = new Map(); // Track highlights for actual points being measured

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.pointsGroup = new THREE.Group();
    this.startSelectPoint = new THREE.Vector2();
    this.currentMousePoint = new THREE.Vector2();

    this.initializeScene();
    this.initializeEventListeners();
    this.initialize2DEditor();
    this.animate();
  }

  private initializeScene(): void {
    // Scene setup
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera setup - Isometric view (equal distance from all axes)
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document
      .getElementById("canvas-container")
      ?.appendChild(this.renderer.domElement);

    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 1.0;
    this.controls.rotateSpeed = 1.0;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 50;

    // Add event listeners for debugging
    this.controls.addEventListener("change", () => {
      console.log("OrbitControls changed:", {
        cameraPosition: this.camera.position,
        cameraDistance: this.camera.position.distanceTo(this.controls.target),
        controlsTarget: this.controls.target,
        minDistance: this.controls.minDistance,
        maxDistance: this.controls.maxDistance,
      });
    });

    // Add wheel event debugging
    this.renderer.domElement.addEventListener("wheel", (event) => {
      console.log("Wheel event detected:", {
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
    });

    // Add keyboard event debugging
    document.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=" || event.key === "-") {
        console.log("Keyboard zoom key pressed:", {
          key: event.key,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        });
      }

      // Add arrow key panning
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.panLeft();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.panRight();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.panUp();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.panDown();
      }
    });

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(directionalLight);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);

    // Points group
    this.scene.add(this.pointsGroup);
  }

  private initializeEventListeners(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("pointerdown", this.onPointerDown.bind(this));
    canvas.addEventListener("pointermove", this.onPointerMove.bind(this));
    canvas.addEventListener("pointerup", this.onPointerUp.bind(this));
  }

  private onPointerDown(event: PointerEvent): void {
    // Only prevent default and handle events if we're in an interaction mode
    if (this.interactionMode !== InteractionMode.NONE) {
      event.preventDefault();
      if (event.button !== 0) return;

      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      if (this.interactionMode === InteractionMode.SELECT) {
        this.controls.enabled = false;
        this.startSelectPoint.set(event.clientX, event.clientY);
        this.clearSelectionRectangle();
        this.selectionRectMesh = this.createSelectionRectangle();
        this.scene.add(this.selectionRectMesh);
      }
    }
    // If not in interaction mode, let OrbitControls handle the event
  }

  private onPointerMove(event: PointerEvent): void {
    // Only handle events if we're in SELECT mode
    if (
      this.interactionMode === InteractionMode.SELECT &&
      this.selectionRectMesh
    ) {
      event.preventDefault();
      this.currentMousePoint.set(event.clientX, event.clientY);
      this.updateSelectionRectangle(
        this.startSelectPoint,
        this.currentMousePoint
      );
    }
    // If not in SELECT mode, let OrbitControls handle the event
  }

  private onPointerUp(event: PointerEvent): void {
    // Only handle events if we're in an interaction mode
    if (this.interactionMode !== InteractionMode.NONE) {
      event.preventDefault();
      if (event.button !== 0) return;

      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      switch (this.interactionMode) {
        case InteractionMode.MEASURE:
          this.handleMeasureClick();
          break;
        case InteractionMode.SELECT:
          this.handleSelectClick();
          break;
        case InteractionMode.ADD_POINT:
          this.handleAddPointClick();
          break;
      }
    } else if (this.measurementMode) {
      // Handle measurement mode clicks
      this.handleMeasurementModeClick(event);
    }
    // If not in SELECT mode, let OrbitControls handle the event
  }

  private handleMeasureClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.pointsGroup.children
    );

    if (intersects.length > 0) {
      const clickedPoint = intersects[0].point;
      if (!this.firstMeasurementPoint) {
        this.firstMeasurementPoint = clickedPoint;
        this.updateStatus("First point selected. Click the second point.");
      } else {
        const distance = this.firstMeasurementPoint.distanceTo(clickedPoint);
        this.updateDistanceInfo(distance.toFixed(3));
        this.drawMeasurementLine(this.firstMeasurementPoint, clickedPoint);
        this.firstMeasurementPoint = null;
      }
    }
  }

  private handleSelectClick(): void {
    if (this.selectionRectMesh) {
      this.selectPointsInRectangle();
      this.clearSelectionRectangle();
    }
    this.controls.enabled = true;
  }

  private handleAddPointClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.pointsGroup.children
    );

    if (intersects.length > 0) {
      const newPointPos = intersects[0].point;
      this.addPointToData(newPointPos);
    } else {
      // Fallback to plane intersection
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectionPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, intersectionPoint);
      if (intersectionPoint) {
        this.addPointToData(intersectionPoint);
      }
    }
  }

  public loadData(data: JSONData): void {
    this.originalData = data;
    // Clear the trial color map when loading new data
    this.trialColorMap.clear();
    this.renderPoints();
    this.resetCameraToDefault();
  }

  private resetCameraToDefault(): void {
    // Reset camera to isometric view position
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.updateStatus(
      "Data loaded. Isometric view active. Use mouse to rotate, scroll to zoom, right-click to pan. Arrow keys: Left/Right (X-axis), Up/Down (Z-axis)"
    );
  }

  public updateFilters(options: FilterOptions): void {
    this.filteredPoints = [];

    if (!this.originalData) return;

    let bodyPointsCount = 0;
    let landmarkPointsCount = 0;
    let garmentPointsCount = 0;
    let garmentLandmarkPointsCount = 0;

    // Filter body points
    if (options.showBody && this.originalData.body?.levels) {
      this.originalData.body.levels.forEach((level) => {
        if (options.level === "all" || level.name === options.level) {
          if (level.intersectionPoints) {
            level.intersectionPoints.forEach((point) => {
              this.filteredPoints.push({
                type: "body",
                point,
                level: level.name,
              });
              bodyPointsCount++;
            });
          }
        }
      });
    }

    // Filter body landmark points
    if (options.showLandmark && this.originalData.body?.levels) {
      this.originalData.body.levels.forEach((level) => {
        if (options.level === "all" || level.name === options.level) {
          if (level.landmarks) {
            level.landmarks.forEach((landmark) => {
              if (landmark.point) {
                console.log(
                  `Adding body landmark: ${landmark.name} at level: ${level.name}`
                );
                this.filteredPoints.push({
                  type: "landmark",
                  point: landmark.point,
                  level: level.name,
                  landmarkName: landmark.name,
                });
                landmarkPointsCount++;
              }
            });
          }
        }
      });
    }

    // Filter garment points
    if (options.showGarment && this.originalData.trails) {
      this.originalData.trails.forEach((trail) => {
        if (options.trial === "all" || trail.trailName === options.trial) {
          trail.levels.forEach((level) => {
            if (options.level === "all" || level.name === options.level) {
              if (level.intersectionPoints) {
                level.intersectionPoints.forEach((point) => {
                  this.filteredPoints.push({
                    type: "garment",
                    point,
                    level: level.name,
                    trial: trail.trailName,
                  });
                  garmentPointsCount++;
                });
              }
            }
          });
        }
      });
    }

    // Filter garment landmark points separately
    if (options.showGarmentLandmark && this.originalData.trails) {
      this.originalData.trails.forEach((trail) => {
        if (options.trial === "all" || trail.trailName === options.trial) {
          trail.levels.forEach((level) => {
            if (options.level === "all" || level.name === options.level) {
              if (level.landmarks) {
                level.landmarks.forEach((landmark) => {
                  if (landmark.point) {
                    console.log(
                      `Adding garment landmark: ${landmark.name} at level: ${level.name}, trial: ${trail.trailName}`
                    );
                    this.filteredPoints.push({
                      type: "landmark",
                      point: landmark.point,
                      level: level.name,
                      trial: trail.trailName,
                      landmarkName: landmark.name,
                    });
                    garmentLandmarkPointsCount++;
                  }
                });
              }
            }
          });
        }
      });
    }

    console.log(
      `Filtering results: Body: ${bodyPointsCount}, Body Landmark: ${landmarkPointsCount}, Garment: ${garmentPointsCount}, Garment Landmark: ${garmentLandmarkPointsCount}, Total: ${this.filteredPoints.length}`
    );
    console.log(
      `Filter options: Level: ${options.level}, Trial: ${options.trial}, ShowBody: ${options.showBody}, ShowGarment: ${options.showGarment}, ShowLandmark: ${options.showLandmark}, ShowGarmentLandmark: ${options.showGarmentLandmark}`
    );

    this.renderPoints();
  }

  private renderPoints(): void {
    // Clear existing points
    this.pointsGroup.clear();
    this.selectedPoints = [];
    this.clearMeasurementLine();

    // Clear selected point highlights
    this.clearSelectedPointHighlights();

    if (this.filteredPoints.length === 0) return;

    // Separate points by type for different materials
    const bodyPoints: FilteredPoint[] = [];
    const garmentPointsByTrail: Map<string, FilteredPoint[]> = new Map();
    const landmarkPoints: FilteredPoint[] = [];

    this.filteredPoints.forEach((data) => {
      switch (data.type) {
        case "body":
          bodyPoints.push(data);
          break;
        case "garment":
          const trailName = data.trial || "unknown";
          if (!garmentPointsByTrail.has(trailName)) {
            garmentPointsByTrail.set(trailName, []);
          }
          garmentPointsByTrail.get(trailName)!.push(data);
          break;
        case "landmark":
          landmarkPoints.push(data);
          break;
      }
    });

    // Render body points
    if (bodyPoints.length > 0) {
      this.createPointGroup(bodyPoints, 0.025, new THREE.Color(0xff0000));
    }

    // Render garment points by trail with consistent colors
    garmentPointsByTrail.forEach((points, trailName) => {
      // Get or assign consistent color for this trial
      let color = this.trialColorMap.get(trailName);
      if (!color) {
        // Assign new color if this trial hasn't been seen before
        const colorIndex = this.trialColorMap.size;
        color = this.garmentColors[colorIndex % this.garmentColors.length];
        this.trialColorMap.set(trailName, color);
        console.log(
          `Assigned color ${color.getHexString()} to trial "${trailName}"`
        );
      }

      this.createPointGroup(points, 0.025, color);
      console.log(
        `Trail "${trailName}" rendered with color:`,
        color.getHexString()
      );
    });

    // Render landmark points (50% smaller and brighter with labels)
    if (landmarkPoints.length > 0) {
      this.createPointGroup(landmarkPoints, 0.06, new THREE.Color(0x00ffff)); // 50% smaller (0.12 * 0.5 = 0.06)
      this.createLandmarkLabels(landmarkPoints);
    }
  }

  private createPointGroup(
    points: FilteredPoint[],
    size: number,
    color: THREE.Color
  ): void {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    let validPoints = 0;
    let invalidPoints = 0;

    points.forEach((data) => {
      // Validate that point coordinates are valid numbers
      if (this.isValidPoint(data.point)) {
        positions.push(data.point.x, data.point.y, data.point.z);
        colors.push(color.r, color.g, color.b);
        validPoints++;
      } else {
        console.log(
          "Invalid point found:",
          data.point,
          "Type:",
          data.type,
          "Level:",
          data.level,
          "Trial:",
          data.trial
        );
        invalidPoints++;
      }
    });

    // Only create geometry if we have valid points
    if (positions.length === 0) {
      // Only log if there are actually points that were filtered out due to being invalid
      if (invalidPoints > 0) {
        console.log(
          `Filtered out ${invalidPoints} invalid points for ${
            points[0]?.type
          } points (Level: ${points[0]?.level}${
            points[0]?.trial ? `, Trial: ${points[0]?.trial}` : ""
          })`
        );
      }
      return;
    }

    console.log(
      `Created point group: ${validPoints} valid points, ${invalidPoints} invalid points, Type: ${points[0]?.type}, Level: ${points[0]?.level}, Trial: ${points[0]?.trial}`
    );

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    pointsMesh.userData.originalFilteredPoints = points.filter((p) =>
      this.isValidPoint(p.point)
    );
    this.pointsGroup.add(pointsMesh);
  }

  private isValidPoint(point: Point3D): boolean {
    return (
      !isNaN(point.x) &&
      !isNaN(point.y) &&
      !isNaN(point.z) &&
      isFinite(point.x) &&
      isFinite(point.y) &&
      isFinite(point.z)
    );
  }

  public setTopView(): void {
    if (this.pointsGroup.children.length === 0) return;

    const boundingBox = new THREE.Box3().setFromObject(this.pointsGroup);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // Calculate a better camera distance that ensures all points are visible
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDistance *= 1.5; // Reduce multiplier to bring camera closer

    // Position camera above the center looking down
    this.camera.position.set(center.x, center.y + cameraDistance, center.z);
    this.camera.lookAt(center);

    // Adjust near and far clipping planes to ensure points are visible
    this.camera.near = 0.1;
    this.camera.far = Math.max(cameraDistance * 10, 100); // Ensure minimum far plane
    this.camera.updateProjectionMatrix();

    // Update controls target to center
    this.controls.target.copy(center);
    this.controls.update();

    // Debug logging
    console.log("Top View Camera Setup:", {
      boundingBox: {
        min: boundingBox.min,
        max: boundingBox.max,
        size: size,
      },
      center: center,
      cameraDistance: cameraDistance,
      cameraPosition: this.camera.position,
      cameraNear: this.camera.near,
      cameraFar: this.camera.far,
      controlsTarget: this.controls.target,
      controlsMinDistance: this.controls.minDistance,
      controlsMaxDistance: this.controls.maxDistance,
    });

    this.updateStatus("Camera set to Top View");
  }

  public toggleMeasureMode(): void {
    if (this.interactionMode === InteractionMode.MEASURE) {
      this.interactionMode = InteractionMode.NONE;
      this.controls.enabled = true;
      this.updateStatus("Measure mode disabled");
    } else {
      this.interactionMode = InteractionMode.MEASURE;
      this.controls.enabled = false;
      this.updateStatus("Measure mode: Click two points to measure distance");
    }

    // Also toggle the enhanced measurement mode
    this.toggleMeasurementMode();
  }

  public toggleSelectMode(): void {
    this.interactionMode =
      this.interactionMode === InteractionMode.SELECT
        ? InteractionMode.NONE
        : InteractionMode.SELECT;

    if (this.interactionMode === InteractionMode.SELECT) {
      // Clear any existing highlights when entering selection mode
      this.clearSelectedPointHighlights();
      this.controls.enabled = false;
      this.updateStatus("Select mode: Click and drag to select points");
    } else {
      this.controls.enabled = true;
      this.clearSelectionRectangle();
      this.updateStatus("Camera controls enabled");
    }
  }

  public toggleAddPointMode(): void {
    this.interactionMode =
      this.interactionMode === InteractionMode.ADD_POINT
        ? InteractionMode.NONE
        : InteractionMode.ADD_POINT;

    if (this.interactionMode === InteractionMode.ADD_POINT) {
      this.controls.enabled = false;
      this.updateStatus("Add point mode: Click to add a new point");
    } else {
      this.controls.enabled = true;
      this.updateStatus("Camera controls enabled");
    }
  }

  public deleteSelectedPoints(): void {
    if (this.selectedPoints.length === 0) {
      this.updateStatus("No points selected to delete");
      return;
    }

    // Get the exact selected point references
    const selectedPointRefs = this.selectedPoints.map(
      (sp) => sp.originalDataRef
    );

    // Remove selected points from filteredPoints by comparing exact objects
    this.filteredPoints = this.filteredPoints.filter(
      (point) =>
        !selectedPointRefs.some(
          (selectedPoint) =>
            point.type === selectedPoint.type &&
            point.level === selectedPoint.level &&
            point.trial === selectedPoint.trial &&
            point.landmarkName === selectedPoint.landmarkName &&
            point.point.x === selectedPoint.point.x &&
            point.point.y === selectedPoint.point.y &&
            point.point.z === selectedPoint.point.z
        )
    );

    // Remove points from the original data structure
    if (this.originalData) {
      // Remove from body levels
      this.originalData.body.levels.forEach((level) => {
        if (level.intersectionPoints) {
          level.intersectionPoints = level.intersectionPoints.filter(
            (point) =>
              !selectedPointRefs.some(
                (selectedPoint) =>
                  selectedPoint.type === "body" &&
                  selectedPoint.level === level.name &&
                  point.x === selectedPoint.point.x &&
                  point.y === selectedPoint.point.y &&
                  point.z === selectedPoint.point.z
              )
          );
        }
        if (level.landmarks) {
          level.landmarks = level.landmarks.filter(
            (landmark) =>
              !selectedPointRefs.some(
                (selectedPoint) =>
                  selectedPoint.type === "landmark" &&
                  selectedPoint.level === level.name &&
                  selectedPoint.landmarkName === landmark.name &&
                  landmark.point.x === selectedPoint.point.x &&
                  landmark.point.y === selectedPoint.point.y &&
                  landmark.point.z === selectedPoint.point.z
              )
          );
        }
      });

      // Remove from garment trails
      this.originalData.trails.forEach((trail) => {
        trail.levels.forEach((level) => {
          if (level.intersectionPoints) {
            level.intersectionPoints = level.intersectionPoints.filter(
              (point) =>
                !selectedPointRefs.some(
                  (selectedPoint) =>
                    selectedPoint.type === "garment" &&
                    selectedPoint.trial === trail.trailName &&
                    selectedPoint.level === level.name &&
                    point.x === selectedPoint.point.x &&
                    point.y === selectedPoint.point.y &&
                    point.z === selectedPoint.point.z
                )
            );
          }
          if (level.landmarks) {
            level.landmarks = level.landmarks.filter(
              (landmark) =>
                !selectedPointRefs.some(
                  (selectedPoint) =>
                    selectedPoint.type === "landmark" &&
                    selectedPoint.trial === trail.trailName &&
                    selectedPoint.level === level.name &&
                    selectedPoint.landmarkName === landmark.name &&
                    landmark.point.x === selectedPoint.point.x &&
                    landmark.point.y === selectedPoint.point.y &&
                    landmark.point.z === selectedPoint.point.z
                )
            );
          }
        });
      });
    }

    // Clear selection and highlights
    this.selectedPoints = [];
    this.clearSelectedPointHighlights();
    this.clearAllMeasurements();

    // Re-render the scene with updated points
    this.renderPoints();

    this.updateStatus(`${selectedPointRefs.length} points deleted`);
  }

  public getPointCount(): number {
    return this.filteredPoints.length;
  }

  public getModifiedData(): JSONData {
    return this.originalData!;
  }

  public getTrialColorLegend(): string {
    if (this.trialColorMap.size === 0) return "";

    let legend = "Trial Colors:\n";
    this.trialColorMap.forEach((color, trialName) => {
      legend += `• ${trialName}: #${color.getHexString()}\n`;
    });
    return legend;
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Resize 2D editor if it exists
    if (this.editor2D) {
      this.editor2D.resize();
    }
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private updateStatus(message: string): void {
    const statusText = document.getElementById("status-text");
    if (statusText) {
      statusText.textContent = message;
    }
  }

  private updateDistanceInfo(distance: string): void {
    const distanceInfo = document.getElementById("distance-info");
    const measurementInfo = document.getElementById("measurement-info");

    if (distanceInfo) {
      distanceInfo.textContent = distance;
    }

    if (measurementInfo) {
      if (distance && distance.trim() !== "") {
        measurementInfo.style.display = "block";
      } else {
        measurementInfo.style.display = "none";
      }
    }
  }

  private clearMeasurementLine(): void {
    if (this.measurementLine) {
      this.scene.remove(this.measurementLine);
      this.measurementLine.geometry.dispose();
      (this.measurementLine.material as THREE.Material).dispose();
      this.measurementLine = null;
    }
  }

  private drawMeasurementLine(
    point1: THREE.Vector3,
    point2: THREE.Vector3
  ): void {
    this.clearMeasurementLine();
    const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
    this.measurementLine = new THREE.Line(geometry, material);
    this.scene.add(this.measurementLine);
  }

  private createSelectionRectangle(): THREE.LineLoop {
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

  private updateSelectionRectangle(
    start: THREE.Vector2,
    current: THREE.Vector2
  ): void {
    if (!this.selectionRectMesh) return;

    const positions = this.selectionRectMesh.geometry.attributes.position
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

    const p1 = new THREE.Vector3(ndcStart.x, ndcStart.y, 0.5).unproject(
      this.camera
    );
    const p2 = new THREE.Vector3(ndcEnd.x, ndcStart.y, 0.5).unproject(
      this.camera
    );
    const p3 = new THREE.Vector3(ndcEnd.x, ndcEnd.y, 0.5).unproject(
      this.camera
    );
    const p4 = new THREE.Vector3(ndcStart.x, ndcEnd.y, 0.5).unproject(
      this.camera
    );

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

    this.selectionRectMesh.geometry.attributes.position.needsUpdate = true;
  }

  private selectPointsInRectangle(): void {
    if (!this.originalData) return;

    const rectLeft = Math.min(
      this.startSelectPoint.x,
      this.currentMousePoint.x
    );
    const rectRight = Math.max(
      this.startSelectPoint.x,
      this.currentMousePoint.x
    );
    const rectTop = Math.min(this.startSelectPoint.y, this.currentMousePoint.y);
    const rectBottom = Math.max(
      this.startSelectPoint.y,
      this.currentMousePoint.y
    );

    this.selectedPoints = [];

    this.pointsGroup.children.forEach((pointsMesh) => {
      if (pointsMesh instanceof THREE.Points) {
        const positions = pointsMesh.geometry.attributes.position
          .array as Float32Array;
        const colors = pointsMesh.geometry.attributes.color
          .array as Float32Array;
        const originalFiltered = pointsMesh.userData
          .originalFilteredPoints as FilteredPoint[];

        for (let i = 0; i < positions.length / 3; i++) {
          const originalDataItem = originalFiltered[i];
          if (!originalDataItem) continue;

          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          const z = positions[i * 3 + 2];

          const point3D = new THREE.Vector3(x, y, z);
          point3D.project(this.camera);

          const screenX =
            ((point3D.x + 1) / 2) * this.renderer.domElement.clientWidth;
          const screenY =
            ((-point3D.y + 1) / 2) * this.renderer.domElement.clientHeight;

          if (
            screenX >= rectLeft &&
            screenX <= rectRight &&
            screenY >= rectTop &&
            screenY <= rectBottom
          ) {
            this.selectedPoints.push({
              geometryIndex: i,
              pointsMesh,
              originalDataRef: originalDataItem,
            });
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 0;
          }
        }
        pointsMesh.geometry.attributes.color.needsUpdate = true;
      }
    });

    // Highlight selected points with enhanced visualization
    if (this.measurementMode) {
      this.highlightSelectedPoints();
    }

    this.updateStatus(`${this.selectedPoints.length} points selected`);
  }

  private clearSelectionRectangle(): void {
    if (this.selectionRectMesh) {
      this.scene.remove(this.selectionRectMesh);
      this.selectionRectMesh.geometry.dispose();
      (this.selectionRectMesh.material as THREE.Material).dispose();
      this.selectionRectMesh = null;
    }
  }

  private addPointToData(position: THREE.Vector3): void {
    if (!this.originalData) {
      this.updateStatus("No data loaded");
      return;
    }

    // Implementation for adding points to the data structure
    this.updateStatus(
      `Point added at (${position.x.toFixed(2)}, ${position.y.toFixed(
        2
      )}, ${position.z.toFixed(2)})`
    );
    this.renderPoints();
  }

  private initialize2DEditor(): void {
    const container = document.getElementById("2d-editor-container");
    if (container) {
      this.editor2D = new Editor2D("2d-editor-container");
      this.editor2D.setDataChangeCallback((data: JSONData) => {
        this.originalData = data;
        this.renderPoints();
      });
    }
  }

  // 2D Editor Mode Methods
  public toggle2DEditingMode(level: string, trial?: string): void {
    console.log("=== JSONViewer.toggle2DEditingMode START ===");
    console.log("Current state:", {
      is2DEditingMode: this.is2DEditingMode,
      currentEditingLevel: this.currentEditingLevel,
      currentEditingTrial: this.currentEditingTrial,
      hasEditor2D: !!this.editor2D,
      hasOriginalData: !!this.originalData,
    });

    if (this.is2DEditingMode) {
      console.log("Exiting 2D editing mode");
      this.exit2DEditingMode();
    } else {
      console.log("Entering 2D editing mode");
      this.enter2DEditingMode(level, trial);
    }

    console.log("=== JSONViewer.toggle2DEditingMode END ===");
  }

  private enter2DEditingMode(level: string, trial?: string): void {
    console.log("=== enter2DEditingMode START ===");
    console.log("Parameters:", { level, trial });

    if (!this.editor2D) {
      console.error("ERROR: Editor2D is null");
      return;
    }

    if (!this.originalData) {
      console.error("ERROR: No original data loaded");
      return;
    }

    console.log("Setting 2D editing mode state");
    this.is2DEditingMode = true;
    this.currentEditingLevel = level;
    this.currentEditingTrial = trial || "";

    console.log("Disabling 3D controls");
    this.controls.enabled = false;

    // Show the 2D editor container
    const container = document.getElementById("2d-editor-container");
    if (container) {
      container.style.display = "block";
    }

    console.log("Setting data in Editor2D");
    this.editor2D.setData(this.originalData, level, trial);

    // Sync trial colors to ensure consistency between 3D and 2D views
    console.log("Syncing trial colors to Editor2D");
    this.editor2D.syncTrialColors(this.trialColorMap);

    console.log("Showing Editor2D");
    this.editor2D.show();

    const statusMessage = `2D Editing Mode: Level ${level}${
      trial ? `, Trial ${trial}` : ""
    }`;
    console.log("Status message:", statusMessage);
    this.updateStatus(statusMessage);

    console.log("=== enter2DEditingMode END ===");
  }

  private exit2DEditingMode(): void {
    console.log("=== exit2DEditingMode START ===");

    if (!this.editor2D) {
      console.error("ERROR: Editor2D is null");
      return;
    }

    console.log("Setting 2D editing mode state to false");
    this.is2DEditingMode = false;
    this.currentEditingLevel = "";
    this.currentEditingTrial = "";

    console.log("Re-enabling 3D controls");
    this.controls.enabled = true;

    console.log("Hiding Editor2D");
    this.editor2D.hide();

    // Hide the 2D editor container
    const container = document.getElementById("2d-editor-container");
    if (container) {
      container.style.display = "none";
    }

    console.log("Updating status to 3D View Mode");
    this.updateStatus("3D View Mode");

    console.log("=== exit2DEditingMode END ===");
  }

  public isIn2DEditingMode(): boolean {
    return this.is2DEditingMode;
  }

  public getCurrentEditingLevel(): string {
    return this.currentEditingLevel;
  }

  public getCurrentEditingTrial(): string {
    return this.currentEditingTrial;
  }

  // 2D Editor Control Methods
  public zoomIn2D(): void {
    if (this.editor2D && this.is2DEditingMode) {
      this.editor2D.zoomIn();
      this.updateStatus("2D Zoom In");
    }
  }

  public zoomOut2D(): void {
    if (this.editor2D && this.is2DEditingMode) {
      this.editor2D.zoomOut();
      this.updateStatus("2D Zoom Out");
    }
  }

  public reset2DView(): void {
    if (this.editor2D && this.is2DEditingMode) {
      this.editor2D.resetView();
      this.updateStatus("2D View Reset");
    }
  }

  public viewAllPoints2D(): void {
    console.log("=== JSONViewer.viewAllPoints2D START ===");
    console.log("Current state:", {
      hasEditor2D: !!this.editor2D,
      is2DEditingMode: this.is2DEditingMode,
      currentEditingLevel: this.currentEditingLevel,
      currentEditingTrial: this.currentEditingTrial,
    });

    if (!this.editor2D) {
      console.error("ERROR: Editor2D is null - cannot view all points");
      this.updateStatus("2D Editor not initialized");
      return;
    }

    if (!this.is2DEditingMode) {
      console.error("ERROR: Not in 2D editing mode - cannot view all points");
      this.updateStatus("Please enter 2D editing mode first");
      return;
    }

    console.log("Calling editor2D.viewAllPoints()");
    this.editor2D.viewAllPoints();
    this.updateStatus("2D View All Points");
    console.log("=== JSONViewer.viewAllPoints2D END ===");
  }

  // Force view all points with additional checks and error handling
  public forceViewAllPoints2D(): void {
    console.log("=== JSONViewer.forceViewAllPoints2D START ===");
    console.log("Current state:", {
      hasEditor2D: !!this.editor2D,
      is2DEditingMode: this.is2DEditingMode,
      currentEditingLevel: this.currentEditingLevel,
      currentEditingTrial: this.currentEditingTrial,
    });

    if (!this.editor2D) {
      console.error("ERROR: Editor2D is null - cannot force view all points");
      this.updateStatus("2D Editor not initialized");
      return;
    }

    if (!this.is2DEditingMode) {
      console.error(
        "ERROR: Not in 2D editing mode - cannot force view all points"
      );
      this.updateStatus("Please enter 2D editing mode first");
      return;
    }

    console.log("Calling editor2D.forceViewAllPoints()");
    this.editor2D.forceViewAllPoints();
    this.updateStatus("2D Force View All Points");
    console.log("=== JSONViewer.forceViewAllPoints2D END ===");
  }

  // Comprehensive test for viewAllPoints functionality
  public testViewAllPoints2D(): void {
    console.log("=== JSONViewer.testViewAllPoints2D START ===");
    console.log("Current state:", {
      hasEditor2D: !!this.editor2D,
      is2DEditingMode: this.is2DEditingMode,
      currentEditingLevel: this.currentEditingLevel,
      currentEditingTrial: this.currentEditingTrial,
    });

    if (!this.editor2D) {
      console.error("ERROR: Editor2D is null - cannot test view all points");
      this.updateStatus("2D Editor not initialized");
      return;
    }

    if (!this.is2DEditingMode) {
      console.error(
        "ERROR: Not in 2D editing mode - cannot test view all points"
      );
      this.updateStatus("Please enter 2D editing mode first");
      return;
    }

    console.log("Calling editor2D.testViewAllPoints()");
    this.editor2D.testViewAllPoints();
    this.updateStatus("2D Test View All Points");
    console.log("=== JSONViewer.testViewAllPoints2D END ===");
  }

  // Get the current trial color mapping
  public getTrialColorMap(): Map<string, THREE.Color> {
    return this.trialColorMap;
  }

  // Debug method to check control state
  public getControlState(): any {
    return {
      controlsEnabled: this.controls.enabled,
      is2DEditingMode: this.is2DEditingMode,
      interactionMode: this.interactionMode,
      cameraPosition: this.camera.position,
      cameraDistance: this.camera.position.distanceTo(this.controls.target),
      controlsTarget: this.controls.target,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
    };
  }

  // Temporary method to enable 3D controls for testing
  public enable3DControls(): void {
    console.log("Enabling 3D controls for testing");
    this.controls.enabled = true;
    this.updateStatus("3D controls enabled for testing");
  }

  // Temporary method to disable 3D controls
  public disable3DControls(): void {
    console.log("Disabling 3D controls");
    this.controls.enabled = false;
    this.updateStatus("3D controls disabled");
  }

  // Manual zoom methods for testing
  public manualZoomIn(): void {
    console.log("Manual zoom in");
    const currentDistance = this.camera.position.distanceTo(
      this.controls.target
    );
    const newDistance = currentDistance * 0.9;
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.camera.position.copy(
      this.controls.target.clone().add(direction.multiplyScalar(newDistance))
    );
    this.camera.updateMatrixWorld();
    console.log("Manual zoom in - new distance:", newDistance);
  }

  public manualZoomOut(): void {
    console.log("Manual zoom out");
    const currentDistance = this.camera.position.distanceTo(
      this.controls.target
    );
    const newDistance = currentDistance * 1.1;
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.camera.position.copy(
      this.controls.target.clone().add(direction.multiplyScalar(newDistance))
    );
    this.camera.updateMatrixWorld();
    console.log("Manual zoom out - new distance:", newDistance);
  }

  // Pan methods for navigation
  public panLeft(): void {
    console.log("Pan left (X-axis)");
    const panDistance = 0.5;
    this.camera.position.x += panDistance; // Reversed: camera moves right, points appear to move left
    this.controls.target.x += panDistance;
    this.controls.update();
  }

  public panRight(): void {
    console.log("Pan right (X-axis)");
    const panDistance = 0.5;
    this.camera.position.x -= panDistance; // Reversed: camera moves left, points appear to move right
    this.controls.target.x -= panDistance;
    this.controls.update();
  }

  public panUp(): void {
    console.log("Pan up (Z-axis - forward)");
    const panDistance = 0.5;
    this.camera.position.z += panDistance; // Reversed: camera moves backward, points appear to move forward
    this.controls.target.z += panDistance;
    this.controls.update();
  }

  public panDown(): void {
    console.log("Pan down (Z-axis - backward)");
    const panDistance = 0.5;
    this.camera.position.z -= panDistance; // Reversed: camera moves forward, points appear to move backward
    this.controls.target.z -= panDistance;
    this.controls.update();
  }

  // Additional Y-axis pan methods if needed
  public panForward(): void {
    console.log("Pan forward (Y-axis)");
    const panDistance = 0.5;
    this.camera.position.y -= panDistance; // Reversed: camera moves down, points appear to move up
    this.controls.target.y -= panDistance;
    this.controls.update();
  }

  public panBackward(): void {
    console.log("Pan backward (Y-axis)");
    const panDistance = 0.5;
    this.camera.position.y += panDistance; // Reversed: camera moves up, points appear to move down
    this.controls.target.y += panDistance;
    this.controls.update();
  }

  // 2D Selection System Methods
  public set2DSelectionMode(enabled: boolean): void {
    if (this.editor2D) {
      this.editor2D.setSelectionMode(enabled);
    }
  }

  public set2DAddPointMode(enabled: boolean): void {
    if (this.editor2D) {
      this.editor2D.setAddPointMode(enabled);
    }
  }

  public set2DDeletePointMode(enabled: boolean): void {
    if (this.editor2D) {
      this.editor2D.setDeletePointMode(enabled);
    }
  }

  public deleteSelectedPoints2D(): number {
    if (this.editor2D) {
      const selectedPoints = this.editor2D.getSelectedPoints();
      this.editor2D.deleteSelectedPoints();
      return selectedPoints.length;
    }
    return 0;
  }

  public clearSelection2D(): void {
    if (this.editor2D) {
      this.editor2D.clearSelection();
    }
  }

  public undoSelection2D(): void {
    if (this.editor2D) {
      this.editor2D.undoSelection();
    }
  }

  public redoSelection2D(): void {
    if (this.editor2D) {
      this.editor2D.redoSelection();
    }
  }

  public lockPointType2D(pointType: string): void {
    if (this.editor2D) {
      this.editor2D.lockPointType(pointType);
    }
  }

  public unlockPointType2D(pointType: string): void {
    if (this.editor2D) {
      this.editor2D.unlockPointType(pointType);
    }
  }

  public toggleLandmarkLabels2D(): void {
    if (this.editor2D) {
      this.editor2D.toggleLandmarkLabels();
    }
  }

  public toggleLandmarkLabels3D(): void {
    this.show3DLandmarkLabels = !this.show3DLandmarkLabels;
    this.renderPoints(); // Re-render to update labels
    console.log(
      `3D landmark labels ${this.show3DLandmarkLabels ? "enabled" : "disabled"}`
    );
  }

  public setLandmarkLabelsVisible3D(visible: boolean): void {
    this.show3DLandmarkLabels = visible;
    this.renderPoints(); // Re-render to update labels
    console.log(`3D landmark labels ${visible ? "enabled" : "disabled"}`);
  }

  public areLandmarkLabelsVisible3D(): boolean {
    return this.show3DLandmarkLabels;
  }

  private createLandmarkLabels(points: FilteredPoint[]): void {
    // Check if labels should be shown
    if (!this.show3DLandmarkLabels) return;

    points.forEach((data, index) => {
      // Use actual landmark name if available, otherwise fallback to generated name
      let labelText: string;

      if (data.landmarkName) {
        // Use the actual landmark name from the JSON
        const trialInfo = data.trial ? ` (${data.trial})` : "";
        labelText = `${data.landmarkName}${trialInfo}`;
      } else {
        // Fallback to generated name if no actual name is provided
        const levelName = data.level.replace(/\s+/g, ""); // Remove spaces
        const trialInfo = data.trial ? `-${data.trial}` : "";
        labelText = `${levelName}${trialInfo}-L${index + 1}`;
      }

      // Create a separate canvas for each label
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = 256;
      canvas.height = 64;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Set text style
      context.fillStyle = "#00ffff";
      context.strokeStyle = "#000000";
      context.lineWidth = 2;
      context.font = "bold 20px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // Draw text with outline
      context.strokeText(labelText, canvas.width / 2, canvas.height / 2);
      context.fillText(labelText, canvas.width / 2, canvas.height / 2);

      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      // Create sprite material
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        sizeAttenuation: true,
      });

      // Create sprite
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(data.point.x, data.point.y + 0.1, data.point.z); // Position closer to the point
      sprite.scale.set(0.6, 0.15, 1); // Adjust scale for better visibility

      // Add to scene
      this.pointsGroup.add(sprite);

      // Debug logging to verify landmark names
      console.log(
        `Created 3D label for landmark: ${labelText} at position:`,
        data.point
      );
    });
  }

  // Enhanced measurement mode
  public toggleMeasurementMode(): void {
    this.measurementMode = !this.measurementMode;
    this.measurementPoints = [];

    if (this.measurementMode) {
      // Clear any existing selection highlights when entering measurement mode
      this.clearSelectedPointHighlights();
      this.updateStatus(
        "Measurement mode: Click on existing points to measure distance between them"
      );
    } else {
      this.updateStatus("Measurement mode disabled");
      this.clearAllMeasurements();
      this.clearMeasurementMarkersAndHighlights();
    }
  }

  private handleMeasurementModeClick(event: PointerEvent): void {
    if (!this.measurementMode) return;

    // Update mouse coordinates for the current event
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.pointsGroup.children
    );

    if (intersects.length > 0) {
      const clickedPoint = intersects[0].point;
      const clickedObject = intersects[0].object;
      const clickedIndex = intersects[0].index;

      this.measurementPoints.push(clickedPoint);

      // Create highlight for the actual point being measured
      if (clickedObject instanceof THREE.Points && clickedIndex !== undefined) {
        const positions = clickedObject.geometry.attributes.position
          .array as Float32Array;
        const x = positions[clickedIndex * 3];
        const y = positions[clickedIndex * 3 + 1];
        const z = positions[clickedIndex * 3 + 2];

        // Create a larger, brighter sphere for the measured point
        const highlightGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const highlightMaterial = new THREE.MeshBasicMaterial({
          color: 0xffff00, // Yellow color for measurement highlights (same as selection mode)
          transparent: true,
          opacity: 0.9,
        });

        const highlightMesh = new THREE.Mesh(
          highlightGeometry,
          highlightMaterial
        );
        highlightMesh.position.set(x, y, z);
        const highlightId = `measurement_${clickedObject.id}_${clickedIndex}`;
        highlightMesh.userData.measurementPointId = highlightId;

        this.scene.add(highlightMesh);
        this.measurementPointHighlights.set(highlightId, highlightMesh);
      }

      if (this.measurementPoints.length === 1) {
        this.updateStatus(
          "First point selected. Click on another existing point to measure distance."
        );
      } else if (this.measurementPoints.length === 2) {
        const distance = this.measurementPoints[0].distanceTo(
          this.measurementPoints[1]
        );
        this.drawMeasurementLineWithLabel(
          this.measurementPoints[0],
          this.measurementPoints[1]
        );
        this.updateStatus(
          `Distance: ${distance.toFixed(
            3
          )}m. Click on existing points to measure another pair.`
        );
        this.measurementPoints = []; // Reset for next measurement

        // Clear measurement markers and highlights
        this.clearMeasurementMarkersAndHighlights();
      }

      // Create temporary marker at clicked position
      const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9,
      });
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
      markerMesh.position.copy(clickedPoint);
      this.scene.add(markerMesh);
      this.measurementPointMarkers.push(markerMesh);
    } else {
      // No point clicked - provide feedback
      this.updateStatus(
        "No point found. Click on existing points to measure distance."
      );
    }
  }

  // Enhanced highlighting methods
  private highlightSelectedPoints(): void {
    // Clear previous highlights
    this.clearSelectedPointHighlights();

    this.selectedPoints.forEach((selectedPoint) => {
      const positions = selectedPoint.pointsMesh.geometry.attributes.position
        .array as Float32Array;
      const x = positions[selectedPoint.geometryIndex * 3];
      const y = positions[selectedPoint.geometryIndex * 3 + 1];
      const z = positions[selectedPoint.geometryIndex * 3 + 2];

      // Create a larger, brighter sphere for selected points
      const highlightGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Bright yellow
        transparent: true,
        opacity: 0.8,
      });

      const highlightMesh = new THREE.Mesh(
        highlightGeometry,
        highlightMaterial
      );
      highlightMesh.position.set(x, y, z);
      highlightMesh.userData.selectedPointId = `${selectedPoint.pointsMesh.id}_${selectedPoint.geometryIndex}`;

      this.scene.add(highlightMesh);
      this.selectedPointHighlights.set(
        highlightMesh.userData.selectedPointId,
        highlightMesh
      );
    });

    // Show measurements if we have multiple selected points
    if (this.selectedPoints.length >= 2) {
      this.showMeasurementsBetweenSelectedPoints();
    }
  }

  private clearSelectedPointHighlights(): void {
    this.selectedPointHighlights.forEach((highlight) => {
      this.scene.remove(highlight);
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
    });
    this.selectedPointHighlights.clear();

    // Clear measurement lines and labels
    this.clearAllMeasurements();
  }

  private showMeasurementsBetweenSelectedPoints(): void {
    if (this.selectedPoints.length < 2) return;

    // Clear previous measurements
    this.clearAllMeasurements();

    // Get positions of selected points
    const positions: THREE.Vector3[] = [];
    this.selectedPoints.forEach((selectedPoint) => {
      const posArray = selectedPoint.pointsMesh.geometry.attributes.position
        .array as Float32Array;
      const x = posArray[selectedPoint.geometryIndex * 3];
      const y = posArray[selectedPoint.geometryIndex * 3 + 1];
      const z = posArray[selectedPoint.geometryIndex * 3 + 2];
      positions.push(new THREE.Vector3(x, y, z));
    });

    // Draw lines and measurements between all selected points
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        this.drawMeasurementLineWithLabel(positions[i], positions[j]);
      }
    }

    // Update distance info with total measurements
    this.updateMeasurementInfo();
  }

  private drawMeasurementLineWithLabel(
    point1: THREE.Vector3,
    point2: THREE.Vector3
  ): void {
    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      point1,
      point2,
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00, // Green
      linewidth: 3,
    });

    const line = new THREE.Line(lineGeometry, lineMaterial);
    this.scene.add(line);
    this.measurementLines.push(line);

    // Calculate distance
    const distance = point1.distanceTo(point2);

    // Create label
    this.createMeasurementLabel(point1, point2, distance);
  }

  private createMeasurementLabel(
    point1: THREE.Vector3,
    point2: THREE.Vector3,
    distance: number
  ): void {
    // Calculate midpoint for label position
    const midpoint = new THREE.Vector3()
      .addVectors(point1, point2)
      .multiplyScalar(0.5);

    // Create canvas for text
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = 256;
    canvas.height = 64;

    // Set canvas background
    context.fillStyle = "rgba(0, 0, 0, 0.8)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Set text style
    context.fillStyle = "#00ff00";
    context.font = "24px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    // Draw text
    const text = `${distance.toFixed(3)}m`;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create sprite from canvas
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);

    // Position sprite
    sprite.position.copy(midpoint);
    sprite.scale.set(2, 0.5, 1);

    this.scene.add(sprite);
    this.measurementLabels.push(sprite);
  }

  private clearAllMeasurements(): void {
    // Clear measurement lines
    this.measurementLines.forEach((line) => {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.measurementLines = [];

    // Clear measurement labels
    this.measurementLabels.forEach((label) => {
      this.scene.remove(label);
      (label.material as THREE.SpriteMaterial).map?.dispose();
      (label.material as THREE.Material).dispose();
    });
    this.measurementLabels = [];
  }

  private updateMeasurementInfo(): void {
    if (this.selectedPoints.length < 2) {
      this.updateDistanceInfo("");
      return;
    }

    let totalDistance = 0;
    let minDistance = Infinity;
    let maxDistance = 0;

    // Calculate distances between all selected points
    for (let i = 0; i < this.selectedPoints.length; i++) {
      for (let j = i + 1; j < this.selectedPoints.length; j++) {
        const pos1 = this.getSelectedPointPosition(this.selectedPoints[i]);
        const pos2 = this.getSelectedPointPosition(this.selectedPoints[j]);
        const distance = pos1.distanceTo(pos2);

        totalDistance += distance;
        minDistance = Math.min(minDistance, distance);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    const avgDistance =
      totalDistance /
      ((this.selectedPoints.length * (this.selectedPoints.length - 1)) / 2);

    const measurementText = `Selected: ${
      this.selectedPoints.length
    } points | Avg: ${avgDistance.toFixed(3)}m | Min: ${minDistance.toFixed(
      3
    )}m | Max: ${maxDistance.toFixed(3)}m | Total: ${totalDistance.toFixed(
      3
    )}m`;
    this.updateDistanceInfo(measurementText);
  }

  private getSelectedPointPosition(
    selectedPoint: SelectedPoint
  ): THREE.Vector3 {
    const positions = selectedPoint.pointsMesh.geometry.attributes.position
      .array as Float32Array;
    const x = positions[selectedPoint.geometryIndex * 3];
    const y = positions[selectedPoint.geometryIndex * 3 + 1];
    const z = positions[selectedPoint.geometryIndex * 3 + 2];
    return new THREE.Vector3(x, y, z);
  }

  private clearMeasurementMarkersAndHighlights(): void {
    this.measurementPointMarkers.forEach((marker) => {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    this.measurementPointMarkers = [];

    this.measurementPointHighlights.forEach((highlight) => {
      this.scene.remove(highlight);
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
    });
    this.measurementPointHighlights.clear();
  }
}
