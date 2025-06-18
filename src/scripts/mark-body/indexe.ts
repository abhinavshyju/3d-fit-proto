import { colors, type ColorName } from "../constant/colors";
import { createPlaneFromThreePoints } from "../create-plane";
import { createPoint } from "../create-point";
import { loadModel } from "../loadModel";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { getModelPlaneIntersections } from "../model-intersector";
import { getPlaneFromMesh } from "../planeFromMesh";
import { sortPointsNearestNeighbor } from "../sort";
import { landMarks } from "../landmarks";
import Chart from "chart.js/auto";

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
const createdLevels: {
  name: string;
  color: string;
}[] = [];
const levels: {
  name: string;
  color: string;
}[] = [
  {
    name: "bust",
    color: "green",
  },
  {
    name: "waist",
    color: "blue",
  },
  {
    name: "hip",
    color: "yellow",
  },
];

const landmarks: {
  name: string;
}[] = [
  { name: "CF" },
  {
    name: "LFPS",
  },
  {
    name: "LSS",
  },
  {
    name: "LBPS",
  },
  {
    name: "CB",
  },
  {
    name: "RBPS",
  },
  {
    name: "RSS",
  },
  {
    name: "RFPS",
  },
];
let selectedLevel = "";
const createLevels = [];
let selectTool = "none";

const masterJson: {
  fileName: string;
  levels: Array<{
    name: string;
    intersectionPoints: THREE.Vector3[];
    planeMesh: THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial,
      THREE.Object3DEventMap
    >;
    points: Array<{
      name: string;
      point: THREE.Vector3;
      color: string;
    }>;
  }>;
} = {
  fileName: "",
  levels: [],
};
const localLavelJson: {
  name: string;
  intersectionPoints: THREE.Vector3[];
  planeMesh: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial,
    THREE.Object3DEventMap
  >;
  line: THREE.Line<
    THREE.BufferGeometry<THREE.NormalBufferAttributes>,
    THREE.LineBasicMaterial,
    THREE.Object3DEventMap
  >;
}[] = [];

window.addEventListener("load", () => {
  const levelTable = document.getElementById("levelTable");
  if (!levelTable) return;
  const levelSelecter = document.getElementById("levelSelecter");
  if (!levelSelecter) return;
  // levels.forEach((item) => {
  //   const row = document.createElement("tr");
  //   row.classList.add("hover:bg-gray-50");
  //   row.classList.add("transition");
  //   row.innerHTML = `
  //   <td class="py-2 px-4 text-sm">${item.name.toUpperCase()}</td>
  //   <td class="py-2 px-4">
  //       <div style="background-color: ${
  //         colors[item.color as ColorName].hex
  //       }; border-color: ${colors[item.color as ColorName].hex};"
  //           class="size-4 rounded border-2 shadow-sm"></div>
  //   </td>`;
  //   levelTable.appendChild(row);

  //   const option = document.createElement("option");
  //   option.classList.add("text-xs");
  //   option.text = item.name.toUpperCase();
  //   option.value = item.name;
  //   levelSelecter.appendChild(option);
  // });
});

const axesHelper: THREE.AxesHelper = new THREE.AxesHelper(100);
axesHelper.position.set(0, 0, 0);
scene.add(axesHelper);

let bodyModel: THREE.Object3D | null = null;
let fileName: string;

(window as any).bodyUpload = (event: Event) => {
  loadModel(
    event,
    scene,
    "body",
    (model: THREE.Object3D, LocalfileName: string) => {
      bodyModel = model;
      fileName = LocalfileName;
      masterJson.fileName = LocalfileName;
    }
  );
};

(window as any).createLevelBtn = () => {
  selectTool = "Create level";
};

