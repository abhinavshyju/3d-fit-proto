import { atom } from "nanostores";
import * as THREE from "three";
import type { MasterJson } from "../type";

// Store
export const finalJsonStore = atom<MasterJson | null>(null);

// Actions
export const setFinalJson = (data: MasterJson | null) => {
  finalJsonStore.set(data);
};

export const updateFinalJson = (
  updater: (current: MasterJson) => MasterJson
) => {
  const current = finalJsonStore.get();
  if (current) {
    finalJsonStore.set(updater(current));
  }
};
