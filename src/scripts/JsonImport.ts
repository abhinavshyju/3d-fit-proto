import type { MasterJson } from "./type";

export async function importMasterJsonFromFile(
  file: File
): Promise<MasterJson> {
  return new Promise<MasterJson>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        resolve(json as MasterJson);
      } catch (err) {
        reject(new Error("Invalid JSON file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the file."));
    };

    reader.readAsText(file);
  });
}
