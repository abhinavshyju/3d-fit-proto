import { useState, useCallback } from "react";
import type { Point3D, AlignmentPair, Transform } from "../types";
import * as THREE from "three";

export function useAlignment() {
  const [alignmentPairs, setAlignmentPairs] = useState<AlignmentPair[]>([]);

  const addAlignmentPair = useCallback(
    (bodyPoint: Point3D, garmentPoint: Point3D) => {
      const pair: AlignmentPair = {
        bodyPoint,
        garmentPoint,
        confidence: 1.0,
      };
      setAlignmentPairs((prev) => [...prev, pair]);
    },
    []
  );

  const removeAlignmentPair = useCallback((index: number) => {
    setAlignmentPairs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAlignmentPairs = useCallback(() => {
    setAlignmentPairs([]);
  }, []);

  const calculateTransform = useCallback(
    (pairs: AlignmentPair[]): Transform => {
      if (pairs.length === 0) {
        return {
          translation: {
            x: 0,
            y: 0,
            z: 0,
            id: "",
          },
          rotation: {
            x: 0,
            y: 0,
            z: 0,
            id: "",
          },
          scale: {
            x: 1,
            y: 1,
            z: 1,
            id: "",
          },
        };
      }

      // Calculate centroid of both point sets
      const bodyCentroid = pairs.reduce(
        (acc, pair) => ({
          x: acc.x + pair.bodyPoint.x,
          y: acc.y + pair.bodyPoint.y,
          z: acc.z + pair.bodyPoint.z,
        }),
        { x: 0, y: 0, z: 0 }
      );

      const garmentCentroid = pairs.reduce(
        (acc, pair) => ({
          x: acc.x + pair.garmentPoint.x,
          y: acc.y + pair.garmentPoint.y,
          z: acc.z + pair.garmentPoint.z,
        }),
        { x: 0, y: 0, z: 0 }
      );

      bodyCentroid.x /= pairs.length;
      bodyCentroid.y /= pairs.length;
      bodyCentroid.z /= pairs.length;

      garmentCentroid.x /= pairs.length;
      garmentCentroid.y /= pairs.length;
      garmentCentroid.z /= pairs.length;

      // Simple translation-based alignment
      const translation = {
        x: bodyCentroid.x - garmentCentroid.x,
        y: bodyCentroid.y - garmentCentroid.y,
        z: bodyCentroid.z - garmentCentroid.z,
        id: "",
      };

      return {
        translation,
        rotation: {
          x: 0,
          y: 0,
          z: 0,
          id: "",
        },
        scale: {
          x: 1,
          y: 1,
          z: 1,
          id: "",
        },
      };
    },
    []
  );

  const performAutoAlignment = useCallback(
    (bodyPoints: Point3D[], garmentPoints: Point3D[]) => {
      // Simple auto-alignment: find closest points and create pairs
      const autoPairs: AlignmentPair[] = [];

      bodyPoints.forEach((bodyPoint) => {
        let closestGarmentPoint = garmentPoints[0];
        let minDistance = Number.MAX_VALUE;

        garmentPoints.forEach((garmentPoint) => {
          const distance = Math.sqrt(
            Math.pow(bodyPoint.x - garmentPoint.x, 2) +
              Math.pow(bodyPoint.y - garmentPoint.y, 2) +
              Math.pow(bodyPoint.z - garmentPoint.z, 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestGarmentPoint = garmentPoint;
          }
        });

        if (closestGarmentPoint && minDistance < 2.0) {
          // Distance threshold
          autoPairs.push({
            bodyPoint,
            garmentPoint: closestGarmentPoint,
            confidence: Math.max(0, 1 - minDistance / 2.0),
          });
        }
      });

      setAlignmentPairs(autoPairs.slice(0, 6)); // Limit to 6 pairs
      return calculateTransform(autoPairs);
    },
    [calculateTransform]
  );

  return {
    alignmentPairs,
    addAlignmentPair,
    removeAlignmentPair,
    clearAlignmentPairs,
    calculateTransform,
    performAutoAlignment,
  };
}