(window as any).addLandMark = () => {
  selectTool = "Add Landmark";
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickPoints: THREE.Vector3[] = [];
const tempPoints: THREE.Mesh<
  THREE.SphereGeometry,
  THREE.MeshBasicMaterial,
  THREE.Object3DEventMap
>[] = [];
let localInterscectionPlane: THREE.Mesh<
  THREE.PlaneGeometry,
  THREE.MeshBasicMaterial,
  THREE.Object3DEventMap
>;
window.addEventListener("dblclick", onClick, false);
function onClick(event: { clientX: number; clientY: number }) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (!bodyModel) {
    console.error("Model not found");
    return;
  }

  const getIntersection = (model: THREE.Object3D) => {
    const intersects = raycaster.intersectObject(model, true);
    return intersects.length ? intersects[0].point.clone() : null;
  };

  if (selectTool === "none") {
    alert("Select create tool");
  }

  if (selectTool === "Create level") {
    const point = getIntersection(bodyModel);
    if (!point) {
      console.error("Point got some error");
      return;
    }
    const markerPoint = createPoint("red");
    markerPoint.position.copy(point);
    scene.add(markerPoint);
    clickPoints.push(point);
    tempPoints.push(markerPoint);
    if (clickPoints.length == 3) {
      localInterscectionPlane = createPlaneFromThreePoints(
        clickPoints[0],
        clickPoints[1],
        clickPoints[2]
      );
      scene.add(localInterscectionPlane);
      const selectLevelDialog = document.getElementById("selectLevelDialog");
      if (!selectLevelDialog) {
        console.log("select dialog not found");
        return;
      }
      selectLevelDialog.classList.remove("hidden");
      selectLevelDialog.classList.add("flex");

      const levelSelecter = document.getElementById(
        "levelSelecter"
      ) as HTMLInputElement;
      if (!levelSelecter) {
        console.log("Level select not found");
        return;
      }

      const option = `
        <option>Select option</option>
        ${levels
          .map((item) => `<option value="${item.name}">${item.name}</option>`)
          .join("")}
      `;
      levelSelecter.innerHTML = option;
    }
  }
  if (selectTool === "Add Landmark") {
    raycaster.params.Line.threshold = 0.01;
    const line = localLavelJson.find((item) => item.name == selectedLevel);
    if (!line) {
      console.log("Line not found ");
      return;
    }
    const point = getIntersection(line.line);
    if (!point) {
      console.error("Point got some error");
      return;
    }
    clickPoints.push(point);
    const selectLandmarkDialog = document.getElementById(
      "selectLandmarkDialog"
    );
    if (!selectLandmarkDialog) {
      return;
    }
    const landmarkSelect = document.getElementById("landmarkSelect");
    if (!landmarkSelect) {
      return;
    }
    const options = `
    <option>Select option</option>
    ${landmarks
      .map((item) => `<option value="${item.name}">${item.name}</option>`)
      .join("")}
  `;
    landmarkSelect.innerHTML = options;
    selectLandmarkDialog.classList.remove("hidden");
    selectLandmarkDialog.classList.add("flex");
  }
}

