import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
// -----------------------
// Setup scene, camera, renderer, and controls
// -----------------------
export const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color(0xededed);

export const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
const viewPort: HTMLElement | null = document.getElementById("viewPort");
if (viewPort) viewPort.appendChild(renderer.domElement);

const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// -----------------------
// Lighting setup
// -----------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const directionalLight1 = new THREE.DirectionalLight(0xffffff);
directionalLight1.position.set(5, 10, 7.5);
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffffff);
directionalLight2.position.set(5, 10, -7.5);
scene.add(directionalLight2);

const directionalLight3 = new THREE.DirectionalLight(0xffffff);
directionalLight3.position.set(-5, 10, 7.5);
scene.add(directionalLight3);

const directionalLight4 = new THREE.DirectionalLight(0xffffff);
directionalLight4.position.set(-5, 10, -7.5);
scene.add(directionalLight4);

// -----------------------
// Animation loop
// -----------------------
function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
