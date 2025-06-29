import * as THREE from "three";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark {
  point: Point3D;
  name?: string;
}

export interface Point {
  id: string;
  position: Point3D;
  type: "body" | "garment" | "landmark";
  level: string;
  trial?: string;
  metadata?: {
    isGenerated?: boolean;
    originalIndex?: number;
    curveId?: string;
    originalPosition?: Point3D;
    landmarkName?: string;
  };
}

export interface Curve {
  id: string;
  type: "spline" | "bezier" | "linear";
  controlPoints: Point2D[];
  generatedPoints: Point2D[];
  level: string;
  trial?: string;
}

export interface LevelData {
  name: string;
  intersectionPoints?: Point3D[];
  landmarks?: Landmark[];
  curves?: Curve[];
  generatedPoints?: Point3D[];
}

export interface Trail {
  trailName: string;
  levels: LevelData[];
}

export interface BodyData {
  levels: LevelData[];
}

export interface JSONData {
  fileName: string;
  body: BodyData;
  trails: Trail[];
}

export interface FilteredPoint {
  type: "body" | "garment" | "landmark";
  point: Point3D;
  level: string;
  trial?: string;
  landmarkName?: string;
}

export interface SelectedPoint {
  geometryIndex: number;
  pointsMesh: THREE.Points;
  originalDataRef: FilteredPoint;
}

export interface PointEditOperation {
  type: "add" | "delete" | "edit" | "generate";
  pointId?: string;
  position?: Point3D;
  level: string;
  trial?: string;
  pointType: "body" | "garment" | "landmark";
}

export interface CurveGenerationOptions {
  type: "spline" | "bezier" | "linear";
  spacing: number; // mm
  divisions: number; // for body division
  level: string;
  trial?: string;
}

export enum InteractionMode {
  NONE = "none",
  MEASURE = "measure",
  SELECT = "select",
  ADD_POINT = "add_point",
  EDIT_POINT = "edit_point",
  CREATE_CURVE = "create_curve",
  GENERATE_POINTS = "generate_points",
}
