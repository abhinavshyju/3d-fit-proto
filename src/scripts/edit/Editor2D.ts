import type { Point3D, Point2D, Point, Curve, JSONData } from "./types";
import * as THREE from "three";

export class Editor2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: JSONData | null = null;
  private currentLevel: string = "";
  private currentTrial: string = "";
  private points: Point[] = [];
  private selectedPoints: Set<string> = new Set();
  private hoveredPoint: string | null = null;
  private isDragging: boolean = false;
  private dragStart: Point2D = { x: 0, y: 0 };
  private curves: Curve[] = [];
  private isDrawingCurve: boolean = false;
  private curvePoints: Point2D[] = [];
  private scale: number = 1;
  private offset: Point2D = { x: 0, y: 0 };
  private onDataChange: ((data: JSONData) => void) | null = null;
  private isRendering: boolean = false; // Prevent continuous re-rendering
  private optimalCanvasSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };
  private is2DEditingMode: boolean = false;
  private coordinateScale: number = 100; // Scale coordinates by 100x to make points more visible
  private isSelectionMode: boolean = false; // Track if we're in rectangle selection mode
  private selectionStart: Point2D = { x: 0, y: 0 }; // Start point for rectangle selection
  private selectionEnd: Point2D = { x: 0, y: 0 }; // End point for rectangle selection
  private isSelecting: boolean = false; // Track if we're currently drawing selection rectangle
  private isAddingPoints: boolean = false; // Track if we're in add point mode
  private isDeletingPoints: boolean = false; // Track if we're in delete point mode

  // Color scheme matching the 3D viewer
  private trialColorMap: Map<string, string> = new Map();
  private garmentColors: string[] = [
    "#00ff00", // Green
    "#ffff00", // Yellow
    "#ff00ff", // Magenta
    "#00ffff", // Cyan
    "#ff8800", // Orange
    "#8800ff", // Purple
    "#008800", // Dark Green
    "#880000", // Dark Red
    "#ff0088", // Pink
    "#0088ff", // Light Blue
    "#88ff00", // Lime
    "#ff8800", // Orange
  ];

  // Point locking system
  private lockedPointTypes: Set<string> = new Set(); // 'body', 'garment', 'landmark'
  private lockedPoints: Set<string> = new Set(); // Individual locked point IDs

  // Selection rectangle properties
  private selectionRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;
  private selectionRectColor: string = "rgba(0, 123, 255, 0.3)";
  private selectionRectBorderColor: string = "rgba(0, 123, 255, 0.8)";

  // Visual feedback properties
  private selectedPointColor: string = "#ff6b6b";
  private lockedPointColor: string = "#6c757d";
  private hoveredPointColor: string = "#ffd93d";
  private normalPointColor: string = "#ffffff";

  // Selection history for undo/redo
  private selectionHistory: Set<string>[] = [];
  private currentSelectionIndex: number = -1;

  // Coordinate input panel properties
  private coordinatePanel: HTMLDivElement | null = null;
  private coordinateInputs: {
    x: HTMLInputElement | null;
    y: HTMLInputElement | null;
    z: HTMLInputElement | null;
  } = { x: null, y: null, z: null };
  private isUpdatingFromSelection: boolean = false; // Prevent circular updates
  private showLandmarkLabels: boolean = true; // Control landmark label visibility

  // Measurement display for 2D editor
  private measurementLines: {
    line: Path2D;
    distance: number;
    start: Point2D;
    end: Point2D;
  }[] = [];
  private showMeasurements: boolean = true;

  constructor(containerId: string) {
    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.zIndex = "1000";
    this.canvas.style.pointerEvents = "auto";
    this.canvas.style.display = "none";

    // Find container element
    const container = document.getElementById(containerId);
    if (container) {
      // Append canvas to container
      container.appendChild(this.canvas);

      // Get 2D context
      const context = this.canvas.getContext("2d");
      if (context) {
        this.ctx = context;
        // Set up initial canvas size
        this.resize();

        // Set up event listeners
        this.setupEventListeners();

        // Set custom cursor
        this.setSmallCursor();
      } else {
        throw new Error("Failed to get 2D context from canvas");
      }
    } else {
      throw new Error(`Container element with ID '${containerId}' not found`);
    }
  }

  // Set smaller cursor for the canvas
  private setSmallCursor(): void {
    // Create a smaller crosshair cursor using CSS
    const cursorSize = 8; // 50% of default 16px
    const cursorSVG = `
            <svg width="${cursorSize}" height="${cursorSize}" xmlns="http://www.w3.org/2000/svg">
                <line x1="0" y1="${cursorSize / 2}" x2="${cursorSize}" y2="${
      cursorSize / 2
    }" stroke="white" stroke-width="1"/>
                <line x1="${cursorSize / 2}" y1="0" x2="${
      cursorSize / 2
    }" y2="${cursorSize}" stroke="white" stroke-width="1"/>
                <line x1="0" y1="${cursorSize / 2}" x2="${cursorSize}" y2="${
      cursorSize / 2
    }" stroke="black" stroke-width="1" stroke-dasharray="1,1"/>
                <line x1="${cursorSize / 2}" y1="0" x2="${
      cursorSize / 2
    }" y2="${cursorSize}" stroke="black" stroke-width="1" stroke-dasharray="1,1"/>
            </svg>
        `;

    try {
      const cursorDataURL = "data:image/svg+xml;base64," + btoa(cursorSVG);
      this.canvas.style.cursor = `url('${cursorDataURL}') ${cursorSize / 2} ${
        cursorSize / 2
      }, crosshair`;
      // console.log removed
    } catch (error) {
      // Fallback to CSS cursor with smaller size
      this.canvas.style.cursor = "crosshair";
      // console.log removed
    }
  }

  public setData(data: JSONData, level: string, trial?: string): void {
    this.data = data;
    this.currentLevel = level;
    this.currentTrial = trial || "";

    // Load points for the current level
    this.loadPointsForLevel();

    // Fit all points to view
    this.fitToView();

    // Render the canvas
    this.render();
  }

  public setDataChangeCallback(callback: (data: JSONData) => void): void {
    // console.log removed
    this.onDataChange = callback;
  }

  public show(): void {
    this.is2DEditingMode = true;

    // Show the canvas
    this.canvas.style.display = "block";

    // Force a resize to ensure proper dimensions
    this.resize();

    // Create coordinate panel if it doesn't exist
    if (!this.coordinatePanel) {
      this.createCoordinatePanel();
    }

    // Render the canvas
    this.render();

    // Check canvas visibility
    this.checkCanvasVisibility();

    // Delayed call to viewAllPoints to ensure proper rendering
    setTimeout(() => {
      this.viewAllPoints();
    }, 100);

    // Test button for debugging
    setTimeout(() => {
      this.testViewAllPoints();
    }, 200);
  }

  private checkCanvasVisibility(): void {
    // console.log removed

    // Check if canvas is in DOM
    // const isInDOM = document.contains(this.canvas); // Removed unused variable
    // console.log removed

    // Check parent container
    const parent = this.canvas.parentElement;
    // console.log removed
    if (parent) {
      console.log("Parent dimensions:", {
        clientWidth: parent.clientWidth,
        clientHeight: parent.clientHeight,
        offsetWidth: parent.offsetWidth,
        offsetHeight: parent.offsetHeight,
        scrollWidth: parent.scrollWidth,
        scrollHeight: parent.scrollHeight,
      });
      console.log("Parent styles:", {
        position: parent.style.position,
        display: parent.style.display,
        visibility: parent.style.visibility,
        overflow: parent.style.overflow,
      });
    }

    // Check canvas dimensions
    console.log("Canvas dimensions:", {
      width: this.canvas.width,
      height: this.canvas.height,
      clientWidth: this.canvas.clientWidth,
      clientHeight: this.canvas.clientHeight,
      offsetWidth: this.canvas.offsetWidth,
      offsetHeight: this.canvas.offsetHeight,
    });

    // Check canvas styles
    console.log("Canvas styles:", {
      position: this.canvas.style.position,
      display: this.canvas.style.display,
      visibility: this.canvas.style.visibility,
      zIndex: this.canvas.style.zIndex,
    });

    // console.log removed
  }

  public hide(): void {
    this.is2DEditingMode = false;
    this.canvas.style.display = "none";
  }

  public resize(): void {
    const container = document.getElementById("2d-editor-container");
    if (container) {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Set canvas size to match container
      this.canvas.width = containerWidth;
      this.canvas.height = containerHeight;

      // Update optimal canvas size
      this.optimalCanvasSize = {
        width: containerWidth,
        height: containerHeight,
      };
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this));
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Add keyboard shortcuts for zoom and pan
    document.addEventListener("keydown", this.onKeyDown.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Only handle keyboard events when 2D editor is active
    if (!this.is2DEditingMode) return;

    switch (event.key) {
      case "+":
      case "=":
        event.preventDefault();
        this.zoomIn();
        break;
      case "-":
      case "_":
        event.preventDefault();
        this.zoomOut();
        break;
      case "0":
        event.preventDefault();
        this.resetView();
        break;
      case "a":
      case "A":
        event.preventDefault();
        this.viewAllPoints();
        break;
      case "c":
      case "C":
        event.preventDefault();
        this.centerOnOrigin();
        break;
      case "s":
      case "S":
        event.preventDefault();
        this.toggleCoordinateScaling();
        break;
      case "r":
      case "R":
        event.preventDefault();
        this.startRectangleSelection();
        break;
      case "b":
      case "B":
        event.preventDefault();
        this.logPointBounds();
        break;
      case "d":
      case "D":
        event.preventDefault();
        this.deleteSelectedPoints();
        break;
      case "Escape":
        event.preventDefault();
        this.clearSelection();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.panUp();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.panDown();
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.panLeft();
        break;
      case "ArrowRight":
        event.preventDefault();
        this.panRight();
        break;
      case "x":
      case "X":
        event.preventDefault();
        this.debugCoordinateSystem();
        break;
      case "p":
      case "P":
        event.preventDefault();
        this.toggleCoordinatePanel();
        break;
      case "l":
      case "L":
        event.preventDefault();
        this.toggleLandmarkLabels();
        break;
    }
  }

  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const mousePos = this.screenToWorld({ x: screenX, y: screenY });

    console.log("Mouse Down Event:", {
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      screenPos: { x: screenX, y: screenY },
      worldPos: mousePos,
      isSelectionMode: this.isSelectionMode,
      isAddingPoints: this.isAddingPoints,
      isDeletingPoints: this.isDeletingPoints,
      currentSelectedPoints: Array.from(this.selectedPoints),
    });

    // Find point at mouse position
    const clickedPoint = this.findPointAt(mousePos);

    if (clickedPoint) {
      console.log("Point Clicked:", {
        pointId: clickedPoint.id,
        pointType: clickedPoint.type,
        pointPosition: clickedPoint.position,
        isLocked: this.isPointLocked(clickedPoint.id),
        isCurrentlySelected: this.selectedPoints.has(clickedPoint.id),
      });
    } else {
      console.log("No point clicked at position");
    }

    if (event.button === 0) {
      // Left click
      if (this.isAddingPoints) {
        // Add point mode
        console.log("Adding point at:", mousePos);
        this.addPoint(mousePos);
      } else if (this.isDeletingPoints) {
        // Delete point mode
        if (clickedPoint) {
          console.log("Deleting point:", clickedPoint.id);
          this.deletePoint(clickedPoint.id);
        }
      } else if (this.isSelectionMode) {
        // Rectangle selection mode
        console.log("Starting rectangle selection at:", mousePos);
        this.selectionStart = { x: screenX, y: screenY }; // FIXED: Use screen coordinates
        this.selectionEnd = { x: screenX, y: screenY }; // FIXED: Use screen coordinates
        this.isSelecting = true;
      } else {
        // Normal mode - point selection/drag
        if (clickedPoint) {
          if (this.isPointLocked(clickedPoint.id)) {
            console.log("Point is locked, cannot interact:", clickedPoint.id);
            return; // Point is locked, cannot interact
          }

          if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + click toggles selection
            if (this.selectedPoints.has(clickedPoint.id)) {
              console.log("Removing point from selection:", clickedPoint.id);
              this.removeFromSelection(clickedPoint.id);
            } else {
              console.log("Adding point to selection:", clickedPoint.id);
              this.addToSelection(clickedPoint.id);
            }
          } else {
            // Single click selects only this point
            console.log("Setting single point selection:", clickedPoint.id);
            this.setSelection(new Set([clickedPoint.id]));
          }

          // Start drag operation
          this.isDragging = true;
          this.dragStart = mousePos;
        } else {
          // No point clicked, clear selection and start pan
          if (!event.ctrlKey && !event.metaKey) {
            console.log("No point clicked, clearing selection");
            this.clearSelection();
          }
          this.isDragging = true;
          this.dragStart = mousePos;
        }
      }
    } else if (event.button === 2) {
      // Right click
      // Right click deletes point
      if (clickedPoint) {
        console.log("Right click deleting point:", clickedPoint.id);
        this.deletePoint(clickedPoint.id);
      }
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    // Fix: Calculate mouse position in screen coordinates first
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    // Then convert to world coordinates for point operations
    const mousePos: Point2D = this.screenToWorld({ x: screenX, y: screenY });

    // Debug coordinate transformation when near origin
    const isNearOrigin =
      Math.abs(mousePos.x) < 0.1 && Math.abs(mousePos.y) < 0.1;
    if (isNearOrigin) {
      console.log("Mouse near origin - Coordinate transformation:", {
        rawMouseEvent: { clientX: event.clientX, clientY: event.clientY },
        canvasRect: { left: rect.left, top: rect.top },
        screenCoords: { x: screenX, y: screenY },
        worldCoords: mousePos,
        scale: this.scale,
        offset: this.offset,
        transformation: {
          screenToWorld: `(${screenX} - ${this.offset.x}) / ${this.scale} = ${mousePos.x}`,
          screenToWorldY: `(${screenY} - ${this.offset.y}) / ${this.scale} = ${mousePos.y}`,
        },
      });
    }

    // Update cursor coordinates display
    this.updateCursorCoordinates(mousePos);

    // Update hover state
    const hoveredPoint = this.findPointAt(mousePos);
    const hoverChanged = hoveredPoint?.id !== this.hoveredPoint;

    if (hoverChanged) {
      this.hoveredPoint = hoveredPoint?.id || null;
      this.render();
    }

    if (this.isDragging && !this.isSelecting) {
      if (this.selectedPoints.size > 0) {
        // Move selected points (only unlocked ones)
        const deltaX = mousePos.x - this.dragStart.x;
        const deltaY = mousePos.y - this.dragStart.y;

        let movedAny = false;
        this.selectedPoints.forEach((pointId) => {
          const point = this.points.find((p) => p.id === pointId);
          if (point && !this.isPointLocked(point.id)) {
            point.position.x += deltaX;
            point.position.y += deltaY;
            movedAny = true;
          }
        });

        if (movedAny) {
          this.dragStart = mousePos;
          this.updateData();
          this.render();
        }
      } else {
        // Panning the view
        const deltaX = mousePos.x - this.dragStart.x;
        const deltaY = mousePos.y - this.dragStart.y;
        this.offset.x += deltaX;
        this.offset.y += deltaY;
        this.dragStart = mousePos;
        this.render();
      }
    } else if (this.isSelecting) {
      // Update selection rectangle in screen coordinates
      this.selectionEnd = { x: screenX, y: screenY };

      // Calculate rectangle bounds in screen coordinates (FIXED: now both start and end are screen coords)
      const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
      const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
      const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
      const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

      this.selectionRect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

      console.log("Rectangle Selection Update:", {
        selectionStart: this.selectionStart,
        selectionEnd: this.selectionEnd,
        selectionRect: this.selectionRect,
        mouseScreenPos: { x: screenX, y: screenY },
        mouseWorldPos: mousePos,
        rectBounds: { minX, minY, maxX, maxY },
      });

      // Select points within the rectangle (only unlocked ones)
      const selectedPoints = new Set<string>();
      let pointsChecked = 0;
      let pointsInRect = 0;

      this.points.forEach((point) => {
        if (this.isPointLocked(point.id)) return; // Skip locked points

        pointsChecked++;

        // Convert point position to screen coordinates for comparison
        const pointScreenPos = this.worldToScreen({
          x: point.position.x,
          y: point.position.y,
        });

        // FIXED: Use screen coordinates consistently for both rectangle and points
        const inRect =
          pointScreenPos.x >= minX &&
          pointScreenPos.x <= maxX &&
          pointScreenPos.y >= minY &&
          pointScreenPos.y <= maxY;

        console.log(`Checking point ${point.id}:`, {
          pointWorldPos: { x: point.position.x, y: point.position.y },
          pointScreenPos: pointScreenPos,
          rectBounds: { minX, minY, maxX, maxY },
          inRect: inRect,
          xCheck: `${pointScreenPos.x} >= ${minX} && ${pointScreenPos.x} <= ${maxX}`,
          yCheck: `${pointScreenPos.y} >= ${minY} && ${pointScreenPos.y} <= ${maxY}`,
        });

        if (inRect) {
          selectedPoints.add(point.id);
          pointsInRect++;
        }
      });

      console.log("Rectangle Selection Results:", {
        totalPoints: this.points.length,
        pointsChecked: pointsChecked,
        pointsInRect: pointsInRect,
        selectedPoints: Array.from(selectedPoints),
        selectionRect: this.selectionRect,
        rectBounds: { minX, minY, maxX, maxY },
      });

      this.setSelection(selectedPoints);
      this.render();
    }
  }

  private onMouseUp(event: MouseEvent): void {
    console.log("Mouse Up Event:", {
      isSelecting: this.isSelecting,
      isDragging: this.isDragging,
      selectedPointsCount: this.selectedPoints.size,
      selectionRect: this.selectionRect,
    });

    if (this.isSelecting) {
      // Finish rectangle selection
      console.log("Finishing rectangle selection:", {
        finalSelectionRect: this.selectionRect,
        finalSelectedPoints: Array.from(this.selectedPoints),
        totalPointsSelected: this.selectedPoints.size,
      });
      this.isSelecting = false;
      this.selectionRect = null;
    } else if (this.isDragging && this.selectedPoints.size === 0) {
      // Selection rectangle or add new point
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / this.scale - this.offset.x;
      const y = (event.clientY - rect.top) / this.scale - this.offset.y;
      const mousePos: Point2D = { x, y };

      // Check if it's a click (not drag)
      const distance = Math.sqrt(
        (mousePos.x - this.dragStart.x) ** 2 +
          (mousePos.y - this.dragStart.y) ** 2
      );

      console.log("Drag ended, checking for click vs drag:", {
        distance: distance,
        threshold: 5,
        isClick: distance < 5,
        mousePos: mousePos,
        dragStart: this.dragStart,
      });

      if (distance < 5) {
        // Add new point
        console.log("Adding new point from click:", mousePos);
        this.addPoint(mousePos);
      }
    }

    this.isDragging = false;
    this.render();
  }

  private onWheel(event: WheelEvent): void {
    // Only handle wheel events if we're actually in 2D editing mode
    if (!this.is2DEditingMode) {
      // Let the event pass through to the 3D view
      return;
    }

    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = this.scale;

    // Get mouse position in screen coordinates
    const rect = this.canvas.getBoundingClientRect();
    const mouseScreenX = event.clientX - rect.left;
    const mouseScreenY = event.clientY - rect.top;

    // Convert mouse position to world coordinates before zoom
    const mouseWorldPos = this.screenToWorld({
      x: mouseScreenX,
      y: mouseScreenY,
    });

    // Apply zoom
    this.scale *= zoomFactor;
    this.scale = Math.max(0.1, Math.min(200, this.scale));

    // Adjust offset so the mouse position stays at the same world coordinates
    this.offset.x = mouseScreenX / this.scale - mouseWorldPos.x;
    this.offset.y = mouseScreenY / this.scale - mouseWorldPos.y;

    console.log("2D Editor Zoom operation:", {
      zoomFactor: zoomFactor,
      oldScale: oldScale,
      newScale: this.scale,
      mouseScreen: { x: mouseScreenX, y: mouseScreenY },
      mouseWorld: mouseWorldPos,
      oldOffset: {
        x: mouseScreenX / oldScale - mouseWorldPos.x,
        y: mouseScreenY / oldScale - mouseWorldPos.y,
      },
      newOffset: this.offset,
    });

    this.render();
  }

  private onDoubleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.scale - this.offset.x;
    const y = (event.clientY - rect.top) / this.scale - this.offset.y;
    const mousePos: Point2D = { x, y };

    // Start curve creation
    this.startCurveCreation(mousePos);
  }

  private loadPointsForLevel(): void {
    if (!this.data || !this.currentLevel) {
      this.points = [];
      return;
    }

    this.points = [];

    // Load body points
    const bodyLevel = this.data.body.levels.find(
      (l) => l.name === this.currentLevel
    );
    if (bodyLevel) {
      if (bodyLevel.intersectionPoints) {
        bodyLevel.intersectionPoints.forEach((point, index) => {
          const transformed = this.transformCoordinates(
            point.x,
            point.y,
            point.z
          );
          this.points.push({
            id: `body_${this.currentLevel}_${index}`,
            position: { x: transformed.x, y: transformed.y, z: transformed.z },
            type: "body",
            level: this.currentLevel,
            metadata: { originalIndex: index, originalPosition: point },
          });
        });
      }

      if (bodyLevel.landmarks) {
        bodyLevel.landmarks.forEach((landmark, index) => {
          // Use the correct path: landmark.point
          if (landmark.point) {
            const transformed = this.transformCoordinates(
              landmark.point.x,
              landmark.point.y,
              landmark.point.z
            );
            this.points.push({
              id: `landmark_${this.currentLevel}_${index}`,
              position: {
                x: transformed.x,
                y: transformed.y,
                z: transformed.z,
              },
              type: "landmark",
              level: this.currentLevel,
              metadata: {
                originalIndex: index,
                originalPosition: landmark.point,
                landmarkName: landmark.name, // Preserve the landmark name
              },
            });
          }
        });
      }
    }

    // Load garment intersection points
    if (this.currentTrial) {
      const trail = this.data.trails.find(
        (t) => t.trailName === this.currentTrial
      );
      if (trail) {
        const trailLevel = trail.levels.find(
          (l) => l.name === this.currentLevel
        );
        if (trailLevel && trailLevel.intersectionPoints) {
          trailLevel.intersectionPoints.forEach((point, index) => {
            const transformed = this.transformCoordinates(
              point.x,
              point.y,
              point.z
            );
            this.points.push({
              id: `garment_${this.currentTrial}_${this.currentLevel}_${index}`,
              position: {
                x: transformed.x,
                y: transformed.y,
                z: transformed.z,
              },
              type: "garment",
              level: this.currentLevel,
              trial: this.currentTrial,
              metadata: { originalIndex: index, originalPosition: point },
            });
          });
        }

        // Load garment landmarks if they exist
        if (trailLevel && trailLevel.landmarks) {
          trailLevel.landmarks.forEach((landmark, index) => {
            // Check if garment landmarks also use the point structure
            if (landmark.point) {
              const transformed = this.transformCoordinates(
                landmark.point.x,
                landmark.point.y,
                landmark.point.z
              );
              this.points.push({
                id: `garment_landmark_${this.currentTrial}_${this.currentLevel}_${index}`,
                position: {
                  x: transformed.x,
                  y: transformed.y,
                  z: transformed.z,
                },
                type: "landmark",
                level: this.currentLevel,
                trial: this.currentTrial,
                metadata: {
                  originalIndex: index,
                  originalPosition: landmark.point,
                  landmarkName: landmark.name, // Preserve the landmark name
                },
              });
            }
          });
        }
      }
    }

    // Update locked points based on current settings
    this.updateLockedPoints();
  }

  private findPointAt(position: Point2D, threshold: number = 10): Point | null {
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    let closestPoint: Point | null = null;
    let closestDistance = Infinity;

    for (const point of this.points) {
      const distance = Math.sqrt(
        (position.x - point.position.x) ** 2 +
          (position.y - point.position.y) ** 2
      );

      // Removed verbose point logging to reduce console spam

      if (distance <= threshold / this.scale) {
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }
    }

    // console.log removed
    // console.log removed
    // console.log removed

    return closestPoint;
  }

  private addPoint(position: Point2D): void {
    if (!this.data) return;

    // Determine point type based on current context
    let type: "body" | "garment" | "landmark" = "body";
    if (this.currentTrial) {
      type = "garment";
    }

    // Transform the position based on current view rotation
    const transformedPosition = this.transformCoordinates(
      position.x,
      position.y,
      0
    );

    const pointId = this.generatePointId();
    const point: Point = {
      id: pointId,
      position: transformedPosition,
      type,
      level: this.currentLevel,
      trial: this.currentTrial,
      metadata: {
        originalIndex: -1,
        originalPosition: { x: position.x, y: position.y, z: 0 },
      },
    };

    this.points.push(point);
    this.updateData();
    this.render();
  }

  private deletePoint(pointId: string): void {
    this.points = this.points.filter((p) => p.id !== pointId);
    this.selectedPoints.delete(pointId);
    this.updateData();
    this.render();
  }

  private startCurveCreation(position: Point2D): void {
    this.isDrawingCurve = true;
    this.curvePoints = [position];
    this.render();
  }

  private fitToView(): void {
    // console.log removed
    // console.log removed
    // console.log removed

    if (this.points.length === 0) {
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // Log first few points to see their structure
    console.log(
      "First 3 points:",
      this.points.slice(0, 3).map((p) => ({
        id: p.id,
        position: p.position,
        type: p.type,
      }))
    );

    this.points.forEach((point) => {
      if (isFinite(point.position.x) && isFinite(point.position.y)) {
        minX = Math.min(minX, point.position.x);
        minY = Math.min(minY, point.position.y);
        maxX = Math.max(maxX, point.position.x);
        maxY = Math.max(maxY, point.position.y);
      } else {
        // Removed verbose invalid coordinates logging
      }
    });

    // console.log removed

    // Check if we have valid bounds
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 50;
    const maxDimension = Math.max(width, height);

    // console.log removed

    // Check if dimensions are valid
    if (
      width <= 0 ||
      height <= 0 ||
      this.canvas.width <= 0 ||
      this.canvas.height <= 0
    ) {
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    // Handle very small coordinate ranges
    let adjustedWidth = width;
    let adjustedHeight = height;

    // Use optimized canvas size if available, otherwise use coordinate-based calculation
    const effectiveCanvasWidth =
      this.optimalCanvasSize.width || this.canvas.width;
    const effectiveCanvasHeight =
      this.optimalCanvasSize.height || this.canvas.height;

    // If the coordinate range is very small, scale it up appropriately
    const minRange = Math.max(50, Math.min(200, maxDimension * 0.1)); // Dynamic minimum range
    if (width < minRange) {
      // console.log removed
      adjustedWidth = minRange;
    }
    if (height < minRange) {
      // console.log removed
      adjustedHeight = minRange;
    }

    const scaleX = (effectiveCanvasWidth - padding * 2) / adjustedWidth;
    const scaleY = (effectiveCanvasHeight - padding * 2) / adjustedHeight;

    console.log("Scale calculations:", {
      scaleX,
      scaleY,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      padding,
      width,
      height,
      adjustedWidth,
      adjustedHeight,
      scaleXCalculation: `${this.canvas.width} - ${
        padding * 2
      } / ${adjustedWidth} = ${scaleX}`,
      scaleYCalculation: `${this.canvas.height} - ${
        padding * 2
      } / ${adjustedHeight} = ${scaleY}`,
    });

    // Use the smaller scale to ensure points fit in both dimensions
    // This prevents over-stretching in one direction
    this.scale = Math.min(scaleX, scaleY);

    // Add a maximum scale limit to prevent extreme zooming
    const maxScale = 200; // Increased from 50 to 200 for better zooming
    if (this.scale > maxScale) {
      // console.log removed
      this.scale = maxScale;
    }

    // Add a minimum scale to ensure points are visible
    const minScale = 0.1;
    if (this.scale < minScale) {
      // console.log removed
      this.scale = minScale;
    }

    // Ensure scale is finite and reasonable
    if (!isFinite(this.scale) || this.scale <= 0) {
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      this.scale = 1;
    }

    // Calculate offset to center the points
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.offset.x = this.canvas.width / (2 * this.scale) - centerX;
    this.offset.y = this.canvas.height / (2 * this.scale) - centerY;

    console.log("Final scale and offset:", {
      scale: this.scale,
      offset: this.offset,
      centerX,
      centerY,
      canvasCenter: {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
      },
    });
    // console.log removed
  }

  private render(): void {
    if (this.isRendering) {
      // console.log removed
      return;
    }

    this.isRendering = true;
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    try {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // console.log removed

      this.ctx.save();
      this.ctx.scale(this.scale, this.scale);
      this.ctx.translate(this.offset.x, this.offset.y);
      // console.log removed

      // Draw grid
      this.drawGrid();
      // console.log removed

      // Draw curves
      this.drawCurves();
      // console.log removed

      // Draw points
      this.drawPoints();

      this.ctx.restore();

      // Draw selection rectangle in screen coordinates (no transform)
      if (
        this.isDragging &&
        this.selectedPoints.size === 0 &&
        this.selectionRect
      ) {
        this.drawSelectionRectangle();
        // console.log removed
      }

      // Draw curve being created
      if (this.isDrawingCurve && this.curvePoints.length > 0) {
        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(this.offset.x, this.offset.y);
        this.drawCurveCreation();
        this.ctx.restore();
        // console.log removed
      }

      // Enhanced point highlighting and measurement methods
      this.drawMeasurementLines();
    } catch (error) {
      console.error("Error in render:", error);
    } finally {
      // Add a small delay before allowing the next render
      setTimeout(() => {
        this.isRendering = false;
      }, 16); // ~60fps
    }

    // console.log removed
  }

  private drawGrid(): void {
    const gridSize = 50;
    const maxGridRange = 3000; // 30cm * 100x scale = 3000 units

    // Calculate grid bounds with 30cm limit
    const startX = Math.max(
      -maxGridRange,
      Math.floor(-this.offset.x / gridSize) * gridSize
    );
    const startY = Math.max(
      -maxGridRange,
      Math.floor(-this.offset.y / gridSize) * gridSize
    );
    const endX = Math.min(
      maxGridRange,
      startX + this.canvas.width / this.scale + gridSize
    );
    const endY = Math.min(
      maxGridRange,
      startY + this.canvas.height / this.scale + gridSize
    );

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    this.ctx.lineWidth = 1 / this.scale;

    // Draw vertical grid lines
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }

    // Draw boundary box at 30cm limits
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.beginPath();
    this.ctx.rect(
      -maxGridRange,
      -maxGridRange,
      maxGridRange * 2,
      maxGridRange * 2
    );
    this.ctx.stroke();

    // Draw center cross at origin
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.lineWidth = 1 / this.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(-maxGridRange, 0);
    this.ctx.lineTo(maxGridRange, 0);
    this.ctx.moveTo(0, -maxGridRange);
    this.ctx.lineTo(0, maxGridRange);
    this.ctx.stroke();

    // Draw origin point (0,0) with a small dot
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3 / this.scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw a border around the origin point
    this.ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
    this.ctx.lineWidth = 1 / this.scale;
    this.ctx.stroke();
  }

  private drawPoints(): void {
    if (this.points.length === 0) {
      return;
    }

    this.points.forEach((point, _) => {
      const isSelected = this.selectedPoints.has(point.id);
      const isHovered = this.hoveredPoint === point.id;
      const isLocked = this.isPointLocked(point.id);

      // Determine point color based on state and type
      let color: string;

      if (isLocked) {
        // Locked points are gray
        color = this.lockedPointColor;
      } else if (isSelected) {
        // Selected points are red
        color = this.selectedPointColor;
      } else if (isHovered) {
        // Hovered points are yellow
        color = this.hoveredPointColor;
      } else {
        // Normal points based on type
        switch (point.type) {
          case "body":
            color = "#ff0000";
            break;
          case "garment":
            // Use trial-specific color for garment points
            if (point.trial) {
              color = this.getTrialColor(point.trial);
            } else {
              color = "#00ff00";
            }
            break;
          case "landmark":
            color = "#00ffff";
            break;
          default:
            color = this.normalPointColor;
        }
      }

      this.ctx.fillStyle = color;

      // Draw the main point
      const fixedPointRadius = 0.5; // 1x1 pixel diameter (50% smaller)
      this.ctx.beginPath();
      this.ctx.arc(
        point.position.x,
        point.position.y,
        fixedPointRadius,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Draw border for selected points
      if (isSelected && !isLocked) {
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 3 / this.scale;
        this.ctx.stroke();
      }

      // Draw lock indicator for locked points
      if (isLocked) {
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 2 / this.scale;
        this.ctx.setLineDash([2 / this.scale, 2 / this.scale]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });

    // Draw landmark labels after points
    this.drawLandmarkLabels();
  }

  private drawLandmarkLabels(): void {
    // Check if labels should be shown
    if (!this.showLandmarkLabels) return;

    // Only draw labels for landmark points that have names
    const landmarkPoints = this.points.filter(
      (point) => point.type === "landmark" && point.metadata?.landmarkName
    );

    if (landmarkPoints.length === 0) return;

    // Set text style for labels
    this.ctx.font = `${Math.max(10, 12 / this.scale)}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "#00ffff"; // Cyan color for landmark labels
    this.ctx.strokeStyle = "#000000"; // Black outline
    this.ctx.lineWidth = Math.max(1, 2 / this.scale);

    landmarkPoints.forEach((point) => {
      const labelText = point.metadata?.landmarkName || "";
      if (!labelText) return;

      // Position label closer to the point (reduced offset from 8 to 4)
      const labelX = point.position.x + 4 / this.scale;
      const labelY = point.position.y - 4 / this.scale;

      // Draw text outline for better visibility
      this.ctx.strokeText(labelText, labelX, labelY);
      // Draw text fill
      this.ctx.fillText(labelText, labelX, labelY);
    });
  }

  private drawCurves(): void {
    this.curves.forEach((curve) => {
      this.ctx.strokeStyle = "#ffff00";
      this.ctx.lineWidth = 2 / this.scale;
      this.ctx.beginPath();

      if (curve.generatedPoints.length > 0) {
        this.ctx.moveTo(curve.generatedPoints[0].x, curve.generatedPoints[0].y);
        for (let i = 1; i < curve.generatedPoints.length; i++) {
          this.ctx.lineTo(
            curve.generatedPoints[i].x,
            curve.generatedPoints[i].y
          );
        }
      }

      this.ctx.stroke();
    });
  }

  private drawSelectionRectangle(): void {
    if (!this.selectionRect) return;

    // Draw selection rectangle with new styling
    // The selectionRect is already in screen coordinates, so no transformation needed
    this.ctx.strokeStyle = this.selectionRectBorderColor;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      this.selectionRect.x,
      this.selectionRect.y,
      this.selectionRect.width,
      this.selectionRect.height
    );
    this.ctx.setLineDash([]);

    // Draw semi-transparent fill
    this.ctx.fillStyle = this.selectionRectColor;
    this.ctx.fillRect(
      this.selectionRect.x,
      this.selectionRect.y,
      this.selectionRect.width,
      this.selectionRect.height
    );
  }

  private drawCurveCreation(): void {
    if (this.curvePoints.length < 2) return;

    this.ctx.strokeStyle = "#ffff00";
    this.ctx.lineWidth = 2 / this.scale;
    this.ctx.setLineDash([5 / this.scale, 5 / this.scale]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.curvePoints[0].x, this.curvePoints[0].y);

    for (let i = 1; i < this.curvePoints.length; i++) {
      this.ctx.lineTo(this.curvePoints[i].x, this.curvePoints[i].y);
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  private updateData(): void {
    if (!this.data || !this.onDataChange) return;

    // Update the data structure with the new points
    this.updateLevelData();
    this.onDataChange(this.data);
  }

  private updateLevelData(): void {
    if (!this.data) return;

    // Update body level
    const bodyLevel = this.data.body.levels.find(
      (l) => l.name === this.currentLevel
    );
    if (bodyLevel) {
      const bodyPoints = this.points.filter((p) => p.type === "body");
      const landmarkPoints = this.points.filter(
        (p) => p.type === "landmark" && !p.trial
      );

      // Save original unscaled coordinates back to data structure
      bodyLevel.intersectionPoints = bodyPoints.map((p) => {
        const originalPos = p.metadata?.originalPosition;
        if (originalPos) {
          // Use reverse transformation to get original coordinates
          return this.reverseTransformCoordinates(
            p.position.x,
            p.position.y,
            p.position.z
          );
        }
        return p.position;
      });

      bodyLevel.landmarks = landmarkPoints.map((p) => {
        const originalPos = p.metadata?.originalPosition;
        const landmarkName = p.metadata?.landmarkName;
        if (originalPos) {
          // Use reverse transformation to get original coordinates
          const reversed = this.reverseTransformCoordinates(
            p.position.x,
            p.position.y,
            p.position.z
          );
          return {
            point: reversed,
            name: landmarkName, // Preserve the landmark name
          };
        }
        return {
          point: p.position,
          name: landmarkName, // Preserve the landmark name
        };
      });
    }

    // Update garment level
    if (this.currentTrial) {
      const trail = this.data.trails.find(
        (t) => t.trailName === this.currentTrial
      );
      if (trail) {
        const trailLevel = trail.levels.find(
          (l) => l.name === this.currentLevel
        );
        if (trailLevel) {
          const garmentPoints = this.points.filter((p) => p.type === "garment");
          const garmentLandmarkPoints = this.points.filter(
            (p) => p.type === "landmark" && p.trial === this.currentTrial
          );

          trailLevel.intersectionPoints = garmentPoints.map((p) => {
            const originalPos = p.metadata?.originalPosition;
            if (originalPos) {
              // Use reverse transformation to get original coordinates
              return this.reverseTransformCoordinates(
                p.position.x,
                p.position.y,
                p.position.z
              );
            }
            return p.position;
          });

          // Update garment landmarks if they exist
          if (garmentLandmarkPoints.length > 0) {
            trailLevel.landmarks = garmentLandmarkPoints.map((p) => {
              const originalPos = p.metadata?.originalPosition;
              const landmarkName = p.metadata?.landmarkName;
              if (originalPos) {
                // Use reverse transformation to get original coordinates
                const reversed = this.reverseTransformCoordinates(
                  p.position.x,
                  p.position.y,
                  p.position.z
                );
                return {
                  point: reversed,
                  name: landmarkName, // Preserve the landmark name
                };
              }
              return {
                point: p.position,
                name: landmarkName, // Preserve the landmark name
              };
            });
          }
        }
      }
    }
  }

  private generatePointId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external control
  public createEquidistantPoints(curveId: string, spacing: number): Point3D[] {
    const curve = this.curves.find((c) => c.id === curveId);
    if (!curve) return [];

    const points: Point3D[] = [];
    const curvePoints = curve.generatedPoints;

    if (curvePoints.length < 2) return points;

    let currentDistance = 0;
    let currentIndex = 0;

    while (currentIndex < curvePoints.length - 1) {
      const p1 = curvePoints[currentIndex];
      const p2 = curvePoints[currentIndex + 1];

      const segmentLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

      if (currentDistance + segmentLength >= spacing) {
        const t = (spacing - currentDistance) / segmentLength;
        const x = p1.x + t * (p2.x - p1.x);
        const y = p1.y + t * (p2.y - p1.y);

        points.push({ x, y, z: 0 });
        currentDistance = 0;
      } else {
        currentDistance += segmentLength;
      }

      currentIndex++;
    }

    return points;
  }

  public divideCurveEqually(curveId: string, divisions: number): Point3D[] {
    const curve = this.curves.find((c) => c.id === curveId);
    if (!curve) return [];

    const points: Point3D[] = [];
    const curvePoints = curve.generatedPoints;

    if (curvePoints.length < 2) return points;

    const totalLength = this.calculateCurveLength(curvePoints);
    const segmentLength = totalLength / divisions;

    let currentDistance = 0;
    let currentIndex = 0;

    for (let i = 0; i < divisions; i++) {
      const targetDistance = i * segmentLength;

      while (
        currentIndex < curvePoints.length - 1 &&
        currentDistance < targetDistance
      ) {
        const p1 = curvePoints[currentIndex];
        const p2 = curvePoints[currentIndex + 1];
        const segmentLength = Math.sqrt(
          (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
        );

        if (currentDistance + segmentLength >= targetDistance) {
          const t = (targetDistance - currentDistance) / segmentLength;
          points.push({
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: 0,
          });
          break;
        }

        currentDistance += segmentLength;
        currentIndex++;
      }
    }

    return points;
  }

  private calculateCurveLength(points: Point2D[]): number {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      length += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }
    return length;
  }

  // private addTestPoint(): void {
  //     // Add a test point at a known location to verify rendering is working
  //     const testPoint: Point = {
  //         id: 'test_point',
  //         position: { x: 0, y: 0, z: 0 },
  //         type: 'landmark',
  //         level: this.currentLevel,
  //         trial: this.currentTrial,
  //         metadata: { originalIndex: -1 }
  //     };
  //
  //     this.points.unshift(testPoint); // Add to beginning of array
  //     // console.log removed
  // }

  private optimizeView(): void {
    // console.log removed

    if (this.points.length === 0) {
      // console.log removed
      return;
    }

    // Calculate coordinate ranges
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    this.points.forEach((point) => {
      minX = Math.min(minX, point.position.x);
      minY = Math.min(minY, point.position.y);
      maxX = Math.max(maxX, point.position.x);
      maxY = Math.max(maxY, point.position.y);
    });

    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const coordinateRange = Math.max(xRange, yRange);

    console.log("Optimization analysis:", {
      xRange,
      yRange,
      coordinateRange,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });

    // Determine optimal canvas size based on coordinate ranges
    const targetCanvasSize = Math.min(800, Math.max(400, coordinateRange * 2));
    const aspectRatio = xRange / yRange;

    let optimalWidth, optimalHeight;
    if (aspectRatio > 1) {
      // Wider than tall
      optimalWidth = targetCanvasSize;
      optimalHeight = targetCanvasSize / aspectRatio;
    } else {
      // Taller than wide
      optimalHeight = targetCanvasSize;
      optimalWidth = targetCanvasSize * aspectRatio;
    }

    // Ensure minimum sizes
    optimalWidth = Math.max(400, optimalWidth);
    optimalHeight = Math.max(300, optimalHeight);

    console.log("Optimal canvas size:", {
      width: optimalWidth,
      height: optimalHeight,
      aspectRatio,
    });

    // Adjust point sizes based on coordinate ranges - REDUCED SIGNIFICANTLY
    // const basePointSize = Math.max(1, Math.min(3, coordinateRange * 0.01)); // Reduced further for 2x2 pixel points
    // console.log removed

    // Store optimization data for use in drawing
    this.optimalCanvasSize = { width: optimalWidth, height: optimalHeight };

    // console.log removed
  }

  private zoomToPoints(): void {
    // console.log removed
    // console.log removed
    // console.log removed

    if (this.points.length === 0) {
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    // Log first few points to see their structure
    console.log(
      "First 3 points:",
      this.points.slice(0, 3).map((p) => ({
        id: p.id,
        position: p.position,
        type: p.type,
      }))
    );

    this.points.forEach((point, _index) => {
      if (
        isFinite(point.position.x) &&
        isFinite(point.position.y) &&
        isFinite(point.position.z)
      ) {
        minX = Math.min(minX, point.position.x);
        minY = Math.min(minY, point.position.y);
        maxX = Math.max(maxX, point.position.x);
        maxY = Math.max(maxY, point.position.y);
      } else {
        // Removed verbose invalid coordinates logging
      }
    });

    // Clamp bounds to 30cm limit
    const maxGridRange = 3000; // 30cm * 100x scale = 3000 units
    minX = Math.max(-maxGridRange, minX);
    minY = Math.max(-maxGridRange, minY);
    maxX = Math.min(maxGridRange, maxX);
    maxY = Math.min(maxGridRange, maxY);

    // console.log removed

    // Check if we have valid bounds
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 50;
    const maxDimension = Math.max(width, height);

    // console.log removed

    // Check if dimensions are valid
    if (
      width <= 0 ||
      height <= 0 ||
      this.canvas.width <= 0 ||
      this.canvas.height <= 0
    ) {
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    // Handle very small coordinate ranges
    let adjustedWidth = width;
    let adjustedHeight = height;

    // Use optimized canvas size if available, otherwise use coordinate-based calculation
    const effectiveCanvasWidth =
      this.optimalCanvasSize.width || this.canvas.width;
    const effectiveCanvasHeight =
      this.optimalCanvasSize.height || this.canvas.height;

    // If the coordinate range is very small, scale it up appropriately
    const minRange = Math.max(50, Math.min(200, maxDimension * 0.1)); // Dynamic minimum range
    if (width < minRange) {
      // console.log removed
      adjustedWidth = minRange;
    }
    if (height < minRange) {
      // console.log removed
      adjustedHeight = minRange;
    }

    const scaleX = (effectiveCanvasWidth - padding * 2) / adjustedWidth;
    const scaleY = (effectiveCanvasHeight - padding * 2) / adjustedHeight;

    console.log("Scale calculations:", {
      scaleX,
      scaleY,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      padding,
      width,
      height,
      adjustedWidth,
      adjustedHeight,
      scaleXCalculation: `${this.canvas.width} - ${
        padding * 2
      } / ${adjustedWidth} = ${scaleX}`,
      scaleYCalculation: `${this.canvas.height} - ${
        padding * 2
      } / ${adjustedHeight} = ${scaleY}`,
    });

    // Use the smaller scale to ensure points fit in both dimensions
    // This prevents over-stretching in one direction
    this.scale = Math.min(scaleX, scaleY);

    // Add a maximum scale limit to prevent extreme zooming
    const maxScale = 200; // Increased from 50 to 200 for better zooming
    if (this.scale > maxScale) {
      // console.log removed
      this.scale = maxScale;
    }

    // Add a minimum scale to ensure points are visible
    const minScale = 0.1;
    if (this.scale < minScale) {
      // console.log removed
      this.scale = minScale;
    }

    // Ensure scale is finite and reasonable
    if (!isFinite(this.scale) || this.scale <= 0) {
      // console.log removed
      // console.log removed
      // console.log removed
      // console.log removed
      this.scale = 1;
    }

    // Calculate offset to center the points
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.offset.x = this.canvas.width / (2 * this.scale) - centerX;
    this.offset.y = this.canvas.height / (2 * this.scale) - centerY;

    console.log("Final scale and offset:", {
      scale: this.scale,
      offset: this.offset,
      centerX,
      centerY,
      canvasCenter: {
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
      },
    });
    // console.log removed
  }

  // Public control methods for 2D editor
  public zoomIn(): void {
    console.log("Keyboard zoom in - Current state:", {
      scale: this.scale,
      offset: this.offset,
      canvasCenter: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
    });

    const zoomFactor = 1.2;
    // const oldScale = this.scale; // Removed unused variable

    // Use canvas center as zoom point
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;

    // Convert canvas center to world coordinates before zoom
    const centerWorldPos = this.screenToWorld({
      x: canvasCenterX,
      y: canvasCenterY,
    });

    // Apply zoom
    this.scale *= zoomFactor;
    this.scale = Math.min(200, this.scale); // Limit maximum zoom

    // Adjust offset so the canvas center stays at the same world coordinates
    this.offset.x = canvasCenterX / this.scale - centerWorldPos.x;
    this.offset.y = canvasCenterY / this.scale - centerWorldPos.y;

    console.log("Keyboard zoom in - New state:", {
      scale: this.scale,
      offset: this.offset,
      centerWorldPos: centerWorldPos,
    });

    this.render();
  }

  public zoomOut(): void {
    console.log("Keyboard zoom out - Current state:", {
      scale: this.scale,
      offset: this.offset,
      canvasCenter: { x: this.canvas.width / 2, y: this.canvas.height / 2 },
    });

    const zoomFactor = 0.8;
    // const oldScale = this.scale; // Removed unused variable

    // Use canvas center as zoom point
    const canvasCenterX = this.canvas.width / 2;
    const canvasCenterY = this.canvas.height / 2;

    // Convert canvas center to world coordinates before zoom
    const centerWorldPos = this.screenToWorld({
      x: canvasCenterX,
      y: canvasCenterY,
    });

    // Apply zoom
    this.scale *= zoomFactor;
    this.scale = Math.max(0.1, this.scale); // Limit minimum zoom

    // Adjust offset so the canvas center stays at the same world coordinates
    this.offset.x = canvasCenterX / this.scale - centerWorldPos.x;
    this.offset.y = canvasCenterY / this.scale - centerWorldPos.y;

    console.log("Keyboard zoom out - New state:", {
      scale: this.scale,
      offset: this.offset,
      centerWorldPos: centerWorldPos,
    });

    this.render();
  }

  public resetView(): void {
    // console.log removed
    this.scale = 1;
    this.offset = { x: 0, y: 0 };
    // console.log removed
    this.render();
    // console.log removed
  }

  public centerOnOrigin(): void {
    console.log("Centering on origin - Current state:", {
      scale: this.scale,
      offset: this.offset,
      canvasSize: { width: this.canvas.width, height: this.canvas.height },
    });

    // Keep current scale, just center on (0,0)
    this.offset.x = this.canvas.width / (2 * this.scale);
    this.offset.y = this.canvas.height / (2 * this.scale);

    console.log("Centering on origin - New state:", {
      scale: this.scale,
      offset: this.offset,
      calculation: {
        offsetX: `${this.canvas.width} / (2 * ${this.scale}) = ${this.offset.x}`,
        offsetY: `${this.canvas.height} / (2 * ${this.scale}) = ${this.offset.y}`,
      },
    });

    this.render();
  }

  public viewAllPoints(): void {
    // console.log removed
    if (this.points.length === 0) {
      // console.log removed
      return;
    }

    // Calculate actual bounds of all points (no artificial clamping)
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    this.points.forEach((point) => {
      if (isFinite(point.position.x) && isFinite(point.position.y)) {
        minX = Math.min(minX, point.position.x);
        minY = Math.min(minY, point.position.y);
        maxX = Math.max(maxX, point.position.x);
        maxY = Math.max(maxY, point.position.y);
      } else {
        // Removed verbose invalid coordinates logging
      }
    });

    // console.log removed

    // Check if we have valid bounds
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      // console.log removed
      this.scale = 1;
      this.offset = { x: 0, y: 0 };
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 30; // Reduced padding for better visibility

    // console.log removed

    // Remove minimum range logic for width/height
    let adjustedWidth = width;
    let adjustedHeight = height;
    // No artificial scaling up

    // Calculate scale to fit all points with padding
    const scaleX = (this.canvas.width - padding * 2) / adjustedWidth;
    const scaleY = (this.canvas.height - padding * 2) / adjustedHeight;

    console.log("Scale calculations:", {
      scaleX,
      scaleY,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      padding,
      width,
      height,
      adjustedWidth,
      adjustedHeight,
    });

    // Use the smaller scale to ensure all points fit in both dimensions
    this.scale = Math.min(scaleX, scaleY);

    // Clamp scale to reasonable range
    this.scale = Math.max(0.1, Math.min(200, this.scale));

    // Calculate the center of all points
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate offset to center the points in the canvas
    this.offset.x = this.canvas.width / (2 * this.scale) - centerX;
    this.offset.y = this.canvas.height / (2 * this.scale) - centerY;

    console.log("View all points applied:", {
      scale: this.scale,
      offset: this.offset,
      centerX,
      centerY,
      actualBounds: { minX, minY, maxX, maxY },
      adjustedBounds: {
        minX: centerX - adjustedWidth / 2,
        maxX: centerX + adjustedWidth / 2,
        minY: centerY - adjustedHeight / 2,
        maxY: centerY + adjustedHeight / 2,
      },
    });

    this.render();
    // console.log removed
  }

  // Public method to manually trigger viewAllPoints with additional checks
  public forceViewAllPoints(): void {
    // console.log removed
    console.log("Current state:", {
      pointsCount: this.points.length,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      isVisible: this.canvas.style.display !== "none",
      scale: this.scale,
      offset: this.offset,
    });

    // Ensure canvas is properly sized
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      // console.log removed
      this.resize();
    }

    // Call the regular viewAllPoints method
    this.viewAllPoints();

    // Force an additional render to ensure changes are visible
    this.render();

    // console.log removed
  }

  // Comprehensive test method for viewAllPoints functionality
  public testViewAllPoints(): void {
    // console.log removed

    // Test 1: Check if canvas is properly initialized
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    // Test 2: Check if points are loaded
    // console.log removed
    // console.log removed
    if (this.points.length > 0) {
      // console.log removed
      // console.log removed
    }

    // Test 3: Check current view state
    // console.log removed
    // console.log removed
    // console.log removed

    // Test 4: Force resize if needed
    // console.log removed
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      // console.log removed
      this.resize();
      // console.log removed
    }

    // Test 5: Call viewAllPoints
    // console.log removed
    this.viewAllPoints();

    // Test 6: Force render
    // console.log removed
    this.render();

    // Test 7: Final state check
    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    // console.log removed
  }

  // Pan methods for keyboard navigation
  public panUp(): void {
    this.offset.y -= 50 / this.scale;
    this.render();
  }

  public panDown(): void {
    this.offset.y += 50 / this.scale;
    this.render();
  }

  public panLeft(): void {
    this.offset.x -= 50 / this.scale;
    this.render();
  }

  public panRight(): void {
    this.offset.x += 50 / this.scale;
    this.render();
  }

  private updateCursorCoordinates(
    mousePos: Point2D,
    measurementText?: string
  ): void {
    const coordinatesElement = document.getElementById("cursor-coordinates");
    if (coordinatesElement) {
      // mousePos is already in world coordinates (after screenToWorld transformation)
      // Format coordinates to 3 decimal places
      const x = mousePos.x.toFixed(3);
      const y = mousePos.y.toFixed(3);
      const scale = this.scale.toFixed(2);
      const pointCount = this.points.length;

      // Calculate distance from origin
      const distanceFromOrigin = Math.sqrt(
        mousePos.x * mousePos.x + mousePos.y * mousePos.y
      );
      const distanceText = distanceFromOrigin.toFixed(3);

      // Show original coordinates (scaled down by coordinateScale)
      const originalX = (mousePos.x / this.coordinateScale).toFixed(3);
      const originalY = (mousePos.y / this.coordinateScale).toFixed(3);

      // Calculate current view bounds
      const viewLeft = -this.offset.x * this.scale;
      const viewRight =
        this.canvas.width / this.scale - this.offset.x * this.scale;
      const viewTop = -this.offset.y * this.scale;
      const viewBottom =
        this.canvas.height / this.scale - this.offset.y * this.scale;

      // Add debugging info for coordinate transformation
      const isNearOrigin =
        Math.abs(mousePos.x) < 0.1 && Math.abs(mousePos.y) < 0.1;
      const debugInfo = isNearOrigin
        ? ` [NEAR ORIGIN - Scale: ${
            this.scale
          }, Offset: (${this.offset.x.toFixed(2)}, ${this.offset.y.toFixed(
            2
          )})]`
        : "";

      let displayText = `Cursor: (${x}, ${y}) [Original: (${originalX}, ${originalY})] | Distance from (0,0): ${distanceText} | Scale: ${scale}x | Coord Scale: ${
        this.coordinateScale
      }x | View: X-Z Plane | Points: ${pointCount} | View Bounds: [${viewLeft.toFixed(
        0
      )}, ${viewTop.toFixed(0)}] to [${viewRight.toFixed(
        0
      )}, ${viewBottom.toFixed(0)}] | Level: ${this.currentLevel}${
        this.currentTrial ? ` | Trial: ${this.currentTrial}` : ""
      }${debugInfo}`;

      // Add measurement info if provided
      if (measurementText) {
        displayText += ` | ${measurementText}`;
      }

      coordinatesElement.textContent = displayText;

      // Debug logging when near origin
      if (isNearOrigin) {
        console.log("Cursor near origin:", {
          mousePos: mousePos,
          scale: this.scale,
          offset: this.offset,
          coordinateScale: this.coordinateScale,
          originalCoords: { x: originalX, y: originalY },
        });
      }
    }
  }

  public toggleCoordinateScaling(): void {
    // console.log removed
    this.coordinateScale = this.coordinateScale === 100 ? 1 : 100;
    // console.log removed

    // Reload points with new scaling
    this.loadPointsForLevel();
    this.optimizeView();
    this.zoomToPoints();
    this.render();
    // console.log removed
  }

  public logPointBounds(): void {
    // console.log removed
    if (this.points.length === 0) {
      // console.log removed
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    this.points.forEach((point, _index) => {
      if (
        isFinite(point.position.x) &&
        isFinite(point.position.y) &&
        isFinite(point.position.z)
      ) {
        minX = Math.min(minX, point.position.x);
        minY = Math.min(minY, point.position.y);
        minZ = Math.min(minZ, point.position.z);
        maxX = Math.max(maxX, point.position.x);
        maxY = Math.max(maxY, point.position.y);
        maxZ = Math.max(maxZ, point.position.z);
      }
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    console.log("Point Analysis:", {
      totalPoints: this.points.length,
      bounds: {
        x: { min: minX, max: maxX, range: maxX - minX, center: centerX },
        y: { min: minY, max: maxY, range: maxY - minY, center: centerY },
        z: { min: minZ, max: maxZ, range: maxZ - minZ, center: centerZ },
      },
      center: { x: centerX, y: centerY, z: centerZ },
      maxRange: Math.max(maxX - minX, maxY - minY, maxZ - minZ),
      viewMode: "X-Z Plane",
      coordinateScale: this.coordinateScale,
    });
    // console.log removed
  }

  // Helper method to transform 3D coordinates to 2D display coordinates (X-Z plane)
  private transformCoordinates(
    x: number,
    y: number,
    z: number
  ): { x: number; y: number; z: number } {
    const scaledX = x * this.coordinateScale;
    const scaledY = z * this.coordinateScale; // Use Z as Y coordinate for display
    const scaledZ = y * this.coordinateScale; // Use Y as Z coordinate (depth)

    // X-Z plane view: X and Z coordinates displayed on 2D canvas
    return { x: scaledX, y: scaledY, z: scaledZ };
  }

  // Helper method to reverse transform coordinates back to original space
  private reverseTransformCoordinates(
    x: number,
    y: number,
    z: number
  ): { x: number; y: number; z: number } {
    // Reverse the scaling and coordinate mapping for X-Z plane
    return {
      x: x / this.coordinateScale, // X stays X
      y: z / this.coordinateScale, // Z becomes Y (depth)
      z: y / this.coordinateScale, // Y becomes Z (display Y)
    };
  }

  // Rectangle selection methods
  public startRectangleSelection(): void {
    console.log("Starting Rectangle Selection Mode:", {
      previousMode: {
        isSelectionMode: this.isSelectionMode,
        isAddingPoints: this.isAddingPoints,
        isDeletingPoints: this.isDeletingPoints,
      },
      currentSelectionCount: this.selectedPoints.size,
    });

    this.isSelectionMode = true;
    this.selectedPoints.clear();
    console.log("Rectangle Selection Mode Enabled");
  }

  public deleteSelectedPoints(): void {
    console.log("Deleting Selected Points:", {
      totalSelected: this.selectedPoints.size,
      selectedPointIds: Array.from(this.selectedPoints),
      lockedPoints: Array.from(this.selectedPoints).filter((id) =>
        this.isPointLocked(id)
      ),
      unlockedPoints: Array.from(this.selectedPoints).filter(
        (id) => !this.isPointLocked(id)
      ),
    });

    const pointsToDelete = this.getSelectedPoints().filter(
      (point) => !this.isPointLocked(point.id)
    );

    console.log(
      "Points to be deleted:",
      pointsToDelete.map((p) => ({
        id: p.id,
        type: p.type,
        position: p.position,
      }))
    );

    pointsToDelete.forEach((point) => {
      console.log("Deleting point:", point.id);
      this.points = this.points.filter((p) => p.id !== point.id);
      this.selectedPoints.delete(point.id);
    });

    this.updateData();
    this.render();

    console.log("Deletion complete. Remaining points:", this.points.length);
  }

  // Get color for a trial, creating a new one if it doesn't exist
  private getTrialColor(trialName: string): string {
    let color = this.trialColorMap.get(trialName);
    if (!color) {
      // Assign new color if this trial hasn't been seen before
      const colorIndex = this.trialColorMap.size;
      color = this.garmentColors[colorIndex % this.garmentColors.length];
      this.trialColorMap.set(trialName, color);
      // console.log removed
    }
    return color;
  }

  // Sync trial color mapping from 3D viewer
  public syncTrialColors(trialColorMap: Map<string, THREE.Color>): void {
    // console.log removed
    this.trialColorMap.clear();

    trialColorMap.forEach((color, trial) => {
      this.trialColorMap.set(trial, `#${color.getHexString()}`);
    });

    // console.log removed
  }

  // Point Locking Methods
  public lockPointType(pointType: string): void {
    this.lockedPointTypes.add(pointType);
    this.updateLockedPoints();
    this.render();
  }

  public unlockPointType(pointType: string): void {
    this.lockedPointTypes.delete(pointType);
    this.updateLockedPoints();
    this.render();
  }

  public isPointTypeLocked(pointType: string): boolean {
    return this.lockedPointTypes.has(pointType);
  }

  public lockPoint(pointId: string): void {
    this.lockedPoints.add(pointId);
    this.render();
  }

  public unlockPoint(pointId: string): void {
    this.lockedPoints.delete(pointId);
    this.render();
  }

  public isPointLocked(pointId: string): boolean {
    return this.lockedPoints.has(pointId);
  }

  private updateLockedPoints(): void {
    this.lockedPoints.clear();
    this.points.forEach((point) => {
      if (this.lockedPointTypes.has(point.type)) {
        this.lockedPoints.add(point.id);
      }
    });
  }

  // Selection Mode Methods
  public setSelectionMode(enabled: boolean): void {
    this.isSelectionMode = enabled;
    this.isAddingPoints = false;
    this.isDeletingPoints = false;
    this.updateCursor();
  }

  public setAddPointMode(enabled: boolean): void {
    this.isAddingPoints = enabled;
    this.isSelectionMode = false;
    this.isDeletingPoints = false;
    this.updateCursor();
  }

  public setDeletePointMode(enabled: boolean): void {
    this.isDeletingPoints = enabled;
    this.isSelectionMode = false;
    this.isAddingPoints = false;
    this.updateCursor();
  }

  private updateCursor(): void {
    if (this.isAddingPoints) {
      this.canvas.style.cursor = "crosshair";
    } else if (this.isDeletingPoints) {
      this.canvas.style.cursor = "not-allowed";
    } else if (this.isSelectionMode) {
      this.canvas.style.cursor = "crosshair";
    } else {
      this.setSmallCursor();
    }
  }

  // Selection Management Methods
  public selectPointsInRectangle(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): void {
    const selectedPoints = new Set<string>();

    this.points.forEach((point) => {
      if (this.isPointLocked(point.id)) {
        return; // Skip locked points
      }

      const screenPos = this.worldToScreen({
        x: point.position.x,
        y: point.position.y,
      });
      const inRect = this.isPointInRectangle(screenPos, rect);

      if (inRect) {
        selectedPoints.add(point.id);
      }
    });

    this.setSelection(selectedPoints);
  }

  private isPointInRectangle(
    point: Point2D,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  public setSelection(selectedIds: Set<string>): void {
    console.log("Setting Selection:", {
      previousSelection: Array.from(this.selectedPoints),
      newSelection: Array.from(selectedIds),
      selectionChanged:
        this.selectedPoints.size !== selectedIds.size ||
        !Array.from(this.selectedPoints).every((id) => selectedIds.has(id)),
    });

    this.selectedPoints.clear();
    selectedIds.forEach((id) => this.selectedPoints.add(id));

    // Update coordinate panel with new selection
    this.updateCoordinatePanel();

    // Update measurement info
    this.updateMeasurementInfo();

    this.render();
  }

  public addToSelection(pointId: string): void {
    console.log("Adding to Selection:", {
      pointId: pointId,
      wasAlreadySelected: this.selectedPoints.has(pointId),
      isLocked: this.isPointLocked(pointId),
      currentSelectionCount: this.selectedPoints.size,
    });

    if (!this.isPointLocked(pointId)) {
      this.selectedPoints.add(pointId);
      this.updateCoordinatePanel();
      this.render();
    }
  }

  public removeFromSelection(pointId: string): void {
    console.log("Removing from Selection:", {
      pointId: pointId,
      wasSelected: this.selectedPoints.has(pointId),
      currentSelectionCount: this.selectedPoints.size,
    });

    this.selectedPoints.delete(pointId);
    this.updateCoordinatePanel();
    this.render();
  }

  public clearSelection(): void {
    console.log("Clearing Selection:", {
      previousSelectionCount: this.selectedPoints.size,
      previousSelection: Array.from(this.selectedPoints),
    });

    if (this.selectedPoints.size > 0) {
      this.saveSelectionToHistory();
    }
    this.selectedPoints.clear();
    this.selectionRect = null;
    this.updateCoordinatePanel();
    this.updateMeasurementInfo();
    this.render();
  }

  public getSelectedPoints(): Point[] {
    return this.points.filter((point) => this.selectedPoints.has(point.id));
  }

  // Selection History Methods
  private saveSelectionToHistory(): void {
    // Remove any history after current index
    this.selectionHistory = this.selectionHistory.slice(
      0,
      this.currentSelectionIndex + 1
    );

    // Add current selection
    this.selectionHistory.push(new Set(this.selectedPoints));
    this.currentSelectionIndex++;

    // Limit history size
    if (this.selectionHistory.length > 10) {
      this.selectionHistory.shift();
      this.currentSelectionIndex--;
    }
  }

  public undoSelection(): void {
    if (this.currentSelectionIndex > 0) {
      this.currentSelectionIndex--;
      this.selectedPoints = new Set(
        this.selectionHistory[this.currentSelectionIndex]
      );
      this.render();
    }
  }

  public redoSelection(): void {
    if (this.currentSelectionIndex < this.selectionHistory.length - 1) {
      this.currentSelectionIndex++;
      this.selectedPoints = new Set(
        this.selectionHistory[this.currentSelectionIndex]
      );
      this.render();
    }
  }

  // Coordinate transformation helpers
  private worldToScreen(worldPos: Point2D): Point2D {
    return {
      x: worldPos.x * this.scale + this.offset.x,
      y: worldPos.y * this.scale + this.offset.y,
    };
  }

  private screenToWorld(screenPos: Point2D): Point2D {
    return {
      x: (screenPos.x - this.offset.x) / this.scale,
      y: (screenPos.y - this.offset.y) / this.scale,
    };
  }

  // Debug method to show coordinate system state
  public debugCoordinateSystem(): void {
    console.log("=== Coordinate System Debug ===");
    console.log("Canvas:", {
      width: this.canvas.width,
      height: this.canvas.height,
      rect: this.canvas.getBoundingClientRect(),
    });
    console.log("View:", {
      scale: this.scale,
      offset: this.offset,
      coordinateScale: this.coordinateScale,
    });
    console.log("Transformation Examples:");

    // Test world to screen transformation
    const testWorldPos = { x: 0, y: 0 };
    const testScreenPos = this.worldToScreen(testWorldPos);
    console.log("World (0,0) -> Screen:", testScreenPos);

    // Test screen to world transformation
    const testScreenPos2 = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
    };
    const testWorldPos2 = this.screenToWorld(testScreenPos2);
    console.log("Screen (center) -> World:", testWorldPos2);

    // Test with current offset
    const offsetScreenPos = this.worldToScreen({
      x: -this.offset.x,
      y: -this.offset.y,
    });
    console.log("World (-offset) -> Screen:", offsetScreenPos);

    console.log("=== End Debug ===");
  }

  // Create coordinate input panel
  private createCoordinatePanel(): void {
    // Remove existing panel if it exists
    if (this.coordinatePanel) {
      this.coordinatePanel.remove();
    }

    // Create panel container
    this.coordinatePanel = document.createElement("div");
    this.coordinatePanel.id = "coordinate-panel";
    this.coordinatePanel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 15px;
            color: white;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            z-index: 10000;
            min-width: 280px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            display: none;
        `;

    // Create title
    const title = document.createElement("div");
    title.textContent = "📐 Coordinate Editor";
    title.style.cssText = `
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            color: #00ff00;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 5px;
        `;
    this.coordinatePanel.appendChild(title);

    // Create coordinate inputs
    const createInputGroup = (label: string, axis: "x" | "y" | "z") => {
      const group = document.createElement("div");
      group.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                gap: 8px;
            `;

      const labelElement = document.createElement("label");
      labelElement.textContent = `${label}:`;
      labelElement.style.cssText = `
                min-width: 20px;
                color: #00ff00;
                font-weight: bold;
            `;

      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.001";
      input.style.cssText = `
                flex: 1;
                background: rgba(0, 0, 0, 0.7);
                border: 1px solid #00ff00;
                border-radius: 4px;
                color: white;
                padding: 4px 8px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            `;

      // Add event listeners
      input.addEventListener("input", () => this.onCoordinateInputChange(axis));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.applyCoordinateChanges();
        }
      });

      group.appendChild(labelElement);
      group.appendChild(input);
      this.coordinatePanel!.appendChild(group);

      this.coordinateInputs[axis] = input;
    };

    createInputGroup("X", "x");
    createInputGroup("Y", "y");
    createInputGroup("Z", "z");

    // Create action buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-top: 10px;
        `;

    const applyButton = document.createElement("button");
    applyButton.textContent = "Apply";
    applyButton.style.cssText = `
            flex: 1;
            background: #00ff00;
            color: black;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-weight: bold;
            cursor: pointer;
        `;
    applyButton.addEventListener("click", () => this.applyCoordinateChanges());

    const resetButton = document.createElement("button");
    resetButton.textContent = "Reset";
    resetButton.style.cssText = `
            flex: 1;
            background: #ff6b6b;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-weight: bold;
            cursor: pointer;
        `;
    resetButton.addEventListener("click", () => this.resetCoordinateInputs());

    buttonContainer.appendChild(applyButton);
    buttonContainer.appendChild(resetButton);
    this.coordinatePanel.appendChild(buttonContainer);

    // Create selection info
    const selectionInfo = document.createElement("div");
    selectionInfo.id = "selection-info";
    selectionInfo.style.cssText = `
            margin-top: 10px;
            padding: 8px;
            background: rgba(0, 255, 0, 0.1);
            border-radius: 4px;
            font-size: 11px;
            text-align: center;
        `;
    this.coordinatePanel.appendChild(selectionInfo);

    // Add to document
    document.body.appendChild(this.coordinatePanel);
  }

  // Handle coordinate input changes
  private onCoordinateInputChange(axis: "x" | "y" | "z"): void {
    // This method can be used for real-time validation or preview
    console.log(
      `Coordinate ${axis} changed to:`,
      this.coordinateInputs[axis]?.value
    );
  }

  // Apply coordinate changes to selected points
  private applyCoordinateChanges(): void {
    const selectedPoints = this.getSelectedPoints();
    if (selectedPoints.length === 0) {
      console.log("No points selected for coordinate update");
      return;
    }

    const xValue = parseFloat(this.coordinateInputs.x?.value || "0");
    const yValue = parseFloat(this.coordinateInputs.y?.value || "0");
    const zValue = parseFloat(this.coordinateInputs.z?.value || "0");

    if (isNaN(xValue) || isNaN(yValue) || isNaN(zValue)) {
      console.log("Invalid coordinate values");
      return;
    }

    console.log("Applying coordinates to selected points:", {
      x: xValue,
      y: yValue,
      z: zValue,
      pointCount: selectedPoints.length,
    });

    // Update all selected points with new coordinates
    selectedPoints.forEach((point) => {
      if (!this.isPointLocked(point.id)) {
        // Transform the coordinates back to the scaled coordinate system
        const transformedCoords = this.transformCoordinates(
          xValue,
          yValue,
          zValue
        );
        point.position.x = transformedCoords.x;
        point.position.y = transformedCoords.y;
        point.position.z = transformedCoords.z;
      }
    });

    // Update the data and render
    this.updateData();
    this.render();
    this.updateCoordinatePanel();
  }

  // Reset coordinate inputs to current selection
  private resetCoordinateInputs(): void {
    this.updateCoordinatePanel();
  }

  // Update coordinate panel with current selection
  private updateCoordinatePanel(): void {
    if (!this.coordinatePanel || this.isUpdatingFromSelection) return;

    const selectedPoints = this.getSelectedPoints();

    if (selectedPoints.length === 0) {
      this.coordinatePanel.style.display = "none";
      return;
    }

    this.coordinatePanel.style.display = "block";
    this.isUpdatingFromSelection = true;

    if (selectedPoints.length === 1) {
      // Single point selected - show exact coordinates
      const point = selectedPoints[0];
      const originalCoords = this.reverseTransformCoordinates(
        point.position.x,
        point.position.y,
        point.position.z
      );

      if (this.coordinateInputs.x)
        this.coordinateInputs.x.value = originalCoords.x.toFixed(3);
      if (this.coordinateInputs.y)
        this.coordinateInputs.y.value = originalCoords.y.toFixed(3);
      if (this.coordinateInputs.z)
        this.coordinateInputs.z.value = originalCoords.z.toFixed(3);

      // Update selection info
      const selectionInfo = document.getElementById("selection-info");
      if (selectionInfo) {
        selectionInfo.textContent = `Selected: ${point.type} point (${point.id})`;
      }
    } else {
      // Multiple points selected - show average coordinates
      let avgX = 0,
        avgY = 0,
        avgZ = 0;
      selectedPoints.forEach((point) => {
        const originalCoords = this.reverseTransformCoordinates(
          point.position.x,
          point.position.y,
          point.position.z
        );
        avgX += originalCoords.x;
        avgY += originalCoords.y;
        avgZ += originalCoords.z;
      });

      avgX /= selectedPoints.length;
      avgY /= selectedPoints.length;
      avgZ /= selectedPoints.length;

      if (this.coordinateInputs.x)
        this.coordinateInputs.x.value = avgX.toFixed(3);
      if (this.coordinateInputs.y)
        this.coordinateInputs.y.value = avgY.toFixed(3);
      if (this.coordinateInputs.z)
        this.coordinateInputs.z.value = avgZ.toFixed(3);

      // Update selection info
      const selectionInfo = document.getElementById("selection-info");
      if (selectionInfo) {
        selectionInfo.textContent = `Selected: ${selectedPoints.length} points (Average coordinates)`;
      }
    }

    this.isUpdatingFromSelection = false;
  }

  // Show/hide coordinate panel
  public toggleCoordinatePanel(): void {
    if (!this.coordinatePanel) {
      this.createCoordinatePanel();
    }

    if (this.coordinatePanel && this.coordinatePanel.style.display === "none") {
      this.coordinatePanel.style.display = "block";
      this.updateCoordinatePanel();
    } else if (this.coordinatePanel) {
      this.coordinatePanel.style.display = "none";
    }
  }

  // Test coordinate panel functionality
  public testCoordinatePanel(): void {
    console.log("Testing coordinate panel...");

    // Create panel if it doesn't exist
    if (!this.coordinatePanel) {
      this.createCoordinatePanel();
    }

    // Show panel
    this.coordinatePanel!.style.display = "block";

    // Select first point if available
    if (this.points.length > 0) {
      this.setSelection(new Set([this.points[0].id]));
      console.log("Selected first point for testing");
    } else {
      console.log("No points available for testing");
    }

    console.log("Coordinate panel test complete");
  }

  public toggleLandmarkLabels(): void {
    this.showLandmarkLabels = !this.showLandmarkLabels;
    this.render();
    console.log(
      `Landmark labels ${this.showLandmarkLabels ? "enabled" : "disabled"}`
    );
  }

  public setLandmarkLabelsVisible(visible: boolean): void {
    this.showLandmarkLabels = visible;
    this.render();
    console.log(`Landmark labels ${visible ? "enabled" : "disabled"}`);
  }

  public areLandmarkLabelsVisible(): boolean {
    return this.showLandmarkLabels;
  }

  // Enhanced point highlighting and measurement methods
  private drawMeasurementLines(): void {
    if (!this.showMeasurements || this.selectedPoints.size < 2) return;

    const selectedPointsArray = this.getSelectedPoints();

    // Clear previous measurements
    this.measurementLines = [];

    // Draw lines between all selected points
    for (let i = 0; i < selectedPointsArray.length; i++) {
      for (let j = i + 1; j < selectedPointsArray.length; j++) {
        const point1 = selectedPointsArray[i];
        const point2 = selectedPointsArray[j];

        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(point2.position.x - point1.position.x, 2) +
            Math.pow(point2.position.y - point1.position.y, 2)
        );

        // Convert to screen coordinates
        const screen1 = this.worldToScreen({
          x: point1.position.x,
          y: point1.position.y,
        });
        const screen2 = this.worldToScreen({
          x: point2.position.x,
          y: point2.position.y,
        });

        // Create measurement line
        const line = new Path2D();
        line.moveTo(screen1.x, screen1.y);
        line.lineTo(screen2.x, screen2.y);

        this.measurementLines.push({
          line,
          distance,
          start: screen1,
          end: screen2,
        });
      }
    }

    // Draw the measurement lines
    this.ctx.save();
    this.ctx.strokeStyle = "#00ff00";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);

    this.measurementLines.forEach((measurement) => {
      this.ctx.stroke(measurement.line);
    });

    this.ctx.setLineDash([]);
    this.ctx.restore();

    // Draw distance labels
    this.drawMeasurementLabels();
  }

  private drawMeasurementLabels(): void {
    this.ctx.save();
    this.ctx.font = `${Math.max(10, 12 / this.scale)}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "#00ff00";
    this.ctx.strokeStyle = "#000000";
    this.ctx.lineWidth = Math.max(1, 2 / this.scale);

    this.measurementLines.forEach((measurement) => {
      // Calculate midpoint
      const midX = (measurement.start.x + measurement.end.x) / 2;
      const midY = (measurement.end.y + measurement.start.y) / 2;

      // Convert distance to original scale
      const originalDistance = measurement.distance / this.coordinateScale;
      const text = `${originalDistance.toFixed(3)}m`;

      // Draw text outline and fill
      this.ctx.strokeText(text, midX, midY);
      this.ctx.fillText(text, midX, midY);
    });

    this.ctx.restore();
  }

  private updateMeasurementInfo(): void {
    if (this.selectedPoints.size < 2) {
      this.updateCursorCoordinates({ x: 0, y: 0 }); // This will clear measurement info
      return;
    }

    const selectedPointsArray = this.getSelectedPoints();
    let totalDistance = 0;
    let minDistance = Infinity;
    let maxDistance = 0;

    // Calculate distances between all selected points
    for (let i = 0; i < selectedPointsArray.length; i++) {
      for (let j = i + 1; j < selectedPointsArray.length; j++) {
        const point1 = selectedPointsArray[i];
        const point2 = selectedPointsArray[j];

        const distance = Math.sqrt(
          Math.pow(point2.position.x - point1.position.x, 2) +
            Math.pow(point2.position.y - point1.position.y, 2)
        );

        totalDistance += distance;
        minDistance = Math.min(minDistance, distance);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    const avgDistance =
      totalDistance /
      ((selectedPointsArray.length * (selectedPointsArray.length - 1)) / 2);

    // Convert to original scale
    const originalAvg = avgDistance / this.coordinateScale;
    const originalMin = minDistance / this.coordinateScale;
    const originalMax = maxDistance / this.coordinateScale;
    const originalTotal = totalDistance / this.coordinateScale;

    const measurementText = `Selected: ${
      selectedPointsArray.length
    } points | Avg: ${originalAvg.toFixed(3)}m | Min: ${originalMin.toFixed(
      3
    )}m | Max: ${originalMax.toFixed(3)}m | Total: ${originalTotal.toFixed(
      3
    )}m`;

    // Update the cursor coordinates display with measurement info
    this.updateCursorCoordinates({ x: 0, y: 0 }, measurementText);
  }

  public toggleMeasurements(): void {
    this.showMeasurements = !this.showMeasurements;
    this.render();
    console.log(
      `Measurements ${this.showMeasurements ? "enabled" : "disabled"}`
    );
  }
}
