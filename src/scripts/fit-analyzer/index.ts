import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { loadModel } from "../loadModel";
import { createPlaneFromThreePoints } from "../create-plane";
import { getModelPlaneIntersections } from "../model-intersector";
import { getPlaneFromMesh } from "../planeFromMesh";
import { createPoint } from "../create-point";
import type { ColorName } from "../constant/colors";
import { sortPointsNearestNeighbor } from "../sort";
import {
  Chart,
  ScatterController,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { setFinalJson } from "../storage";
import type { MasterJson, Trail } from "../type";
import { importMasterJsonFromFile } from "../JsonImport";
import { getCurrentDateYYYYMMDD } from "../utils";

Chart.register(
  ScatterController,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

let masterJson: MasterJson;
let finalJson: MasterJson = {
  fileName: "",
  category: "",
  date: "",
  fitName: "",
  subcategory: "",
  tolerance: 0,
  version: "",
  bodyLevels: [],
  criticalMeasurement: [],
  landmarks: [],
  trails: [],
  value: [],
  unit: null,
  body: null,
  garment: null,
};
let loaded = false;
setFinalJson(null);
class ThreeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private viewport: HTMLElement;
  private width: number;
  private height: number;

  constructor(viewportId: string) {
    const viewPortEl = document.getElementById(viewportId);
    if (!viewPortEl)
      throw new Error(`Viewport element with id '${viewportId}' not found.`);

    this.viewport = viewPortEl;
    this.width = viewPortEl.clientWidth;
    this.height = viewPortEl.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x303030);

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.width / this.height,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(window.devicePixelRatio * 0.75);
    this.viewport.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.initLights();
    this.scene.add(new THREE.AxesHelper(100));

    this.animate();
  }

  private initLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 10));
    const lightPositions = [
      [5, 10, 7.5],
      [5, 10, -7.5],
      [-5, 10, 7.5],
      [-5, 10, -7.5],
    ];
    lightPositions.forEach(([x, y, z]) => {
      const light = new THREE.DirectionalLight(0xffffff);
      light.position.set(x, y, z);
      this.scene.add(light);
    });
  }

  private animate(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
}

const bodySceneT = new ThreeScene("bodyViewPort");
const tOneSceneT = new ThreeScene("tOneViewPort");
const tTwoSceneT = new ThreeScene("tTwoViewPort");
const tThreeSceneT = new ThreeScene("tThreeViewPort");

const rBodyViewPort = new ThreeScene("rBodyViewPort");
const rTOneViewPort = new ThreeScene("rTOneViewPort");
const rTTwoViewPort = new ThreeScene("rTTwoViewPort");
const rTThreeViewPort = new ThreeScene("rTThreeViewPort");

let bodyModel: THREE.Object3D | null;
const trialMap: Record<
  string,
  { model: THREE.Object3D | null; scene: THREE.Scene; sceneTwo: THREE.Scene }
> = {
  trial1: {
    model: null,
    scene: tOneSceneT.getScene(),
    sceneTwo: rTOneViewPort.getScene(),
  },
  trial2: {
    model: null,
    scene: tTwoSceneT.getScene(),
    sceneTwo: rTTwoViewPort.getScene(),
  },
  trial3: {
    model: null,
    scene: tThreeSceneT.getScene(),
    sceneTwo: rTThreeViewPort.getScene(),
  },
};
const tempModel = [];
function handleModelUpload(
  event: Event,
  type: "body" | "trial1" | "trial2" | "trial3"
) {
  const scene = type === "body" ? bodySceneT.getScene() : trialMap[type].scene;
  loadModel(event, scene, type, (model, _fileName) => {
    if (type === "body") {
      bodyModel = model;
      rBodyViewPort.getScene().add(model.clone(true));
      tempModel.push({
        name: "body",
        body: true,
        model: model,
      });
    } else {
      trialMap[type].model = model;
      trialMap[type].sceneTwo.add(model.clone(true));
      tempModel.push({
        body: false,
        name: type,
        model: model,
      });
    }
  });
}

