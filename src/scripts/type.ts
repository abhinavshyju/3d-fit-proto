import type { Vector3 } from "three";

export interface Landmark {
  name: string | null;
  point: Vector3 | null;
  color: string | null;
  distance?: number | null;
}

export interface Level {
  name: string | null;
  intersectionPoints: Vector3[] | null;
  landmarks: (Landmark | null)[] | null;
}

export interface Body {
  bodyName: string | null;
  levels: (Level | null)[] | null;
}

export interface ValueLandmark {
  name: string | null;
  value: number | null;
  avg: number | null;
}

export interface ValueEntry {
  levelName: string | null;
  landmarks: (ValueLandmark | null)[] | null;
}

export interface TrailLevel extends Level {}

export interface Trail {
  trailName: string | null;
  levels: (TrailLevel | null)[] | null;
}

export interface MasterJson {
  fileName: string | null;
  category: string | null;
  date: string | null;
  fitName: string | null;
  subcategory: string | null;
  tolerance: number | null;
  version: string | null;
  unit: number | null;
  criticalMeasurement: Array<{
    level: string;
    landmark: string;
    critical: boolean;
  }> | null;
  landmarks: string[] | null;
  bodyLevels: (string | null)[] | null;
  body: Body | null;
  value: (ValueEntry | null)[] | null;
  trails: (Trail | null)[] | null;
  garment: {
    name: string;
    levels: (Level | null)[] | null;
  } | null;
}
