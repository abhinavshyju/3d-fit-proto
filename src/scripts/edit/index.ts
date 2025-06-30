import { JSONViewer } from "./JSONViewer";
import { UIManager } from "./UIManager";
import type { JSONData, Landmark, LevelData, Trail } from "./types";
import * as THREE from "three";

class App {
  private viewer: JSONViewer;
  private uiManager: UIManager;
  private jsonData: JSONData | null = null;

  constructor() {
    this.viewer = new JSONViewer();
    this.uiManager = new UIManager();
    this.uiManager.add2DEditorControls();

    // Check if 2D edit button exists
    const edit2DBtn = document.getElementById(
      "2d-edit-btn"
    ) as HTMLButtonElement;
    console.log("=== APP INITIALIZATION ===");
    console.log("2D Edit button found:", !!edit2DBtn);
    if (edit2DBtn) {
      console.log("2D Edit button text:", edit2DBtn.textContent);
      console.log("2D Edit button disabled:", edit2DBtn.disabled);
    }

    this.initializeEventListeners();
    this.loadDefaultJSON();
  }

  private initializeEventListeners(): void {
    // File input
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    fileInput.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.loadJSONFile(target.files[0]);
      }
    });

    // Level filter
    const levelFilter = document.getElementById(
      "level-filter"
    ) as HTMLSelectElement;
    levelFilter.addEventListener("change", () => {
      this.updateFilters();
    });

    // Trial filter
    const trialFilter = document.getElementById(
      "garment-filter"
    ) as HTMLSelectElement;
    trialFilter.addEventListener("change", () => {
      this.updateFilters();
    });

    // Point type toggles
    const showBodyPoints = document.getElementById(
      "show-body-points"
    ) as HTMLInputElement;
    const showGarmentPoints = document.getElementById(
      "show-garment-points"
    ) as HTMLInputElement;
    const showLandmarkPoints = document.getElementById(
      "show-landmark-points"
    ) as HTMLInputElement;
    const showGarmentLandmarkPoints = document.getElementById(
      "show-garment-landmark-points"
    ) as HTMLInputElement;

    [
      showBodyPoints,
      showGarmentPoints,
      showLandmarkPoints,
      showGarmentLandmarkPoints,
    ].forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateFilters();
      });
    });

    // Action buttons
    const measureBtn = document.getElementById(
      "measure-btn"
    ) as HTMLButtonElement;
    const selectBtn = document.getElementById(
      "select-btn"
    ) as HTMLButtonElement;
    const addPointBtn = document.getElementById(
      "add-point-btn"
    ) as HTMLButtonElement;
    const deleteBtn = document.getElementById(
      "delete-btn"
    ) as HTMLButtonElement;
    const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
    const repBtn = document.getElementById("rep-btn") as HTMLButtonElement;

    measureBtn.addEventListener("click", () => this.viewer.toggleMeasureMode());
    selectBtn.addEventListener("click", () => this.viewer.toggleSelectMode());
    addPointBtn.addEventListener("click", () =>
      this.viewer.toggleAddPointMode()
    );
    deleteBtn.addEventListener("click", () =>
      this.viewer.deleteSelectedPoints()
    );
    saveBtn.addEventListener("click", () => this.saveJSON());
    repBtn.addEventListener("click", () => this.showRep());

    // Debug buttons
    setTimeout(() => {
      const topViewBtn = document.getElementById(
        "top-view-btn"
      ) as HTMLButtonElement;
      const enable3DControlsBtn = document.getElementById(
        "enable-3d-controls-btn"
      ) as HTMLButtonElement;
      const disable3DControlsBtn = document.getElementById(
        "disable-3d-controls-btn"
      ) as HTMLButtonElement;
      const zoomInBtn = document.getElementById(
        "zoom-in-btn"
      ) as HTMLButtonElement;
      const zoomOutBtn = document.getElementById(
        "zoom-out-btn"
      ) as HTMLButtonElement;
      const panLeftBtn = document.getElementById(
        "pan-left-btn"
      ) as HTMLButtonElement;
      const panRightBtn = document.getElementById(
        "pan-right-btn"
      ) as HTMLButtonElement;
      const panUpBtn = document.getElementById(
        "pan-up-btn"
      ) as HTMLButtonElement;
      const panDownBtn = document.getElementById(
        "pan-down-btn"
      ) as HTMLButtonElement;

      console.log("Navigation buttons found:", {
        topViewBtn: !!topViewBtn,
        enable3DControlsBtn: !!enable3DControlsBtn,
        disable3DControlsBtn: !!disable3DControlsBtn,
        zoomInBtn: !!zoomInBtn,
        zoomOutBtn: !!zoomOutBtn,
        panLeftBtn: !!panLeftBtn,
        panRightBtn: !!panRightBtn,
        panUpBtn: !!panUpBtn,
        panDownBtn: !!panDownBtn,
      });

      topViewBtn?.addEventListener("click", () => {
        console.log("Top View button clicked!");
        this.viewer.setTopView();
      });
      enable3DControlsBtn?.addEventListener("click", () => {
        console.log("Enable 3D Controls button clicked!");
        this.viewer.enable3DControls();
      });
      disable3DControlsBtn?.addEventListener("click", () => {
        console.log("Disable 3D Controls button clicked!");
        this.viewer.disable3DControls();
      });
      zoomInBtn?.addEventListener("click", () => {
        console.log("Zoom In button clicked!");
        this.viewer.manualZoomIn();
      });
      zoomOutBtn?.addEventListener("click", () => {
        console.log("Zoom Out button clicked!");
        this.viewer.manualZoomOut();
      });
      panLeftBtn?.addEventListener("click", () => {
        console.log("Pan Left button clicked!");
        this.viewer.panLeft();
      });
      panRightBtn?.addEventListener("click", () => {
        console.log("Pan Right button clicked!");
        this.viewer.panRight();
      });
      panUpBtn?.addEventListener("click", () => {
        console.log("Pan Up button clicked!");
        this.viewer.panUp();
      });
      panDownBtn?.addEventListener("click", () => {
        console.log("Pan Down button clicked!");
        this.viewer.panDown();
      });
    }, 100);

    // 2D Editor buttons
    const edit2DBtn = document.getElementById(
      "2d-edit-btn"
    ) as HTMLButtonElement;
    const createCurveBtn = document.getElementById(
      "create-curve-btn"
    ) as HTMLButtonElement;
    const generatePointsBtn = document.getElementById(
      "generate-points-btn"
    ) as HTMLButtonElement;

    edit2DBtn?.addEventListener("click", () => this.toggle2DEditingMode());
    createCurveBtn?.addEventListener("click", () => this.createCurve());
    generatePointsBtn?.addEventListener("click", () => this.generatePoints());

    // 3D Labels toggle button
    const toggle3DLabelsBtn = document.getElementById(
      "toggle-3d-labels-btn"
    ) as HTMLButtonElement;
    toggle3DLabelsBtn?.addEventListener("click", () =>
      this.toggle3DLandmarkLabels()
    );

    // Close 2D editor button
    const close2DBtn = document.getElementById(
      "close-2d-editor"
    ) as HTMLButtonElement;
    close2DBtn?.addEventListener("click", () => this.toggle2DEditingMode());

    // 2D Editor control buttons
    const zoomInBtn = document.getElementById("zoom-in") as HTMLButtonElement;
    const zoomOutBtn = document.getElementById("zoom-out") as HTMLButtonElement;
    const resetViewBtn = document.getElementById(
      "reset-view"
    ) as HTMLButtonElement;
    const viewAllPointsBtn = document.getElementById(
      "view-all-points"
    ) as HTMLButtonElement;

    zoomInBtn?.addEventListener("click", () => this.viewer.zoomIn2D());
    zoomOutBtn?.addEventListener("click", () => this.viewer.zoomOut2D());
    resetViewBtn?.addEventListener("click", () => this.viewer.reset2DView());
    viewAllPointsBtn?.addEventListener("click", () =>
      this.viewer.viewAllPoints2D()
    );

    // 2D Editor Selection Mode Controls
    const selectModeBtn = document.getElementById(
      "select-mode-btn"
    ) as HTMLButtonElement;
    const addPointModeBtn = document.getElementById(
      "add-point-mode-btn"
    ) as HTMLButtonElement;
    const deletePointModeBtn = document.getElementById(
      "delete-point-mode-btn"
    ) as HTMLButtonElement;

    selectModeBtn?.addEventListener("click", () => this.set2DSelectionMode());
    addPointModeBtn?.addEventListener("click", () => this.set2DAddPointMode());
    deletePointModeBtn?.addEventListener("click", () =>
      this.set2DDeletePointMode()
    );

    // 2D Editor Point Locking Controls
    const lockBodyPoints = document.getElementById(
      "lock-body-points"
    ) as HTMLInputElement;
    const lockGarmentPoints = document.getElementById(
      "lock-garment-points"
    ) as HTMLInputElement;
    const lockLandmarkPoints = document.getElementById(
      "lock-landmark-points"
    ) as HTMLInputElement;

    lockBodyPoints?.addEventListener("change", () =>
      this.togglePointTypeLock("body", lockBodyPoints.checked)
    );
    lockGarmentPoints?.addEventListener("change", () =>
      this.togglePointTypeLock("garment", lockGarmentPoints.checked)
    );
    lockLandmarkPoints?.addEventListener("change", () =>
      this.togglePointTypeLock("landmark", lockLandmarkPoints.checked)
    );

    // 2D Editor Selection Actions
    const deleteSelectedBtn = document.getElementById(
      "delete-selected-btn"
    ) as HTMLButtonElement;
    const clearSelectionBtn = document.getElementById(
      "clear-selection-btn"
    ) as HTMLButtonElement;
    const undoSelectionBtn = document.getElementById(
      "undo-selection-btn"
    ) as HTMLButtonElement;
    const redoSelectionBtn = document.getElementById(
      "redo-selection-btn"
    ) as HTMLButtonElement;

    deleteSelectedBtn?.addEventListener("click", () =>
      this.deleteSelectedPoints2D()
    );
    clearSelectionBtn?.addEventListener("click", () => this.clearSelection2D());
    undoSelectionBtn?.addEventListener("click", () => this.undoSelection2D());
    redoSelectionBtn?.addEventListener("click", () => this.redoSelection2D());

    // 2D Editor Display Options
    const toggleLabelsBtn = document.getElementById(
      "toggle-labels-btn"
    ) as HTMLButtonElement;
    toggleLabelsBtn?.addEventListener("click", () =>
      this.toggleLandmarkLabels2D()
    );

    // Add a test button for force view all points
    this.addTestForceViewButton();

    // Add debugging methods to window for testing
    this.addDebugMethods();

    // Window resize
    window.addEventListener("resize", () => {
      this.viewer.onWindowResize();
    });
  }

  private async loadDefaultJSON(): Promise<void> {
    try {
      const data = localStorage.getItem("jsonData");
      const output = document.getElementById("output");

      if (data) {
        try {
          const parsed = JSON.parse(data);
          this.loadJSONData(parsed);
        } catch (e) {
          console.error("Error parsing data parameter:", e);
          this.uiManager.showStatus(
            "Error parsing data parameter. Please upload a file."
          );
        }
      } else {
        this.uiManager.showStatus(
          "Error parsing data parameter. Please upload a file."
        );
      }
    } catch (error) {
      console.error("Error loading default JSON file:", error);
      this.uiManager.showStatus(
        "Error loading default JSON file. Please upload a file."
      );
    }
  }

  private async loadJSONFile(file: File): Promise<void> {
    this.uiManager.showLoading(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      this.loadJSONData(data);
      this.uiManager.showStatus(`Loaded: ${file.name}`);
    } catch (error) {
      this.uiManager.showStatus(`Error loading file: ${error}`);
    } finally {
      this.uiManager.showLoading(false);
    }
  }

  private loadJSONData(data: JSONData): void {
    this.jsonData = data;
    this.viewer.loadData(data);
    this.uiManager.populateFilters(data);

    this.selectFirstLevelAndTrial();

    this.updateFilters();
    this.uiManager.updatePointCount(this.viewer.getPointCount());
  }

  private selectFirstLevelAndTrial(): void {
    if (!this.jsonData) return;

    const levelFilter = document.getElementById(
      "level-filter"
    ) as HTMLSelectElement;
    const trialFilter = document.getElementById(
      "garment-filter"
    ) as HTMLSelectElement;

    // Select first specific level and trial (index 1, skipping "all" at index 0)
    if (levelFilter.options.length > 1) {
      levelFilter.selectedIndex = 1; // Index 1 is the first specific level
    }

    if (trialFilter.options.length > 1) {
      trialFilter.selectedIndex = 1; // Index 1 is the first specific trial
    }

    console.log("Auto-selected first level and first trial:", {
      level: levelFilter.value,
      trial: trialFilter.value,
    });
  }

  private updateFilters(): void {
    if (!this.jsonData) return;

    const levelFilter = document.getElementById(
      "level-filter"
    ) as HTMLSelectElement;
    const trialFilter = document.getElementById(
      "garment-filter"
    ) as HTMLSelectElement;
    const showBodyPoints = (
      document.getElementById("show-body-points") as HTMLInputElement
    ).checked;
    const showGarmentPoints = (
      document.getElementById("show-garment-points") as HTMLInputElement
    ).checked;
    const showLandmarkPoints = (
      document.getElementById("show-landmark-points") as HTMLInputElement
    ).checked;
    const showGarmentLandmarkPoints = (
      document.getElementById(
        "show-garment-landmark-points"
      ) as HTMLInputElement
    ).checked;

    this.viewer.updateFilters({
      level: levelFilter.value,
      trial: trialFilter.value,
      showBody: showBodyPoints,
      showGarment: showGarmentPoints,
      showLandmark: showLandmarkPoints,
      showGarmentLandmark: showGarmentLandmarkPoints,
    });

    this.uiManager.updatePointCount(this.viewer.getPointCount());

    // Update trial color legend
    const legend = this.viewer.getTrialColorLegend();
    this.uiManager.updateTrialColorLegend(legend);
  }

  private saveJSON(): void {
    if (!this.jsonData) {
      this.uiManager.showStatus("No data to save");
      return;
    }
    const trials: Trail[] = [];
    for (let index = 0; index < this.jsonData.trails.length; index++) {
      const levelsDatas: LevelData[] = [];
      this.jsonData.body.levels.map((i) => {
        const garmentIntersectionPoints = this.jsonData?.trails[
          index
        ].levels.find((j) => j.name === i.name);
        i.landmarks?.forEach((point) => {
          if (!point || !point.point || !point.name) return;
          let minDistance = Infinity;
          let nearestPoint: THREE.Vector3 | null = null;
          if (!garmentIntersectionPoints) return;
          garmentIntersectionPoints.forEach((obj) => {
            const distance = obj.distanceTo(point.point!);
            if (distance < minDistance) {
              minDistance = distance;
              nearestPoint = obj.clone();
            }
          });
          if (!nearestPoint) return;
          const landmarksData: Landmark = {
            name: point.name,
            point: nearestPoint,
            distance: minDistance,
          };
        });
      });
      const trialsData: Trail = {
        trailName: this.jsonData?.trails[index].trailName,
        levels: levelsDatas,
      };
    }
    const modifiedData = this.viewer.getModifiedData();
    const dataStr = JSON.stringify(modifiedData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modifiedData.fileName}_modified.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.uiManager.showStatus("JSON saved successfully");
  }
  private showRep(): void {
    if (!this.jsonData) {
      this.uiManager.showStatus("No data to save");
      return;
    }

    const modifiedData = this.viewer.getModifiedData();
    localStorage.removeItem("jsonData");
    localStorage.setItem("jsonData", JSON.stringify(modifiedData));
    window.location.href = "/report";
  }

  // 2D Editor Methods
  private toggle2DEditingMode(): void {
    console.log("=== 2D EDIT MODE TOGGLE START ===");

    const levelFilter = document.getElementById(
      "level-filter"
    ) as HTMLSelectElement;
    const trialFilter = document.getElementById(
      "garment-filter"
    ) as HTMLSelectElement;

    console.log("UI Elements found:", {
      levelFilter: !!levelFilter,
      trialFilter: !!trialFilter,
    });

    const level = levelFilter?.value;
    const trial = trialFilter?.value === "all" ? undefined : trialFilter?.value;

    console.log("Filter values:", {
      level: level,
      trial: trial,
      levelFilterValue: levelFilter?.value,
      trialFilterValue: trialFilter?.value,
    });

    if (level === "all") {
      console.log(
        'ERROR: Cannot enter 2D edit mode with "All Levels" selected'
      );
      this.uiManager.showStatus(
        "Please select a specific level for 2D editing"
      );
      return;
    }

    console.log("Calling viewer.toggle2DEditingMode with:", { level, trial });
    this.viewer.toggle2DEditingMode(level, trial);

    // Update UI state
    const isEditing = this.viewer.isIn2DEditingMode();
    console.log("Viewer 2D editing state:", isEditing);

    this.uiManager.update2DEditorState(isEditing, level, trial);
    console.log("=== 2D EDIT MODE TOGGLE END ===");
  }

  private createCurve(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    const options = this.uiManager.getCurveOptions();
    this.uiManager.showStatus(`Creating ${options.type} curve...`);

    // This would integrate with the Editor2D to create curves
    // For now, just show a message
    this.uiManager.showStatus("Curve creation feature coming soon");
  }

  private generatePoints(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    const options = this.uiManager.getCurveOptions();
    this.uiManager.showStatus(
      `Generating points with ${options.spacing}mm spacing...`
    );

    // This would integrate with the Editor2D to generate equidistant points
    // For now, just show a message
    this.uiManager.showStatus("Point generation feature coming soon");
  }

  private addTestForceViewButton(): void {
    // Add a test button to the 2D editor controls
    const testBtn = document.createElement("button");
    testBtn.textContent = "Test View All";
    testBtn.style.cssText =
      "background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;";
    testBtn.addEventListener("click", () => {
      console.log("=== Test View All Button Clicked ===");
      this.viewer.testViewAllPoints2D();
    });

    const controls2D = document.querySelector(".controls-2d");
    if (controls2D) {
      controls2D.appendChild(testBtn);
    } else {
      console.error("2D controls container not found");
    }
  }

  private set2DSelectionMode(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.set2DSelectionMode(true);
    this.uiManager.showStatus(
      "Selection mode enabled - Click and drag to select points"
    );

    // Update button states
    this.update2DModeButtonStates("select");
  }

  private set2DAddPointMode(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.set2DAddPointMode(true);
    this.uiManager.showStatus(
      "Add point mode enabled - Click to add new points"
    );

    // Update button states
    this.update2DModeButtonStates("add");
  }

  private set2DDeletePointMode(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.set2DDeletePointMode(true);
    this.uiManager.showStatus(
      "Delete point mode enabled - Click to delete points"
    );

    // Update button states
    this.update2DModeButtonStates("delete");
  }

  private deleteSelectedPoints2D(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    const deletedCount = this.viewer.deleteSelectedPoints2D();
    this.uiManager.showStatus(`Deleted ${deletedCount} selected points`);
  }

  private clearSelection2D(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.clearSelection2D();
    this.uiManager.showStatus("Selection cleared");
  }

  private undoSelection2D(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.undoSelection2D();
    this.uiManager.showStatus("Selection undone");
  }

  private redoSelection2D(): void {
    if (!this.viewer.isIn2DEditingMode()) {
      this.uiManager.showStatus("Please enter 2D editing mode first");
      return;
    }

    this.viewer.redoSelection2D();
    this.uiManager.showStatus("Selection redone");
  }

  private togglePointTypeLock(type: string, lock: boolean): void {
    if (lock) {
      this.viewer.lockPointType2D(type);
    } else {
      this.viewer.unlockPointType2D(type);
    }
  }

  private toggleLandmarkLabels2D(): void {
    this.viewer.toggleLandmarkLabels2D();
    console.log("Toggled landmark labels in 2D editor");
  }

  private update2DModeButtonStates(activeMode: string): void {
    const selectBtn = document.getElementById(
      "select-mode-btn"
    ) as HTMLButtonElement;
    const addBtn = document.getElementById(
      "add-point-mode-btn"
    ) as HTMLButtonElement;
    const deleteBtn = document.getElementById(
      "delete-point-mode-btn"
    ) as HTMLButtonElement;

    // Reset all button styles
    [selectBtn, addBtn, deleteBtn].forEach((btn) => {
      if (btn) {
        btn.style.background = "rgba(255,255,255,0.2)";
      }
    });

    // Highlight active mode
    switch (activeMode) {
      case "select":
        if (selectBtn) selectBtn.style.background = "rgba(0,123,255,0.5)";
        break;
      case "add":
        if (addBtn) addBtn.style.background = "rgba(40,167,69,0.5)";
        break;
      case "delete":
        if (deleteBtn) deleteBtn.style.background = "rgba(220,53,69,0.5)";
        break;
    }
  }

  private addDebugMethods(): void {
    // Expose debugging methods to window for console testing
    (window as any).debugViewer = {
      getControlState: () => this.viewer.getControlState(),
      enable3DControls: () => this.viewer.enable3DControls(),
      disable3DControls: () => this.viewer.disable3DControls(),
      setTopView: () => this.viewer.setTopView(),
      logControlState: () =>
        console.log("Control State:", this.viewer.getControlState()),
      manualZoomIn: () => this.viewer.manualZoomIn(),
      manualZoomOut: () => this.viewer.manualZoomOut(),
    };

    // Also add a global test function
    (window as any).testZoom = () => {
      console.log("Global testZoom function called");
      this.viewer.setTopView();
    };

    console.log("Debug methods added to window.debugViewer");
    console.log(
      "Available methods: getControlState(), enable3DControls(), disable3DControls(), setTopView(), logControlState(), manualZoomIn(), manualZoomOut()"
    );
    console.log("Or call testZoom() directly from console");
  }

  private toggle3DLandmarkLabels(): void {
    this.viewer.toggleLandmarkLabels3D();
    console.log("Toggled 3D landmark labels");
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new App();
});
