import { type JSONData } from "./types";

export class UIManager {
  constructor() {
    // Initialize UI elements
  }

  public populateFilters(data: JSONData): void {
    this.populateLevelFilter(data);
    this.populateGarmentFilter(data);
  }

  private populateLevelFilter(data: JSONData): void {
    const levelFilter = document.getElementById(
      "level-filter"
    ) as HTMLSelectElement;
    if (!levelFilter) return;

    // Clear existing options except "All Levels"
    levelFilter.innerHTML = '<option value="all">All Levels</option>';

    // Add body levels
    if (data.body?.levels) {
      data.body.levels.forEach((level) => {
        const option = document.createElement("option");
        option.value = level.name;
        option.textContent = level.name;
        levelFilter.appendChild(option);
      });
    }

    // Add garment levels from trails
    if (data.trails) {
      data.trails.forEach((trail) => {
        trail.levels.forEach((level) => {
          // Check if level already exists
          const existingOption = levelFilter.querySelector(
            `option[value="${level.name}"]`
          );
          if (!existingOption) {
            const option = document.createElement("option");
            option.value = level.name;
            option.textContent = level.name;
            levelFilter.appendChild(option);
          }
        });
      });
    }
  }

  private populateGarmentFilter(data: JSONData): void {
    const garmentFilter = document.getElementById(
      "garment-filter"
    ) as HTMLSelectElement;
    if (!garmentFilter) return;

    // Clear existing options except "All Trials"
    garmentFilter.innerHTML = '<option value="all">All Trials</option>';

    // Add trial names from trails
    if (data.trails) {
      data.trails.forEach((trail) => {
        const option = document.createElement("option");
        option.value = trail.trailName;
        option.textContent = trail.trailName;
        garmentFilter.appendChild(option);
      });
    }
  }

  public updatePointCount(count: number): void {
    const pointCount = document.getElementById("point-count");
    if (pointCount) {
      pointCount.textContent = count.toString();
    }
  }

  public showStatus(message: string): void {
    const statusText = document.getElementById("status-text");
    if (statusText) {
      statusText.textContent = message;
    }
  }

  public showLoading(show: boolean): void {
    const loading = document.getElementById("loading");
    if (loading) {
      if (show) {
        loading.classList.remove("hidden");
      } else {
        loading.classList.add("hidden");
      }
    }
  }

  public updateTrialColorLegend(legend: string): void {
    const legendElement = document.getElementById("trial-color-legend");
    if (legendElement) {
      if (legend) {
        legendElement.innerHTML = legend.replace(/\n/g, "<br>");
        legendElement.style.display = "block";
      } else {
        legendElement.style.display = "none";
      }
    }
  }

  public add2DEditorControls(): void {
    const controlsPanel = document.getElementById("controls-panel");
    if (!controlsPanel) return;

    // Add 2D Editor section
    const editorSection = document.createElement("div");
    editorSection.className = "control-group";
    editorSection.innerHTML = `
            <label>2D Editor</label>
            <div class="button-group">
                <button id="2d-edit-btn" class="btn-secondary">2D Edit Mode</button>
                <button id="create-curve-btn" class="btn-secondary" disabled>Create Curve</button>
                <button id="generate-points-btn" class="btn-secondary" disabled>Generate Points</button>
            </div>
            <div class="control-group" id="curve-options" style="display: none;">
                <label>Curve Options</label>
                <select id="curve-type">
                    <option value="spline">Spline</option>
                    <option value="bezier">Bezier</option>
                    <option value="linear">Linear</option>
                </select>
                <label>Point Spacing (mm)</label>
                <input type="number" id="point-spacing" value="1" min="0.1" step="0.1">
                <label>Divisions (for body)</label>
                <input type="number" id="divisions" value="10" min="2" step="1">
            </div>
        `;

    controlsPanel.appendChild(editorSection);
  }

  public update2DEditorState(
    isEditing: boolean,
    level: string,
    trial?: string
  ): void {
    console.log("=== UIManager.update2DEditorState START ===");
    console.log("Parameters:", { isEditing, level, trial });

    const editBtn = document.getElementById("2d-edit-btn") as HTMLButtonElement;
    const createCurveBtn = document.getElementById(
      "create-curve-btn"
    ) as HTMLButtonElement;
    const generatePointsBtn = document.getElementById(
      "generate-points-btn"
    ) as HTMLButtonElement;
    const curveOptions = document.getElementById(
      "curve-options"
    ) as HTMLDivElement;

    console.log("UI elements found:", {
      editBtn: !!editBtn,
      createCurveBtn: !!createCurveBtn,
      generatePointsBtn: !!generatePointsBtn,
      curveOptions: !!curveOptions,
    });

    if (editBtn) {
      editBtn.textContent = isEditing ? "Exit 2D Edit" : "2D Edit Mode";
      editBtn.className = isEditing ? "btn-danger" : "btn-secondary";
      console.log("Edit button updated:", {
        text: editBtn.textContent,
        className: editBtn.className,
      });
    }

    if (createCurveBtn) {
      createCurveBtn.disabled = !isEditing;
      console.log("Create curve button disabled:", createCurveBtn.disabled);
    }

    if (generatePointsBtn) {
      generatePointsBtn.disabled = !isEditing;
      console.log(
        "Generate points button disabled:",
        generatePointsBtn.disabled
      );
    }

    if (curveOptions) {
      curveOptions.style.display = isEditing ? "block" : "none";
      console.log("Curve options display:", curveOptions.style.display);
    }

    // Update status
    if (isEditing) {
      const statusMessage = `2D Editing: Level ${level}${
        trial ? `, Trial ${trial}` : ""
      }`;
      console.log("Status message:", statusMessage);
      this.showStatus(statusMessage);
    } else {
      console.log("Status message: 3D View Mode");
      this.showStatus("3D View Mode");
    }

    console.log("=== UIManager.update2DEditorState END ===");
  }

  public getCurveOptions(): {
    type: string;
    spacing: number;
    divisions: number;
  } {
    const curveType =
      (document.getElementById("curve-type") as HTMLSelectElement)?.value ||
      "spline";
    const spacing = parseFloat(
      (document.getElementById("point-spacing") as HTMLInputElement)?.value ||
        "1"
    );
    const divisions = parseInt(
      (document.getElementById("divisions") as HTMLInputElement)?.value || "10"
    );

    return { type: curveType, spacing, divisions };
  }
}
