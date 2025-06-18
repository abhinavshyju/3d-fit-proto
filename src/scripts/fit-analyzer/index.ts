import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { loadModel } from "../loadModel";
import { importMasterJsonFromFile } from "./import-master-json";
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

Chart.register(
  ScatterController,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MasterJson {
  fileName: string;
  value: Array<{
    levelName: string;
    bodyIntersectionPoints: THREE.Vector3[];
    dressIntersectionPoints: THREE.Vector3[];
    landmarks: Array<{
      name: string;
      point: THREE.Vector3;
      dis: number;
      value: number;
      avg: number;
    }>;
  }>;
  bodyLevels: string[];
  landmarkPoints: string[];
  criticalMeasurement: Array<{
    level: string;
    landmark: string;
    critical: boolean;
  }>;
  garments: Array<{
    garmentName: string;
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
  }>;
}

interface finaljson {
  fileName: string;
  models: Array<{
    name: string;
    body: boolean;
    model: THREE.Object3D<THREE.Object3DEventMap>;
  }>;
  value: Array<{
    levelName: string;
    bodyIntersectionPoints: THREE.Vector3[];
    dressIntersectionPoints: THREE.Vector3[];
    landmarks: Array<{
      name: string;
      point: THREE.Vector3;
      dis: number;
      value: number;
      avg: number;
    }>;
  }>;
  bodyLevels: string[];
  landmarkPoints: string[];
  criticalMeasurement: Array<{
    level: string;
    landmark: string;
    critical: boolean;
  }>;
  trails: Array<{
    trailname: string;
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
  }>;
}

let masterJson: MasterJson;
let finalJson: finaljson = {
  fileName: "",
  models: [],
  bodyLevels: [],
  criticalMeasurement: [],
  landmarkPoints: [],
  trails: [],
  value: [],
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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
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

function handleModelUpload(
  event: Event,
  type: "body" | "trial1" | "trial2" | "trial3"
) {
  const scene = type === "body" ? bodySceneT.getScene() : trialMap[type].scene;
  loadModel(event, scene, type, (model, _fileName) => {
    if (type === "body") {
      bodyModel = model;
      rBodyViewPort.getScene().add(model.clone(true));
      finalJson.models.push({
        name: "body",
        body: true,
        model: model,
      });
    } else {
      trialMap[type].model = model;
      trialMap[type].sceneTwo.add(model.clone(true));
      finalJson.models.push({
        body: false,
        name: type,
        model: model,
      });
    }
  });
}

function handleAllTrialFits() {
  if (loaded) return;
  finalJson.fileName = masterJson.fileName;
  finalJson.bodyLevels = masterJson.bodyLevels;
  finalJson.landmarkPoints = masterJson.landmarkPoints;
  finalJson.value = masterJson.value;
  finalJson.criticalMeasurement = masterJson.criticalMeasurement;

  ["trial1", "trial2", "trial3"].forEach((trialKey) => {
    const trial = trialMap[trialKey];
    if (!trial.model) return;

    const input = {
      trailname: trialKey,
      levels: [] as finaljson["trails"][0]["levels"],
    };

    masterJson.value.forEach((item) => {
      const points = item.bodyIntersectionPoints;
      if (points.length < 3) return;

      const len = points.length;
      const p1 = points[Math.floor(Math.random() * (len / 3))];
      const p2 =
        points[Math.floor(len / 3) + Math.floor(Math.random() * (len / 3))];
      const p3 =
        points[
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

      const pointsMapped = item.landmarks.map((landmark) => {
        const nearest = intersections.reduce(
          (nearest, point) => {
            const dist = point.distanceTo(landmark.point);
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
          bodyPoint: landmark.point,
          dressPoint: nearest.point,
          distance: nearest.distance,
          color: "red",
        };
      });

      input.levels.push({
        name: item.levelName,
        bodyIntersectionPoints: points,
        dressIntersectionPoints: intersections,
        points: pointsMapped,
      });
    });

    finalJson.trails.push(input);
  });
  loaded = true;
  createChartsPerLevel(finalJson);
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

export function createChartsPerLevel(data: finaljson): void {
  const container = document.getElementById("chartsContainer");
  if (!container) return;

  container.innerHTML = "";

  const canvasSize = { width: 400, height: 400 };

  data.value.forEach((level, levelIndex) => {
    const levelName = level.levelName;

    // Wrapper for chart with fixed dimensions
    const wrapper = document.createElement("div");
    wrapper.style.width = `${canvasSize.width}px`;
    wrapper.style.height = `${canvasSize.height}px`;
    wrapper.style.marginBottom = "40px";

    const canvas = document.createElement("canvas");
    canvas.id = `chart-${levelIndex}`;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const h1 = document.createElement("h1");
    h1.innerText = levelName.toUpperCase();
    wrapper.appendChild(h1);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const baseDataset = {
      label: "Base",
      data: level.dressIntersectionPoints.map((p) => ({ x: p.x, y: p.z })),
      borderColor: "blue",
      showLine: true,
      pointRadius: 0,
      borderWidth: 2,
      pointHitRadius: 0,
    };

    const bodyDataset = {
      label: "Body",
      data: level.bodyIntersectionPoints.map((p) => ({ x: p.x, y: p.z })),
      borderColor: "red",
      showLine: true,
      pointRadius: 0,
      borderWidth: 2,
      pointHitRadius: 0,
    };

    const trailDatasets =
      data.trails?.map((trail) => ({
        label: trail.trailname,
        data: (
          trail.levels.find((lvl) => lvl.name === levelName)
            ?.dressIntersectionPoints || []
        ).map((p) => ({ x: p.x, y: p.z })),
        borderColor: "yellow",
        showLine: true,
        pointRadius: 0,
        borderWidth: 2,
        pointHitRadius: 0,
      })) || [];
    console.log(trailDatasets);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [baseDataset, bodyDataset, ...trailDatasets],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "linear",
            min: -2,
            max: 2,
            reverse: true,
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            ticks: {
              display: true,
              color: "rgba(0, 0, 0, 0.7)",
            },
          },
          y: {
            min: -2,
            max: 2,
            reverse: true,
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.1)",
              lineWidth: 1,
            },
            ticks: {
              display: true,
              color: "rgba(0, 0, 0, 0.7)",
            },
          },
        },
      },
    });
  });
  setFinalJson(finalJson);
}

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
  } catch (err) {
    console.error("Failed to import JSON:", err);
  }
};

window.loadFit = () => handleAllTrialFits();