// Create levls
(window as any).levelSelectSubmit = () => {
  const levelSelecter = document.getElementById(
    "levelSelecter"
  ) as HTMLInputElement;
  if (!levelSelecter) {
    console.log("Selector not found");
    return;
  }
  if (!bodyModel) {
    return;
  }
  const intesectionPoints = getModelPlaneIntersections(
    bodyModel,
    getPlaneFromMesh(localInterscectionPlane)
  );
  const value = levelSelecter.value;

  const colour = levels.find((item) => item.name === value)?.color || "red";
  createdLevels.push({
    name: value,
    color: colour,
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(
    sortPointsNearestNeighbor(intesectionPoints)
  );
  const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  scene.remove(localInterscectionPlane);
  const selectLevelDialog = document.getElementById("selectLevelDialog");
  if (!selectLevelDialog) {
    console.log("Select dialog not found");
    return;
  }
  tempPoints.forEach((item) => {
    scene.remove(item);
  });
  selectLevelDialog.classList.remove("flex");
  selectLevelDialog.classList.add("hidden");
  const levelTable = document.getElementById("levelTable");
  if (!levelTable) return;

  const row = document.createElement("tr");
  row.classList.add("hover:bg-gray-50");
  row.classList.add("transition");
  row.innerHTML = `
    <td class="py-2 px-4 text-sm">${value.toUpperCase()}</td>
    <td class="py-2 px-4">
        <div style="background-color: ${
          colors[colour as ColorName].hex
        }; border-color: ${colors[colour as ColorName].hex};"
            class="size-4 rounded border-2 shadow-sm"></div>
    </td>`;
  levelTable.appendChild(row);
  const levelSelecterForLandmarking = document.getElementById(
    "levelSelecterForLandmarking"
  );
  if (!levelSelecterForLandmarking) {
    return;
  }
  const option = document.createElement("option");
  option.classList.add("text-xs");
  option.text = value.toUpperCase();
  option.value = value;
  levelSelecter.appendChild(option);
  levelSelecterForLandmarking.appendChild(option);

  createLevels.push({
    name: value,
    plane: localInterscectionPlane,
    interscetionPoints: sortPointsNearestNeighbor(intesectionPoints),
  });

  localLavelJson.push({
    name: value,
    planeMesh: localInterscectionPlane,
    intersectionPoints: sortPointsNearestNeighbor(intesectionPoints),
    line: line,
  });

  masterJson.levels.push({
    name: value,
    points: [],
    planeMesh: localInterscectionPlane,
    intersectionPoints: sortPointsNearestNeighbor(intesectionPoints),
  });

  clickPoints.length = 0;
};
// Create custom level funtion
(window as any).createCustomLevelSave = () => {
  const customLevelInput = document.getElementById(
    "customLevelInput"
  ) as HTMLInputElement;
  if (!customLevelInput) {
    console.log("Custom level input is not found");
    return;
  }
  if (!customLevelInput.value) {
    return;
  }

  if (levels.find((item) => item.name == customLevelInput.value)) {
    const customLandmarkDialogError = document.getElementById(
      "customLevelDialogError"
    );
    if (customLandmarkDialogError) {
      customLandmarkDialogError.innerText = "Level is already exist";
    }
  } else {
    levels.push({
      name: customLevelInput.value,
      color: "red",
    });
    createdLevels.push({
      name: customLevelInput.value,
      color: "red",
    });
    const customLevelDialog = document.getElementById("customLevelDialog");
    if (!customLevelDialog) return;
    customLevelDialog.classList.remove("flex");
    customLevelDialog.classList.add("hidden");
  }
};
// Create custom landmarks
(window as any).createCustomLandmarkSave = () => {
  const customLevelInput = document.getElementById(
    "customLandmarkInput"
  ) as HTMLInputElement;
  if (!customLevelInput) {
    console.log("customLandmarkInput");
    return;
  }
  if (!customLevelInput.value) {
    return;
  }
  if (landMarks.find((item) => item.name == customLevelInput.value)) {
    const customLandmarkDialogError = document.getElementById(
      "customLandmarkDialogError"
    );
    if (customLandmarkDialogError) {
      customLandmarkDialogError.innerText = "Landmark is already exist";
    }
  } else {
    landmarks.push({
      name: customLevelInput.value,
    });
    const customLandmarkDialog = document.getElementById(
      "customLandmarkDialog"
    );
    if (!customLandmarkDialog) return;
    customLandmarkDialog.classList.remove("flex");
    customLandmarkDialog.classList.add("hidden");
  }
};

let chartInstance: Chart<
  "scatter",
  { x: number; y: number }[],
  unknown
> | null = null;
(window as any).landmarkSelectSubmit = () => {
  const landmarkSelect = document.getElementById(
    "landmarkSelect"
  ) as HTMLInputElement;
  if (!landmarkSelect) {
    return;
  }
  if (!landmarkSelect.value) {
    return;
  }
  const marker = createPoint(
    (landMarks.find((item) => item.name == landmarkSelect.value.toUpperCase())
      ?.colour as ColorName) || "red"
  );
  marker.position.copy(clickPoints[0]);
  scene.add(marker);
  const level = masterJson.levels.find((item) => item.name === selectedLevel);
  level?.points.push({
    name: landmarkSelect.value,
    color:
      landMarks.find((item) => item.name == landmarkSelect.value.toUpperCase())
        ?.colour || "red",
    point: clickPoints[0],
  });

  const selectLandmarkDialog = document.getElementById("selectLandmarkDialog");
  if (!selectLandmarkDialog) {
    return;
  }
  selectLandmarkDialog.classList.remove("flex");
  selectLandmarkDialog.classList.add("hidden");
  if (chartInstance != null) {
    chartInstance.destroy();
  }
  const ctx = document.getElementById("myChart") as HTMLCanvasElement;
  const data = masterJson.levels.find((item) => item.name == selectedLevel);
  const dataSets:
    | {
        label: string;
        data: {
          x: number;
          y: number;
        }[];
        borderColor: string;
        showLine: boolean;
        pointRadius: number;
        pointHitRadius: number;
      }
    | {
        label: string;
        data: {
          x: number;
          y: number;
        }[];
        borderColor: string;
        showLine: boolean;
        pointRadius: number;
        pointHitRadius?: number;
      }[] = [];
  data?.points.forEach((item) => {
    dataSets.push({
      label: item.name,
      data: [{ x: item.point.x, y: item.point.z }],
      borderColor: "red",
      showLine: false,
      pointRadius: 3,
    });
  });
  if (ctx) {
    chartInstance = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          ...dataSets,
          {
            label: "Body",
            data:
              data?.intersectionPoints.map((p) => ({ x: p.x, y: p.z })) || [],
            borderColor: "blue",
            showLine: true,
            pointRadius: 0,
            borderWidth: 2,
            pointHitRadius: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
        maintainAspectRatio: false,
        scales: {
          x: { type: "linear", min: -2, max: 2 },
          y: { min: -2, max: 2 },
        },
      },
    });
  } else {
    console.error("Canvas element not found");
  }
  clickPoints.length = 0;
};

