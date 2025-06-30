export interface Point3D {
  x: number;
  y: number;
  z: number;
  id: string;
  label?: string;
}

export interface AlignmentPair {
  bodyPoint: Point3D;
  garmentPoint: Point3D;
  confidence?: number;
}

export interface Transform {
  translation: Point3D;
  rotation: Point3D;
  scale: Point3D;
}

export interface ScanModel {
  id: string;
  name: string;
  file?: File;
  mesh?: THREE.Mesh;
  points?: Point3D[];
}

export interface AlignmentSettings {
  autoAlign: boolean;
  showWireframe: boolean;
  transparency: number;
  showPoints: boolean;
  snapToGrid: boolean;
  gridSize: number;
}