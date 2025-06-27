import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// No TypeScript interfaces here, as this is a JS/JSX file.
// We will rely on runtime object structures matching your MasterJson.

const PointCloudViewer = () => {
  // Refs for Three.js objects
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const pointsGroupRef = useRef(null);
  const raycasterRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());

  // State for application logic
  const [originalData, setOriginalData] = useState(null);
  const [filteredPointsForDisplay, setFilteredPointsForDisplay] = useState([]);
  const [currentLevelFilter, setCurrentLevelFilter] = useState('all');
  const [activeTool, setActiveTool] = useState(null); // 'measure', 'select', 'add'
  const [infoMessage, setInfoMessage] = useState('Distance: N/A');
  const [modalMessage, setModalMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Measurement states
  const firstMeasurementPointRef = useRef(null);
  const measurementLineRef = useRef(null);

  // Selection states
  const selectionRectMeshRef = useRef(null);
  const startSelectPointRef = useRef(new THREE.Vector2());
  const currentMousePointRef = useRef(new THREE.Vector2());
  const selectedPointsRef = useRef([]); // Stores { geometryIndex, pointsMesh, originalFilteredData }

  // Visibility states
  const [showBodyIntersection, setShowBodyIntersection] = useState(true);
  const [showGarmentIntersection, setShowGarmentIntersection] = useState(true);
  const [showLandmark, setShowLandmark] = useState(true);
  const [showTrailIntersection, setShowTrailIntersection] = useState(true);
  const [showTrailLandmark, setShowTrailLandmark] = useState(true);

  // --- Utility Functions ---

  const showMessage = useCallback((message) => {
    setModalMessage(message);
    setShowModal(true);
  }, []);

  const clearMeasurementLine = useCallback(() => {
    if (measurementLineRef.current) {
      sceneRef.current.remove(measurementLineRef.current);
      measurementLineRef.current.geometry.dispose();
      (measurementLineRef.current.material).dispose();
      measurementLineRef.current = null;
    }
  }, []);

  const clearSelectionRectangle = useCallback(() => {
    if (selectionRectMeshRef.current) {
      sceneRef.current.remove(selectionRectMeshRef.current);
      selectionRectMeshRef.current.geometry.dispose();
      (selectionRectMeshRef.current.material).dispose();
      selectionRectMeshRef.current = null;
    }
  }, []);

  const createSelectionRectangle = useCallback((start, end) => {
    const material = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
    });
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(5 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 5);
    const mesh = new THREE.LineLoop(geometry, material);
    mesh.renderOrder = 999;
    mesh.material.depthTest = false;
    return mesh;
  }, []);

  const updateSelectionRectangle = useCallback((start, current) => {
    if (!selectionRectMeshRef.current) return;
    const positions = selectionRectMeshRef.current.geometry.attributes.position.array;

    const minX = Math.min(start.x, current.x);
    const maxX = Math.max(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const maxY = Math.max(start.y, current.y);

    const ndcTopLeft = new THREE.Vector2(
      (minX / window.innerWidth) * 2 - 1,
      -(maxY / window.innerHeight) * 2 + 1
    );
    const ndcTopRight = new THREE.Vector2(
      (maxX / window.innerWidth) * 2 - 1,
      -(maxY / window.innerHeight) * 2 + 1
    );
    const ndcBottomRight = new THREE.Vector2(
      (maxX / window.innerWidth) * 2 - 1,
      -(minY / window.innerHeight) * 2 + 1
    );
    const ndcBottomLeft = new THREE.Vector2(
      (minX / window.innerWidth) * 2 - 1,
      -(minY / window.innerHeight) * 2 + 1
    );

    const p1 = new THREE.Vector3(ndcTopLeft.x, ndcTopLeft.y, 0.5).unproject(cameraRef.current);
    const p2 = new THREE.Vector3(ndcTopRight.x, ndcTopRight.y, 0.5).unproject(cameraRef.current);
    const p3 = new THREE.Vector3(ndcBottomRight.x, ndcBottomRight.y, 0.5).unproject(cameraRef.current);
    const p4 = new THREE.Vector3(ndcBottomLeft.x, ndcBottomLeft.y, 0.5).unproject(cameraRef.current);

    positions[0] = p1.x; positions[1] = p1.y; positions[2] = p1.z;
    positions[3] = p2.x; positions[4] = p2.y; positions[5] = p2.z;
    positions[6] = p3.x; positions[7] = p3.y; positions[8] = p3.z;
    positions[9] = p4.x; positions[10] = p4.y; positions[11] = p4.z;
    positions[12] = p1.x; positions[13] = p1.y; positions[14] = p1.z;

    selectionRectMeshRef.current.geometry.attributes.position.needsUpdate = true;
  }, []);

  const selectPointsInRectangle = useCallback(() => {
    if (!originalData || !pointsGroupRef.current || pointsGroupRef.current.children.length === 0) {
      showMessage('No points to select from.');
      return;
    }

    const rectLeft = Math.min(startSelectPointRef.current.x, currentMousePointRef.current.x);
    const rectRight = Math.max(startSelectPointRef.current.x, currentMousePointRef.current.x);
    const rectTop = Math.min(startSelectPointRef.current.y, currentMousePointRef.current.y);
    const rectBottom = Math.max(startSelectPointRef.current.y, currentMousePointRef.current.y);

    selectedPointsRef.current = [];

    const currentPointsMesh = pointsGroupRef.current.children[0];
    if (!currentPointsMesh || !currentPointsMesh.isPoints) {
      return;
    }

    const positions = currentPointsMesh.geometry.attributes.position.array;
    const colors = currentPointsMesh.geometry.attributes.color.array;
    const originalFiltered = currentPointsMesh.userData.filteredPoints;

    if (!originalFiltered || originalFiltered.length === 0) {
      console.warn("No filtered points data found for selection.");
      return;
    }

    const tempVector = new THREE.Vector3();

    for (let i = 0; i < positions.length / 3; i++) {
      const originalDataItem = originalFiltered[i];
      if (!originalDataItem) {
        console.error(`Error: originalFiltered[${i}] is undefined.`);
        continue;
      }

      tempVector.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      tempVector.project(cameraRef.current);

      const screenX = ((tempVector.x + 1) / 2) * rendererRef.current.domElement.clientWidth;
      const screenY = ((-tempVector.y + 1) / 2) * rendererRef.current.domElement.clientHeight;

      if (
        screenX >= rectLeft &&
        screenX <= rectRight &&
        screenY >= rectTop &&
        screenY <= rectBottom
      ) {
        selectedPointsRef.current.push({
          geometryIndex: i,
          pointsMesh: currentPointsMesh,
          originalFilteredData: originalDataItem,
        });
        colors[i * 3] = 1; // R
        colors[i * 3 + 1] = 1; // G
        colors[i * 3 + 2] = 0; // B (Yellow)
      } else {
        // Reset color if not selected (important for clearing previous selections)
        const pointType = originalDataItem.type;
        const color = new THREE.Color();
        switch (pointType) {
            case "body-intersection": color.setHex(0x00aaff); break; // Light Blue
            case "garment-intersection": color.setHex(0x00ffaa); break; // Teal
            case "landmark": color.setHex(0xff0000); break; // Red
            case "trail-intersection": color.setHex(0xffaa00); break; // Orange
            case "trail-landmark": color.setHex(0xaa00ff); break; // Purple
            default: color.setHex(0xffffff); // White default
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    }
    currentPointsMesh.geometry.attributes.color.needsUpdate = true;
    showMessage(`${selectedPointsRef.current.length} points selected.`);
  }, [originalData, showMessage]);

  const setCameraView = useCallback((view) => {
    if (!pointsGroupRef.current || pointsGroupRef.current.children.length === 0) {
      showMessage("No points loaded to set camera view to.");
      return;
    }

    const boundingBox = new THREE.Box3().setFromObject(pointsGroupRef.current);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraDistance *= 1.5;

    let newPosition = new THREE.Vector3();

    switch (view) {
      case "top": newPosition.set(center.x, center.y + cameraDistance, center.z); break;
      case "bottom": newPosition.set(center.x, center.y - cameraDistance, center.z); break;
      case "front": newPosition.set(center.x, center.y, center.z + cameraDistance); break;
      case "back": newPosition.set(center.x, center.y, center.z - cameraDistance); break;
      case "left": newPosition.set(center.x - cameraDistance, center.y, center.z); break;
      case "right": newPosition.set(center.x + cameraDistance, center.y, center.z); break;
    }

    cameraRef.current.position.copy(newPosition);
    cameraRef.current.lookAt(center);

    controlsRef.current.target.copy(center);
    controlsRef.current.update();
    showMessage(`Camera set to ${view.charAt(0).toUpperCase() + view.slice(1)} View.`);
  }, [showMessage]);

  const updateCameraLockState = useCallback(() => {
    if (currentLevelFilter !== 'all') {
      setCameraView("top");
      controlsRef.current.enabled = false;
      showMessage(`Camera locked to Top View for level "${currentLevelFilter}".`);
    } else {
      controlsRef.current.enabled = true;
      showMessage("Camera controls enabled.");
    }
  }, [currentLevelFilter, setCameraView, showMessage]);

  // --- Rendering Points ---
  const renderPoints = useCallback(() => {
    if (!sceneRef.current || !pointsGroupRef.current || !originalData) return;

    pointsGroupRef.current.clear();
    selectedPointsRef.current = [];
    clearMeasurementLine();
    clearSelectionRectangle();

    const selectedLevelName = currentLevelFilter;

    const newFilteredPoints = [];

    // Process Body Levels
    if (originalData.body?.levels) {
      originalData.body.levels.forEach((level) => {
        if (!level?.name) return;
        if (selectedLevelName === 'all' || level.name === selectedLevelName) {
          if (showBodyIntersection && level.intersectionPoints) {
            level.intersectionPoints.forEach((point) => {
              if (point) newFilteredPoints.push({ type: 'body-intersection', point, levelName: level.name, originalRef: level.intersectionPoints });
            });
          }
          if (showLandmark && level.landmarks) {
            level.landmarks.forEach((landmark) => {
              if (landmark?.point) newFilteredPoints.push({ type: 'landmark', point: landmark.point, levelName: level.name, originalRef: level.landmarks });
            });
          }
        }
      });
    }

    // Process Garment Levels
    if (originalData.garment?.levels) {
      originalData.garment.levels.forEach((level) => {
        if (!level?.name) return;
        if (selectedLevelName === 'all' || level.name === selectedLevelName) {
          if (showGarmentIntersection && level.intersectionPoints) {
            level.intersectionPoints.forEach((point) => {
              if (point) newFilteredPoints.push({ type: 'garment-intersection', point, levelName: level.name, originalRef: level.intersectionPoints });
            });
          }
          if (showLandmark && level.landmarks) {
            level.landmarks.forEach((landmark) => {
              if (landmark?.point) newFilteredPoints.push({ type: 'landmark', point: landmark.point, levelName: level.name, originalRef: level.landmarks });
            });
          }
        }
      });
    }

    // Process Trails
    if (originalData.trails) {
      originalData.trails.forEach((trail) => {
        if (trail?.levels) {
          trail.levels.forEach((level) => {
            if (!level?.name) return;
            if (selectedLevelName === 'all' || level.name === selectedLevelName) {
              if (showTrailIntersection && level.intersectionPoints) {
                level.intersectionPoints.forEach((point) => {
                  if (point) newFilteredPoints.push({ type: 'trail-intersection', point, levelName: level.name, originalRef: level.intersectionPoints });
                });
              }
              if (showTrailLandmark && level.landmarks) {
                level.landmarks.forEach((landmark) => {
                  if (landmark?.point) newFilteredPoints.push({ type: 'trail-landmark', point: landmark.point, levelName: level.name, originalRef: level.landmarks });
                });
              }
            }
          });
        }
      });
    }

    setFilteredPointsForDisplay(newFilteredPoints); // Update state

    const positions = [];
    const colors = [];

    const colorBodyIntersection = new THREE.Color(0x00aaff);
    const colorGarmentIntersection = new THREE.Color(0x00ffaa);
    const colorLandmark = new THREE.Color(0xff0000);
    const colorTrailIntersection = new THREE.Color(0xffaa00);
    const colorTrailLandmark = new THREE.Color(0xaa00ff);

    newFilteredPoints.forEach((data) => {
      positions.push(data.point.x, data.point.y, data.point.z);
      switch (data.type) {
        case 'body-intersection': colors.push(colorBodyIntersection.r, colorBodyIntersection.g, colorBodyIntersection.b); break;
        case 'garment-intersection': colors.push(colorGarmentIntersection.r, colorGarmentIntersection.g, colorGarmentIntersection.b); break;
        case 'landmark': colors.push(colorLandmark.r, colorLandmark.g, colorLandmark.b); break;
        case 'trail-intersection': colors.push(colorTrailIntersection.r, colorTrailIntersection.g, colorTrailIntersection.b); break;
        case 'trail-landmark': colors.push(colorTrailLandmark.r, colorTrailLandmark.g, colorTrailLandmark.b); break;
        default: colors.push(1, 1, 1); // White
      }
    });

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(pointGeometry, pointMaterial);
    points.userData.filteredPoints = newFilteredPoints;
    pointsGroupRef.current.add(points);

    updateCameraLockState();
  }, [originalData, currentLevelFilter, showBodyIntersection, showGarmentIntersection, showLandmark, showTrailIntersection, showTrailLandmark, clearMeasurementLine, clearSelectionRectangle, updateCameraLockState]);


  // --- Event Handlers ---

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      showMessage('Loading JSON...'); // Temporarily use modal for loading
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            setOriginalData(data); // This will trigger renderPoints via useEffect
            showMessage('JSON file loaded successfully!');
          } catch (parseError) {
            showMessage('Error parsing JSON file: ' + parseError.message);
            console.error('Error parsing JSON:', parseError);
          } finally {
            // No explicit loading overlay needed if modal is used
          }
        };
        reader.readAsText(file);
      } catch (error) {
        showMessage('Error reading file: ' + error.message);
        console.error('Error reading file:', error);
      }
    }
  }, [showMessage]);

  const onPointerDown = useCallback((event) => {
    event.preventDefault();
    if (event.button !== 0) return;

    mouseRef.current.x = (event.clientX / mountRef.current.clientWidth) * 2 - 1;
    mouseRef.current.y = -(event.clientY / mountRef.current.clientHeight) * 2 + 1;

    if (activeTool === 'select') {
      controlsRef.current.enabled = false;
      startSelectPointRef.current.set(event.clientX, event.clientY);
      clearSelectionRectangle();
      selectionRectMeshRef.current = createSelectionRectangle(
        startSelectPointRef.current,
        startSelectPointRef.current
      );
      sceneRef.current.add(selectionRectMeshRef.current);
    }
  }, [activeTool, clearSelectionRectangle, createSelectionRectangle]);

  const onPointerMove = useCallback((event) => {
    event.preventDefault();
    if (activeTool === 'select' && selectionRectMeshRef.current) {
      currentMousePointRef.current.set(event.clientX, event.clientY);
      updateSelectionRectangle(startSelectPointRef.current, currentMousePointRef.current);
    }
  }, [activeTool, updateSelectionRectangle]);

  const onPointerUp = useCallback((event) => {
    event.preventDefault();
    if (event.button !== 0) return;

    mouseRef.current.x = (event.clientX / mountRef.current.clientWidth) * 2 - 1;
    mouseRef.current.y = -(event.clientY / mountRef.current.clientHeight) * 2 + 1;

    if (activeTool === 'measure') {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(pointsGroupRef.current.children, true);

      if (intersects.length > 0) {
        const clickedPoint = intersects[0].point;
        // Determine the type of point clicked (e.g., body-intersection, landmark)
        const intersectedPointData = intersects[0].object.userData.filteredPoints[intersects[0].index];

        if (!firstMeasurementPointRef.current) {
          firstMeasurementPointRef.current = clickedPoint;
          showMessage("First point selected. Click the second point.");
          measuredPointsInfo.p1 = intersectedPointData.point;
          measuredPointsInfo.type1 = intersectedPointData.type;
          measuredPointsInfo.level = intersectedPointData.levelName;
        } else {
          const distance = firstMeasurementPointRef.current.distanceTo(clickedPoint);
          setInfoMessage(`Distance: ${distance.toFixed(3)}`);
          clearMeasurementLine();
          const geometry = new THREE.BufferGeometry().setFromPoints([
            firstMeasurementPointRef.current,
            clickedPoint,
          ]);
          const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
          measurementLineRef.current = new THREE.Line(geometry, material);
          sceneRef.current.add(measurementLineRef.current);

          lastMeasuredDistance = distance.toFixed(3); // Store for LLM
          measuredPointsInfo.p2 = intersectedPointData.point;
          measuredPointsInfo.type2 = intersectedPointData.type;
          // Level is already set from p1

          firstMeasurementPointRef.current = null;
        }
      } else {
        showMessage("No points detected. Click directly on a point.");
      }
    } else if (activeTool === 'select') {
      if (selectionRectMeshRef.current) {
        selectPointsInRectangle();
        clearSelectionRectangle();
      }
      controlsRef.current.enabled = true;
    } else if (activeTool === 'add') {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(pointsGroupRef.current.children, true);
      let newPointPos = null;

      if (intersects.length > 0) {
        newPointPos = intersects[0].point;
      } else {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        raycasterRef.current.ray.intersectPlane(plane, intersectionPoint);
        newPointPos = intersectionPoint;
      }

      if (newPointPos) {
        addPointToData(newPointPos);
      } else {
        showMessage('Could not determine a valid position to add a point. Try clicking on existing geometry or adjust camera.');
      }
    }
  }, [activeTool, showMessage, clearMeasurementLine, selectPointsInRectangle, clearSelectionRectangle]);

  const deleteSelectedPoints = useCallback(() => {
    if (selectedPointsRef.current.length === 0) {
      showMessage('No points selected to delete.');
      return;
    }

    if (!originalData) {
      showMessage('No JSON data loaded.');
      return;
    }

    const newOriginalData = JSON.parse(JSON.stringify(originalData)); // Deep copy to ensure immutability
    const pointsToDeleteMap = new Map();

    selectedPointsRef.current.forEach((selected) => {
      const ref = selected.originalFilteredData.originalRef;
      const point = selected.originalFilteredData.point;

      if (!pointsToDeleteMap.has(ref)) {
        pointsToDeleteMap.set(ref, new Set());
      }
      pointsToDeleteMap.get(ref).add(point);
    });

    // Update newOriginalData by filtering points
    if (newOriginalData.body?.levels) {
      newOriginalData.body.levels.forEach((level) => {
        if (level?.intersectionPoints && pointsToDeleteMap.has(level.intersectionPoints)) {
          level.intersectionPoints = level.intersectionPoints.filter(p => !pointsToDeleteMap.get(level.intersectionPoints).has(p));
        }
        if (level?.landmarks && pointsToDeleteMap.has(level.landmarks)) {
          level.landmarks = level.landmarks.filter(lm => lm?.point && !pointsToDeleteMap.get(level.landmarks).has(lm.point));
        }
      });
    }
    if (newOriginalData.garment?.levels) {
      newOriginalData.garment.levels.forEach((level) => {
        if (level?.intersectionPoints && pointsToDeleteMap.has(level.intersectionPoints)) {
          level.intersectionPoints = level.intersectionPoints.filter(p => !pointsToDeleteMap.get(level.intersectionPoints).has(p));
        }
        if (level?.landmarks && pointsToDeleteMap.has(level.landmarks)) {
          level.landmarks = level.landmarks.filter(lm => lm?.point && !pointsToDeleteMap.get(level.landmarks).has(lm.point));
        }
      });
    }
    if (newOriginalData.trails) {
      newOriginalData.trails.forEach((trail) => {
        if (trail?.levels) {
          trail.levels.forEach((level) => {
            if (level?.intersectionPoints && pointsToDeleteMap.has(level.intersectionPoints)) {
              level.intersectionPoints = level.intersectionPoints.filter(p => !pointsToDeleteMap.get(level.intersectionPoints).has(p));
            }
            if (level?.landmarks && pointsToDeleteMap.has(level.landmarks)) {
              level.landmarks = level.landmarks.filter(lm => lm?.point && !pointsToDeleteMap.get(level.landmarks).has(lm.point));
            }
          });
        }
      });
    }

    setOriginalData(newOriginalData); // Update state to re-render
    showMessage(`${selectedPointsRef.current.length} points deleted.`);
    selectedPointsRef.current = []; // Clear selection after deletion
  }, [originalData, showMessage]);

  const addPointToData = useCallback((position) => {
    if (!originalData) {
      showMessage('No JSON data loaded. Please upload a file first.');
      return;
    }

    const newOriginalData = JSON.parse(JSON.stringify(originalData));
    const targetLevelName = currentLevelFilter;
    let targetGarmentLevel = null;

    if (targetLevelName === 'all') {
      if (newOriginalData.garment?.levels && newOriginalData.garment.levels.length > 0) {
        targetGarmentLevel = newOriginalData.garment.levels[0];
      } else {
        showMessage("No garment levels found in the loaded JSON data to add a point to. Please ensure 'garment' data exists or select a specific level.");
        return;
      }
    } else {
      targetGarmentLevel = newOriginalData.garment?.levels?.find(level => level?.name === targetLevelName);
      if (!targetGarmentLevel) {
        showMessage(`Could not find garment level "${targetLevelName}". Please ensure the selected level belongs to 'garment' data.`);
        return;
      }
    }

    if (targetGarmentLevel) {
      if (!targetGarmentLevel.intersectionPoints) {
        targetGarmentLevel.intersectionPoints = [];
      }
      targetGarmentLevel.intersectionPoints.push({ x: position.x, y: position.y, z: position.z });
      setOriginalData(newOriginalData); // Update state to trigger re-render
      showMessage(`Garment point added to level "${targetGarmentLevel.name}" at X:${position.x.toFixed(2)}, Y:${position.y.toFixed(2)}, Z:${position.z.toFixed(2)}`);
    }
  }, [originalData, currentLevelFilter, showMessage]);

  const saveModifiedJson = useCallback(() => {
    if (!originalData) {
      showMessage('No data to save. Please upload a JSON file first.');
      return;
    }

    const modifiedData = JSON.parse(JSON.stringify(originalData));
    const originalFileName = modifiedData.fileName || 'point_cloud_data';
    modifiedData.fileName = `${originalFileName}_modified`;

    const dataStr = JSON.stringify(modifiedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modifiedData.fileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('Modified JSON saved successfully!');
  }, [originalData, showMessage]);

  // --- Core Three.js Setup and Animation Loop ---
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x303030);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, 1, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Raycaster
    raycasterRef.current = new THREE.Raycaster();

    // Points Group
    pointsGroupRef.current = new THREE.Group();
    scene.add(pointsGroupRef.current);

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Event Listeners for Three.js interactions
    const handleResize = () => {
      if (currentMount) {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
      // Dispose geometries, materials etc. if they are not managed by pointsGroup.clear()
    };
  }, [onPointerDown, onPointerMove, onPointerUp]); // Empty dependency array for initial setup

  // Effect to re-render points when originalData or filters change
  useEffect(() => {
    if (originalData) {
      renderPoints();
    }
  }, [originalData, currentLevelFilter, showBodyIntersection, showGarmentIntersection, showLandmark, showTrailIntersection, showTrailLandmark, renderPoints]);

  // Effect to populate level filter when originalData changes
  useEffect(() => {
    if (originalData) {
      const addedLevels = new Set();
      const options = [<option key="all" value="all">All Levels</option>];

      const addLevelOptions = (levels, prefix) => {
        levels?.forEach(level => {
          if (level?.name && !addedLevels.has(level.name)) {
            options.push(<option key={level.name} value={level.name}>{prefix}: {level.name}</option>);
            addedLevels.add(level.name);
          }
        });
      };

      addLevelOptions(originalData.body?.levels, 'Body');
      addLevelOptions(originalData.garment?.levels, 'Garment');
      originalData.trails?.forEach(trail => addLevelOptions(trail?.levels, `Trail: ${trail?.trailName || 'N/A'}`));

      // Update the select element
      if (document.getElementById('levelFilter')) {
        document.getElementById('levelFilter').innerHTML = options.map(opt => `<option value="${opt.props.value}">${opt.props.children}</option>`).join('');
        document.getElementById('levelFilter').value = currentLevelFilter; // Keep current selection
      }
    }
  }, [originalData, currentLevelFilter]); // Re-run when originalData changes

  // --- Render JSX ---
  return (
    <div id="app-container" className="flex h-screen w-screen">
      {/* Controls Panel */}
      <div id="controls-panel" className="w-72 bg-gray-700 p-4 shadow-lg overflow-y-auto flex flex-col gap-3">
        <h1 className="text-2xl font-bold mb-4 text-center text-white">Point Cloud Viewer</h1>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-gray-300" htmlFor="fileInput">Upload JSON File:</label>
          <input
            type="file"
            id="fileInput"
            accept=".json"
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer"
            onChange={handleFileUpload}
          />
        </div>

        {/* Info Box */}
        <div id="info-box" className="bg-gray-800 text-gray-100 p-2 rounded-md text-sm text-center">
          {infoMessage}
        </div>

        {/* Level Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="levelFilter">Filter Level:</label>
          <select
            id="levelFilter"
            className="w-full p-2 rounded-md bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentLevelFilter}
            onChange={(e) => setCurrentLevelFilter(e.target.value)}
          >
            <option value="all">All Levels</option>
            {/* Options populated by useEffect */}
          </select>
        </div>

        {/* Visibility Toggles */}
        <div className="section-title text-white">Visibility</div>
        <div className="checkbox-container">
          <input type="checkbox" id="toggleBodyIntersectionPoints" checked={showBodyIntersection} onChange={() => setShowBodyIntersection(prev => !prev)} className="form-checkbox h-5 w-5 text-blue-600 rounded" />
          <label htmlFor="toggleBodyIntersectionPoints" className="text-sm text-gray-300">Body Intersection Points</label>
        </div>
        <div className="checkbox-container">
          <input type="checkbox" id="toggleGarmentIntersectionPoints" checked={showGarmentIntersection} onChange={() => setShowGarmentIntersection(prev => !prev)} className="form-checkbox h-5 w-5 text-green-600 rounded" />
          <label htmlFor="toggleGarmentIntersectionPoints" className="text-sm text-gray-300">Garment Intersection Points</label>
        </div>
        <div className="checkbox-container">
          <input type="checkbox" id="toggleLandmarkPoints" checked={showLandmark} onChange={() => setShowLandmark(prev => !prev)} className="form-checkbox h-5 w-5 text-red-600 rounded" />
          <label htmlFor="toggleLandmarkPoints" className="text-sm text-gray-300">Landmark Points</label>
        </div>
        <div className="checkbox-container">
          <input type="checkbox" id="toggleTrailIntersectionPoints" checked={showTrailIntersection} onChange={() => setShowTrailIntersection(prev => !prev)} className="form-checkbox h-5 w-5 text-yellow-600 rounded" />
          <label htmlFor="toggleTrailIntersectionPoints" className="text-sm text-gray-300">Trail Intersection Points</label>
        </div>
        <div className="checkbox-container">
          <input type="checkbox" id="toggleTrailLandmarkPoints" checked={showTrailLandmark} onChange={() => setShowTrailLandmark(prev => !prev)} className="form-checkbox h-5 w-5 text-purple-600 rounded" />
          <label htmlFor="toggleTrailLandmarkPoints" className="text-sm text-gray-300">Trail Landmark Points</label>
        </div>

        {/* Tools */}
        <div className="section-title mt-4 text-white">Tools</div>
        <button className={`btn ${activeTool === 'measure' ? 'bg-blue-600' : ''}`} onClick={() => setActiveTool(activeTool === 'measure' ? null : 'measure')}>
          {activeTool === 'measure' ? 'Measuring... Click 2 points' : 'Measure Distance'}
        </button>
        <button className={`btn ${activeTool === 'select' ? 'bg-blue-600' : ''}`} onClick={() => setActiveTool(activeTool === 'select' ? null : 'select')}>
          {activeTool === 'select' ? 'Selecting... Drag to select' : 'Select Points (Rect)'}
        </button>
        <button className="btn bg-red-700 hover:bg-red-800" onClick={deleteSelectedPoints}>
          Delete Selected Points
        </button>
        <button className={`btn bg-green-700 hover:bg-green-800 ${activeTool === 'add' ? 'bg-blue-600' : ''}`} onClick={() => setActiveTool(activeTool === 'add' ? null : 'add')}>
          {activeTool === 'add' ? 'Adding Garment Point... Click on surface' : 'Add Garment Point'}
        </button>
        <button className="btn bg-gray-700 hover:bg-gray-800" onClick={saveModifiedJson}>
          Save Modified JSON
        </button>

        {/* View Controls */}
        <div className="section-title mt-4 text-white">View Controls</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => setCameraView('top')}>Top View</button>
          <button className="btn" onClick={() => setCameraView('bottom')}>Bottom View</button>
          <button className="btn" onClick={() => setCameraView('front')}>Front View</button>
          <button className="btn" onClick={() => setCameraView('back')}>Back View</button>
          <button className="btn" onClick={() => setCameraView('left')}>Left View</button>
          <button className="btn" onClick={() => setCameraView('right')}>Right View</button>
        </div>
      </div>

      {/* Canvas Container */}
      <div id="canvas-container" ref={mountRef} className="flex-grow relative"></div>

      {/* Message Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            <p className="text-lg mb-4 text-white">{modalMessage}</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md" onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointCloudViewer;
