import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

export interface LoadedModel {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  boundingBox: THREE.Box3;
}

export async function loadModelFile(file: File): Promise<LoadedModel> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const fileContent = await file.arrayBuffer();
  
  let geometry: THREE.BufferGeometry;
  
  switch (extension) {
    case 'obj':
      geometry = await loadOBJ(fileContent);
      break;
    case 'stl':
      geometry = await loadSTL(fileContent);
      break;
    case 'ply':
      geometry = await loadPLY(fileContent);
      break;
    default:
      throw new Error(`Unsupported file format: ${extension}`);
  }
  
  // Compute normals if they don't exist
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  
  // Compute bounding box first
  geometry.computeBoundingBox();
  const boundingBox = geometry.boundingBox!;
  const size = boundingBox.getSize(new THREE.Vector3());
  const center = boundingBox.getCenter(new THREE.Vector3());
  
  // Scale the model to appropriate human size (assuming 1.75m height)
  const targetHeight = 1.75; // 175cm in meters
  const currentHeight = size.y;
  const scaleFactor = targetHeight / currentHeight;
  
  // Apply scaling
  geometry.scale(scaleFactor, scaleFactor, scaleFactor);
  
  // Recalculate bounding box after scaling
  geometry.computeBoundingBox();
  const newBoundingBox = geometry.boundingBox!;
  const newCenter = newBoundingBox.getCenter(new THREE.Vector3());
  
  // Center the geometry and position it on the ground
  geometry.translate(-newCenter.x, -newBoundingBox.min.y, -newCenter.z);
  
  // Create a standard material
  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    side: THREE.DoubleSide,
  });
  
  return {
    geometry,
    material,
    boundingBox: newBoundingBox
  };
}

async function loadOBJ(arrayBuffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const loader = new OBJLoader();
  const text = new TextDecoder().decode(arrayBuffer);
  const object = loader.parse(text);
  
  // Extract geometry from the first mesh found
  let geometry: THREE.BufferGeometry | null = null;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      geometry = child.geometry as THREE.BufferGeometry;
    }
  });
  
  if (!geometry) {
    throw new Error('No geometry found in OBJ file');
  }
  
  return geometry;
}

async function loadSTL(arrayBuffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const loader = new STLLoader();
  return loader.parse(arrayBuffer);
}

async function loadPLY(arrayBuffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const loader = new PLYLoader();
  return loader.parse(arrayBuffer);
}

export function createModelMaterial(color: string, wireframe: boolean, transparency: number): THREE.Material {
  return new THREE.MeshStandardMaterial({
    color,
    wireframe,
    transparent: transparency < 1,
    opacity: transparency,
    side: THREE.DoubleSide,
  });
}