function handleAllTrialFits() {
  if (loaded) return;
  finalJson.bodyLevels = masterJson.bodyLevels;
  finalJson.landmarks = masterJson.landmarks;
  finalJson.value = masterJson.value;
  finalJson.tolerance = masterJson.tolerance;
  finalJson.criticalMeasurement = masterJson.criticalMeasurement;
  const trials: Trail[] = [];
  ["trial1", "trial2", "trial3"].forEach((trialKey) => {
    const trial = trialMap[trialKey];
    if (!trial.model) return;

    const input: Trail = {
      trailName: trialKey,
      levels: [],
    };
    if (!masterJson.value) return;
    masterJson.value.forEach((item) => {
      const level = masterJson.body?.levels?.find(
        (i) => i?.name == item?.levelName
      );

      const intersectionPoints = level?.intersectionPoints;
      if (!intersectionPoints || intersectionPoints.length < 3) return;

      const len = intersectionPoints.length;
      const p1 = intersectionPoints[Math.floor(Math.random() * (len / 3))];
      const p2 =
        intersectionPoints[
          Math.floor(len / 3) + Math.floor(Math.random() * (len / 3))
        ];
      const p3 =
        intersectionPoints[
          Math.floor((2 * len) / 3) + Math.floor(Math.random() * (len / 3))
        ];

      const plane = getPlaneFromMesh(createPlaneFromThreePoints(p1, p2, p3));
      const intersections = sortPointsNearestNeighbor(
        getModelPlaneIntersections(trial.model!, plane)
      );

      const geometry = new THREE.BufferGeometry().setFromPoints(intersections);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
      );
      trial.scene.add(line);

      // Ensure item and item.landmarks are not null or undefined
      const pointsMapped = level?.landmarks?.map((landmark) => {
        if (!landmark || !landmark.point) return null;
        const nearest = intersections.reduce(
          (nearest, point) => {
            const dist = point.distanceTo(
              landmark.point || new THREE.Vector3()
            );
            return dist < nearest.distance
              ? { point, distance: dist }
              : nearest;
          },
          { point: new THREE.Vector3(), distance: Infinity }
        );
        const marker = createPoint("red" as ColorName);
        marker.position.copy(nearest.point);
        trial.scene.add(marker);
        return {
          name: landmark.name,
          point: nearest.point,
          distance: nearest.distance,
          color: "red",
        };
      });

      input.levels?.push({
        name: item?.levelName || "",
        intersectionPoints: intersections,
        landmarks: pointsMapped ?? null,
      });
    });

    trials.push(input);
  });
  loaded = true;

  finalJson.trails?.push(...trials);
  // createChartsPerLevel(finalJson);
  setFinalJson(finalJson);
}

function getAverageMagnitude(points: THREE.Vector3[]): number {
  if (!points.length) return 0;
  const sum = points.reduce((acc, p) => acc + p.length(), 0);
  return sum / points.length;
}

function getColor(index: number): string {
  const colors = ["blue", "orange", "purple", "cyan", "magenta", "brown"];
  return colors[index % colors.length];
}

// export function createChartsPerLevel(data: finaljson): void {

//   setFinalJson(finalJson);
// }

declare global {
  interface Window {
    uploadBody: (event: Event) => void;
    uploadTrialOne: (event: Event) => void;
    uploadTrialTwo: (event: Event) => void;
    uploadTrialThree: (event: Event) => void;
    uploadFit: (event: Event) => void;
    loadFit: () => void;
  }
}

window.uploadBody = (event) => handleModelUpload(event, "body");
window.uploadTrialOne = (event) => handleModelUpload(event, "trial1");
window.uploadTrialTwo = (event) => handleModelUpload(event, "trial2");
window.uploadTrialThree = (event) => handleModelUpload(event, "trial3");

window.uploadFit = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    masterJson = await importMasterJsonFromFile(file);
    console.log(masterJson);
    finalJson.fileName = masterJson.fileName ?? "";
    finalJson.body = masterJson.body;
    finalJson.fitName = masterJson.fitName ?? "";
    finalJson.tolerance = masterJson.tolerance ?? 0;
    finalJson.subcategory = masterJson.subcategory ?? "";
    finalJson.date = masterJson.date ?? "";
    finalJson.category = masterJson.category ?? "";
    finalJson.version = masterJson.version ?? "";
    finalJson.value = (masterJson.value ?? []).map((v) => ({
      levelName: v?.levelName ?? "",
      landmarks: (v?.landmarks ?? []).map((l) => ({
        name: l?.name ?? "",
        value: l?.value ?? 0,
        avg: l?.avg ?? 0,
      })),
    }));
    finalJson.bodyLevels = (masterJson.bodyLevels ?? []).filter(
      (x): x is string => !!x
    );
    finalJson.landmarks = (masterJson.landmarks ?? []).filter(
      (x): x is string => !!x
    );
    finalJson.criticalMeasurement = masterJson.criticalMeasurement ?? [];
    handleAllTrialFits();
  } catch (err) {
    console.error("Failed to import JSON:", err);
  }
};

(window as any).saveBodyJson = () => {
  console.log(finalJson);
  if (!finalJson.fileName) {
    console.error("No filename available for saving");
    return;
  }

  const json = JSON.stringify(finalJson, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${getCurrentDateYYYYMMDD()}-Fit Analysis-${
    masterJson.fitName
  }-${masterJson.body?.bodyName}`;
  link.click();

  URL.revokeObjectURL(url);
};

// window.loadFit = () => handleAllTrialFits();
