import { importMasterJsonFromFile } from "./import-master-json";
import * as THREE from "three";
let load = false;
interface MasterJson {
  fileName: string;
  fitName: string;
  tolerance: number;
  subcategory: string;
  date: string;
  category: string;
  version: string;
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

const masterJson: MasterJson = {
  fileName: "",
  category: "",
  date: "",
  fitName: "",
  subcategory: "",
  tolerance: 0,
  version: "",
  criticalMeasurement: [],
  bodyLevels: [],
  value: [],
  landmarkPoints: [],
  garments: [],
};

const handleGarmentUpload = async (event: Event, garmentIndex: number) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const json = await importMasterJsonFromFile(file);
    if (garmentIndex === 0) {
      masterJson.fileName = file.name.replace(".json", "");
      masterJson.bodyLevels = json.bodyLevels;
      masterJson.landmarkPoints = json.landmarkPoints;
    }

    masterJson.garments[garmentIndex] = {
      garmentName: json.garmentName,
      levels: json.levels,
    };
  } catch (err) {
    console.error("Failed to import JSON:", err);
  }
};

(window as any).garmentOneUpload = (e: Event) => handleGarmentUpload(e, 0);
(window as any).garmentTwoUpload = (e: Event) => handleGarmentUpload(e, 1);
(window as any).garmentThreeUpload = (e: Event) => handleGarmentUpload(e, 2);

(window as any).loadMeasurement = () => {
  masterJson.value = [];
  load = true;

  masterJson.bodyLevels.forEach((level) => {
    const bodyPointsAll: THREE.Vector3[][] = [];
    const dressPointsAll: THREE.Vector3[][] = [];

    masterJson.garments.forEach((garment) => {
      const lvl = garment.levels.find((l) => l.name === level);
      if (lvl) {
        bodyPointsAll.push(lvl.bodyIntersectionPoints);
        dressPointsAll.push(lvl.dressIntersectionPoints);
      } else {
        bodyPointsAll.push([]);
        dressPointsAll.push([]);
      }
    });

    const avgVectorArray = (
      vectorsList: THREE.Vector3[][]
    ): THREE.Vector3[] => {
      const maxLength = Math.max(...vectorsList.map((v) => v.length));
      const averages: THREE.Vector3[] = [];

      for (let i = 0; i < maxLength; i++) {
        let sum = new THREE.Vector3(0, 0, 0);
        let count = 0;

        vectorsList.forEach((arr) => {
          if (arr[i]) {
            sum.add(arr[i].clone());
            count++;
          }
        });

        averages.push(
          count > 0 ? sum.divideScalar(count) : new THREE.Vector3(0, 0, 0)
        );
      }

      return averages;
    };

    const avgBodyIntersections = avgVectorArray(bodyPointsAll);
    const avgDressIntersections = avgVectorArray(dressPointsAll);

    const landmarks = masterJson.landmarkPoints.map((landmark) => {
      const distances: number[] = [];
      const points: THREE.Vector3[] = [];

      masterJson.garments.forEach((garment) => {
        const levelObj = garment.levels.find((l) => l.name === level);
        const pointObj = levelObj?.points.find((p) => p.name === landmark);

        if (pointObj) {
          distances.push(pointObj.distance);
          points.push(pointObj.bodyPoint);
        } else {
          distances.push(0);
          points.push(new THREE.Vector3(0, 0, 0));
        }
      });

      const avgDistance = Number(
        (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(2)
      );

      const avgPoint = points
        .reduce((sum, p) => sum.add(p.clone()), new THREE.Vector3(0, 0, 0))
        .divideScalar(points.length);

      return {
        name: landmark,
        point: avgPoint,
        dis: distances[0],
        value: distances[0],
        avg: avgDistance,
      };
    });

    masterJson.value.push({
      levelName: level,
      bodyIntersectionPoints: avgBodyIntersections,
      dressIntersectionPoints: avgDressIntersections,
      landmarks,
    });
  });

  const tableBody = document.getElementById("measurementTable");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  masterJson.bodyLevels.forEach((level) => {
    masterJson.landmarkPoints.forEach((landmark) => {
      const distances = masterJson.garments.map(
        (g) =>
          g?.levels
            .find((l) => l.name === level)
            ?.points.find((p) => p.name === landmark)?.distance ?? 0
      );
      const average = (distances.reduce((a, b) => a + b, 0) / 3).toFixed(2);
      const isCritical = masterJson.criticalMeasurement.some(
        (m) => m.level === level && m.landmark === landmark && m.critical
      );

      const row = document.createElement("tr");
      row.className = "bg-white";
      row.innerHTML = `
        <td class="px-4 py-3">${level.toUpperCase()}</td>
        <td class="px-4 py-3">${landmark.toUpperCase()}</td>
        <td class="px-4 py-3 text-center">
          <input type="checkbox" class="h-4 w-4" ${
            isCritical ? "checked" : ""
          } data-level="${level}" data-landmark="${landmark}" onchange="updateCriticalValue(this)" />
        </td>
        ${[0, 1, 2]
          .map(
            (i) => `
        <td class="px-4 py-3">
          <input
            type="number"
            value="${distances[i].toFixed(2)}"
            class="w-16 text-sm text-center border px-2 py-1 rounded"
            readonly
          />
        </td>`
          )
          .join("")}
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">${average}</span>
        </td>
        <td class="px-4 py-3">
          <input
            type="number"
            value="${average}"
            class="w-16 text-sm text-center border px-2 py-1 rounded"
            onchange="updateValue(event)"
            
          />
        </td>
      `;
      tableBody.appendChild(row);
    });
  });
};

(window as any).updateCriticalValue = (checkbox: HTMLInputElement) => {
  const level = checkbox.dataset.level!;
  const landmark = checkbox.dataset.landmark!;

  const existing = masterJson.criticalMeasurement.find(
    (m) => m.level === level && m.landmark === landmark
  );

  if (existing) {
    existing.critical = checkbox.checked;
  } else {
    masterJson.criticalMeasurement.push({
      level,
      landmark,
      critical: checkbox.checked,
    });
  }
};
(window as any).updateValue = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const newValue = parseFloat(input.value);

  if (isNaN(newValue)) return;

  const row = input.closest("tr");
  if (!row) return;

  const level = row
    .querySelector('input[type="checkbox"]')
    ?.getAttribute("data-level");
  const landmark = row
    .querySelector('input[type="checkbox"]')
    ?.getAttribute("data-landmark");

  if (!level || !landmark) return;

  const levelEntry = masterJson.value.find((v) => v.levelName === level);
  if (!levelEntry) return;

  const landmarkEntry = levelEntry.landmarks.find((l) => l.name === landmark);
  if (!landmarkEntry) return;

  landmarkEntry.value = newValue;
};

(window as any).saveMasterJsonToFile = () => {
  if (!load) return;
  const jsonStr = JSON.stringify(masterJson, null, 2);

  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${masterJson.fileName || "master"}_fit_measurement.json`;
  a.click();

  URL.revokeObjectURL(url);
};
