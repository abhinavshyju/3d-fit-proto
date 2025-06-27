import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Retrieve the JSON data passed from the Astro component
const masterJsonElem = document.getElementById("master-json-data");
if (!masterJsonElem || !masterJsonElem.textContent) {
  throw new Error("Master JSON data element not found or empty");
}
const data = JSON.parse(masterJsonElem.textContent);

let scene;
let camera;
let renderer;
let controls;
let raycaster;

// Array to hold objects that can be selected by the rectangular selection tool
let selectableObjects = [];

// Variables for the rectangular selection tool
let isSelecting = false;
let selectionBox = null;
let startMousePosition = new THREE.Vector2();

function init() {
  const canvas = document.getElementById("three-canvas");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x303030);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 50, 50);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);
  raycaster = new THREE.Raycaster();
  populateScene(data);
  window.addEventListener("resize", onWindowResize, false);
  setupRecSelectTool(canvas);
  setupUIControls();
  animate();
}

function populateScene(data) {
  // Remove all children except selectionBox
  scene.children.forEach((child) => {
    if (child.name !== "selectionBox") {
      scene.remove(child);
      if (
        (child instanceof THREE.Mesh ||
          child instanceof THREE.Points ||
          child instanceof THREE.Line) &&
        child.geometry
      ) {
        child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    }
  });
  selectableObjects = [];
  // Body
  if (data.body && data.body.levels) {
    const bodyGroup = new THREE.Group();
    bodyGroup.name = "body-group";
    data.body.levels.forEach((level) => {
      if (level && level.intersectionPoints) {
        const pointsGeometry = new THREE.BufferGeometry().setFromPoints(
          level.intersectionPoints
        );
        const pointsMaterial = new THREE.PointsMaterial({
          color: 0x00ff00,
          size: 0.2,
          sizeAttenuation: true,
        });
        const pointsObject = new THREE.Points(pointsGeometry, pointsMaterial);
        pointsObject.userData = {
          type: "level-intersection",
          name: level.name,
          level: level.name,
        };
        bodyGroup.add(pointsObject);
        selectableObjects.push(pointsObject);
      }
      if (level && level.landmarks) {
        level.landmarks.forEach((landmark) => {
          if (landmark && landmark.point) {
            const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
            const sphereMaterial = new THREE.MeshBasicMaterial({
              color: new THREE.Color(landmark.color || 0xff0000),
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy(landmark.point);
            sphere.userData = {
              type: "landmark",
              name: landmark.name,
              level: level.name,
            };
            bodyGroup.add(sphere);
            selectableObjects.push(sphere);
          }
        });
      }
    });
    scene.add(bodyGroup);
  }
  // Trails
  if (data.trails) {
    const trailsGroup = new THREE.Group();
    trailsGroup.name = "trails-group";
    data.trails.forEach((trail) => {
      if (trail && trail.levels) {
        trail.levels.forEach((level) => {
          if (level && level.intersectionPoints) {
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(
              level.intersectionPoints
            );
            const lineMaterial = new THREE.LineBasicMaterial({
              color: 0xffff00,
              linewidth: 2,
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = {
              type: "trail",
              name: trail.trailName,
              level: level.name,
            };
            trailsGroup.add(line);
            selectableObjects.push(line);
          }
        });
      }
    });
    scene.add(trailsGroup);
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function setupUIControls() {
  const viewSelect = document.getElementById("view-select");
  const levelSelect = document.getElementById("level-select");
  const trailToggle = document.getElementById("trail-toggle");
  const bodyToggle = document.getElementById("body-toggle");
  const addPointBtn = document.getElementById("add-point-btn");

  viewSelect.addEventListener("change", (event) => {
    const view = event.target.value;
    const distance = camera.position.length();
    switch (view) {
      case "top":
        camera.position.set(0, distance, 0);
        break;
      case "bottom":
        camera.position.set(0, -distance, 0);
        break;
      case "front":
        camera.position.set(0, 0, distance);
        break;
      case "back":
        camera.position.set(0, 0, -distance);
        break;
      case "left":
        camera.position.set(-distance, 0, 0);
        break;
      case "right":
        camera.position.set(distance, 0, 0);
        break;
      case "default":
      default:
        camera.position.set(0, 50, 50);
        break;
    }
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    controls.target.set(0, 0, 0);
    controls.update();
  });

  levelSelect.addEventListener("change", (event) => {
    const selectedLevelName = event.target.value;
    scene.traverse((object) => {
      if (
        object.userData &&
        (object.userData.type === "level-intersection" ||
          object.userData.type === "landmark")
      ) {
        if (selectedLevelName === "all") {
          object.visible = true;
        } else {
          object.visible = object.userData.level === selectedLevelName;
        }
      }
    });
  });

  trailToggle.addEventListener("change", (event) => {
    const trailsGroup = scene.getObjectByName("trails-group");
    if (trailsGroup) {
      trailsGroup.visible = !event.target.checked;
    }
  });

  bodyToggle.addEventListener("change", (event) => {
    const bodyGroup = scene.getObjectByName("body-group");
    if (bodyGroup) {
      bodyGroup.visible = !event.target.checked;
    }
  });

  addPointBtn.addEventListener("click", () => {
    const x = Math.random() * 20 - 10;
    const y = Math.random() * 20 - 10;
    const z = Math.random() * 20 - 10;
    addPoint(x, y, z, Math.random() * 0xffffff);
  });
}

function setupRecSelectTool(canvas) {
  canvas.addEventListener("mousedown", onMouseDown, false);
  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("mouseup", onMouseUp, false);
  selectionBox = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    })
  );
  selectionBox.name = "selectionBox";
  selectionBox.visible = false;
  scene.add(selectionBox);

  function onMouseDown(event) {
    if (event.button === 0) {
      isSelecting = true;
      startMousePosition.set(event.clientX, event.clientY);
      selectionBox.visible = true;
      controls.enabled = false;
    }
  }
  function onMouseMove(event) {
    if (!isSelecting) return;
    const endMousePosition = new THREE.Vector2(event.clientX, event.clientY);
    const rect = canvas.getBoundingClientRect();
    const startX = startMousePosition.x;
    const startY = startMousePosition.y;
    const endX = endMousePosition.x;
    const endY = endMousePosition.y;
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;
    const topLeftNDC = new THREE.Vector3(
      (Math.min(startX, endX) / rect.width) * 2 - 1,
      -(Math.max(startY, endY) / rect.height) * 2 + 1,
      -1
    );
    const bottomRightNDC = new THREE.Vector3(
      (Math.max(startX, endX) / rect.width) * 2 - 1,
      -(Math.min(startY, endY) / rect.height) * 2 + 1,
      -1
    );
    topLeftNDC.unproject(camera);
    bottomRightNDC.unproject(camera);
    const worldWidth = Math.abs(topLeftNDC.x - bottomRightNDC.x);
    const worldHeight = Math.abs(topLeftNDC.y - bottomRightNDC.y);
    selectionBox.scale.set(worldWidth, worldHeight, 1);
    selectionBox.position.set(
      (topLeftNDC.x + bottomRightNDC.x) / 2,
      (topLeftNDC.y + bottomRightNDC.y) / 2,
      (topLeftNDC.z + bottomRightNDC.z) / 2
    );
    selectionBox.quaternion.copy(camera.quaternion);
  }
  function onMouseUp(event) {
    if (!isSelecting) return;
    isSelecting = false;
    controls.enabled = true;
    selectionBox.visible = false;
    const endMousePosition = new THREE.Vector2(event.clientX, event.clientY);
    const rect = canvas.getBoundingClientRect();
    const selectionRect = {
      minX: Math.min(startMousePosition.x, endMousePosition.x),
      maxX: Math.max(startMousePosition.x, endMousePosition.x),
      minY: Math.min(startMousePosition.y, endMousePosition.y),
      maxY: Math.max(startMousePosition.y, endMousePosition.y),
    };
    const selectedObjects = [];
    selectableObjects.forEach((object) => {
      // Only Mesh, Points, or Line have geometry
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line
      ) {
        if (!object.geometry.boundingSphere) {
          object.geometry.computeBoundingSphere();
        }
        if (!object.geometry.boundingSphere) return;
        let worldPosition = new THREE.Vector3();
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          worldPosition.copy(object.position);
        } else if (object instanceof THREE.Line) {
          object.geometry.computeBoundingBox();
          if (object.geometry.boundingBox) {
            worldPosition.copy(
              object.geometry.boundingBox.getCenter(new THREE.Vector3())
            );
            object.localToWorld(worldPosition);
          } else {
            return;
          }
        }
        const screenPosition = worldPosition.clone().project(camera);
        const screenX = (screenPosition.x * 0.5 + 0.5) * rect.width;
        const screenY = (-screenPosition.y * 0.5 + 0.5) * rect.height;
        if (
          screenX >= selectionRect.minX &&
          screenX <= selectionRect.maxX &&
          screenY >= selectionRect.minY &&
          screenY <= selectionRect.maxY
        ) {
          selectedObjects.push(object);
        }
      }
    });
    removeSelectedPoints(selectedObjects);
  }
  function removeSelectedPoints(objectsToRemove) {
    objectsToRemove.forEach((object) => {
      const parent = object.parent;
      if (parent) {
        parent.remove(object);
        if (
          (object instanceof THREE.Mesh ||
            object instanceof THREE.Points ||
            object instanceof THREE.Line) &&
          object.geometry
        ) {
          object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((m) => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      }
    });
    selectableObjects = selectableObjects.filter(
      (obj) => !objectsToRemove.includes(obj)
    );
  }
}

function addPoint(x, y, z, color = 0xff0000) {
  const geometry = new THREE.SphereGeometry(0.15, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(x, y, z);
  sphere.userData = { type: "added-point", name: `ManualPoint_${Date.now()}` };
  scene.add(sphere);
  selectableObjects.push(sphere);
}

// Run init on client
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    init();
  });
}
