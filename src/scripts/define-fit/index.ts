import { importMasterJsonFromFile } from "../JsonImport";
import type { Level, MasterJson } from "../type";

import * as THREE from "three";
import { getCurrentDateYYYYMMDD } from "../utils";
let load = false;

const masterJson: MasterJson = {
  fileName: null,
  body: {
    bodyName: null,
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
  unit: null,
  criticalMeasurement: [],
  value: [],
  trails: null,
  garment: {
    name: "",
    levels: [],
  },
};
const garmentTemp: {
  garmentName: string;
  levels: (Level | null)[] | null;
}[] = [];
const handleGarmentUpload = async (event: Event, garmentIndex: number) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const json = await importMasterJsonFromFile(file);
    if (garmentIndex === 0) {
      masterJson.fileName = file.name.replace(".json", "");
      masterJson.bodyLevels = json.bodyLevels;
      masterJson.landmarks = json.landmarks;
      masterJson.body = json.body;
      masterJson.unit = json.unit;
    }

    garmentTemp[garmentIndex] = {
      garmentName: json.garment?.name || "",
      levels: json.garment?.levels || [],
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

  if (!masterJson.bodyLevels) return;
  masterJson.bodyLevels.forEach((level) => {
    if (!level) return;
    if (!masterJson.landmarks) return;
    const landmarks = masterJson.landmarks
      .map((landmark) => {
        if (!landmark) return null;
        const distances: number[] = [];
        const points: THREE.Vector3[] = [];

        garmentTemp.forEach((garment) => {
          if (!garment.levels) return;
          const levelObj = garment.levels.find((l) => l && l.name === level);
          if (!levelObj?.landmarks) return;
          const pointObj = levelObj.landmarks.find(
            (p) => p && p.name === landmark
          );

          if (pointObj && pointObj.distance) {
            distances.push(pointObj.distance);
          } else {
            distances.push(0);
            points.push(new THREE.Vector3(0, 0, 0));
          }
        });

        const avgDistance =
          distances.length > 0
            ? Number(distances.reduce((a, b) => a + b, 0) / distances.length)
            : 0;

        const avgPoint =
          points.length > 0
            ? points
                .reduce(
                  (sum, p) => sum.add(p.clone()),
                  new THREE.Vector3(0, 0, 0)
                )
                .divideScalar(points.length)
            : new THREE.Vector3(0, 0, 0);

        return {
          name: landmark,
          point: avgPoint,
          dis: avgDistance,
          value: avgDistance,
          avg: avgDistance,
        };
      })
      .filter(Boolean);
    if (!masterJson.value) return;
    masterJson.value.push({
      levelName: level,
      landmarks,
    });
  });

  const tableBody = document.getElementById("measurementTable");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  masterJson.bodyLevels.forEach((level) => {
    if (!level) return;
    masterJson.landmarks?.forEach((landmark) => {
      if (!landmark) return;
      const distances = garmentTemp.map((g) => {
        const foundLevel = g?.levels?.find((l) => l && l.name === level);
        return (
          foundLevel?.landmarks?.find((p) => p && p.name === landmark)
            ?.distance ?? 0
        );
      });
      const average = (
        distances.reduce((a, b) => a + b, 0) / (distances.length || 1)
      ).toFixed(2);
      const isCritical =
        Array.isArray(masterJson.criticalMeasurement) &&
        masterJson.criticalMeasurement.some(
          (m) => m.level === level && m.landmark === landmark && m.critical
        );

      const row = document.createElement("tr");
      row.className = "bg-white";
      row.innerHTML = `
        <td class="px-4 py-3">${
          typeof level === "string" ? level.toUpperCase() : level
        }</td>
        <td class="px-4 py-3">${
          typeof landmark === "string" ? landmark.toUpperCase() : landmark
        }</td>
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
            value="${
              distances[i] !== undefined ? distances[i].toFixed(2) : "0.00"
            }"
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

  if (!Array.isArray(masterJson.criticalMeasurement))
    masterJson.criticalMeasurement = [];

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

  if (!Array.isArray(masterJson.value)) return;
  const levelEntry = masterJson.value.find((v) => v && v.levelName === level);
  if (!levelEntry || !Array.isArray(levelEntry.landmarks)) return;

  const landmarkEntry = levelEntry.landmarks.find(
    (l) => l && l.name === landmark
  );
  if (!landmarkEntry) return;

  landmarkEntry.value = newValue;
};

(window as any).saveMasterJsonToFile = async () => {
  await loadInputDataToMasterJson();
  if (!load) return;
  const jsonStr = JSON.stringify(masterJson, null, 2);

  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${getCurrentDateYYYYMMDD()}-Fit Defintion-${
    masterJson.fitName
  }.json`;
  a.click();

  URL.revokeObjectURL(url);
};

// Loads the form input data into masterJson
function loadInputDataToMasterJson() {
  const formInputs = document.querySelectorAll(
    ".bg-white.rounded-lg.shadow-sm.p-6 input"
  ) as NodeListOf<HTMLInputElement>;

  if (formInputs.length < 7) return;
  masterJson.category = formInputs[0].value;
  masterJson.subcategory = formInputs[1].value;
  masterJson.fitName = formInputs[2].value;

  masterJson.date = formInputs[4].value;
  masterJson.tolerance = Number(formInputs[5].value) || 0;
  masterJson.version = formInputs[6].value;
  console.log(masterJson);
}