const levelSelector = document.getElementById(
  "levelSelecterForLandmarking"
) as HTMLInputElement | null;

if (levelSelector) {
  levelSelector.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.value == "select level") {
      return;
    }
    if (chartInstance != null) {
      chartInstance.destroy();
    }
    selectedLevel = target.value;
    const ctx = document.getElementById("myChart") as HTMLCanvasElement;
    const data = masterJson.levels.find((item) => item.name == target.value);
    const dataSets:
      | {
          label: string;
          data: {
            x: number;
            y: number;
          }[];
          borderColor: string;
          showLine: boolean;
          pointRadius: number;
          pointHitRadius: number;
        }
      | {
          label: string;
          data: {
            x: number;
            y: number;
          }[];
          borderColor: string;
          showLine: boolean;
          pointRadius: number;
          pointHitRadius?: number;
        }[] = [];
    data?.points.forEach((item) => {
      dataSets.push({
        label: item.name,
        data: [{ x: item.point.x, y: item.point.z }],
        borderColor: "red",
        showLine: false,
        pointRadius: 3,
      });
    });
    if (ctx) {
      chartInstance = new Chart(ctx, {
        type: "scatter",
        data: {
          datasets: [
            ...dataSets,
            {
              label: "Body",
              data:
                data?.intersectionPoints.map((p) => ({ x: p.x, y: p.z })) || [],
              borderColor: "blue",
              showLine: true,
              pointRadius: 0,
              borderWidth: 2,
              pointHitRadius: 0,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              display: false,
            },
          },
          maintainAspectRatio: false,
          scales: {
            x: { type: "linear", min: -2, max: 2 },
            y: { min: -2, max: 2 },
          },
        },
      });
    } else {
      console.error("Canvas element not found");
    }
  });
} else {
  console.error("Element with ID 'levelSelecterForLandmarking' not found.");
}

(window as any).saveBodyJson = () => {
  if (!masterJson.fileName) {
    return;
  }
  const json = JSON.stringify(masterJson);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = masterJson.fileName + ".json";
  link.click();
  URL.revokeObjectURL(url);
};
