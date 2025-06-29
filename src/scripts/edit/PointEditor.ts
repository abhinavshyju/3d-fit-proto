import type {
  Point3D,
  Point2D,
  Point,
  Curve,
  JSONData,
  PointEditOperation,
} from "./types";

export class PointEditor {
  private data: JSONData | null = null;
  private currentLevel: string = "";
  private currentTrial: string = "";
  private editHistory: PointEditOperation[] = [];
  private undoStack: PointEditOperation[] = [];

  constructor() {}

  public setData(data: JSONData): void {
    this.data = data;
    this.editHistory = [];
    this.undoStack = [];
  }

  public setCurrentLevel(level: string, trial?: string): void {
    this.currentLevel = level;
    this.currentTrial = trial || "";
  }

  // Point Operations
  public addPoint(
    position: Point3D,
    type: "body" | "garment" | "landmark"
  ): string {
    if (!this.data) throw new Error("No data loaded");

    const pointId = this.generatePointId();
    const point: Point = {
      id: pointId,
      position,
      type,
      level: this.currentLevel,
      trial: this.currentTrial,
      metadata: {},
    };

    this.addPointToData(point);
    this.recordOperation({
      type: "add",
      pointId,
      position,
      level: this.currentLevel,
      trial: this.currentTrial,
      pointType: type,
    });

    return pointId;
  }

  public deletePoint(pointId: string): boolean {
    if (!this.data) return false;

    const point = this.findPointById(pointId);
    if (!point) return false;

    this.removePointFromData(pointId);
    this.recordOperation({
      type: "delete",
      pointId,
      level: this.currentLevel,
      trial: this.currentTrial,
      pointType: point.type,
    });

    return true;
  }

  public editPoint(pointId: string, newPosition: Point3D): boolean {
    if (!this.data) return false;

    const point = this.findPointById(pointId);
    if (!point) return false;

    point.position = newPosition;
    this.recordOperation({
      type: "edit",
      pointId,
      position: newPosition,
      level: this.currentLevel,
      trial: this.currentTrial,
      pointType: point.type,
    });

    return true;
  }

  // Curve Generation
  public createCurve(
    points: Point2D[],
    type: "spline" | "bezier" | "linear"
  ): Curve {
    const curveId = this.generateCurveId();
    const curve: Curve = {
      id: curveId,
      type,
      controlPoints: points,
      generatedPoints: this.generateCurvePoints(points, type),
      level: this.currentLevel,
      trial: this.currentTrial,
    };

    this.addCurveToData(curve);
    return curve;
  }

  public generateEquidistantPoints(curve: Curve, spacing: number): Point3D[] {
    const points: Point3D[] = [];
    const curvePoints = curve.generatedPoints;

    if (curvePoints.length < 2) return points;

    let currentDistance = 0;
    let currentIndex = 0;

    while (currentIndex < curvePoints.length - 1) {
      const p1 = curvePoints[currentIndex];
      const p2 = curvePoints[currentIndex + 1];

      const segmentLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

      if (currentDistance + segmentLength >= spacing) {
        const t = (spacing - currentDistance) / segmentLength;
        const x = p1.x + t * (p2.x - p1.x);
        const y = p1.y + t * (p2.y - p1.y);

        // Convert back to 3D (assuming z = 0 for the level)
        points.push({ x, y, z: 0 });
        currentDistance = 0;
      } else {
        currentDistance += segmentLength;
      }

      currentIndex++;
    }

    return points;
  }

  // Body Division
  public divideBodyBetweenLandmarks(
    landmarks: Point3D[],
    divisions: number
  ): Point3D[] {
    if (landmarks.length < 2) return [];

    const points: Point3D[] = [];
    const totalLength = this.calculatePathLength(landmarks);
    const segmentLength = totalLength / divisions;

    let currentDistance = 0;
    let currentIndex = 0;

    for (let i = 0; i < divisions; i++) {
      const targetDistance = i * segmentLength;

      while (
        currentIndex < landmarks.length - 1 &&
        currentDistance < targetDistance
      ) {
        const p1 = landmarks[currentIndex];
        const p2 = landmarks[currentIndex + 1];
        const segmentLength = Math.sqrt(
          (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2
        );

        if (currentDistance + segmentLength >= targetDistance) {
          const t = (targetDistance - currentDistance) / segmentLength;
          points.push({
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: p1.z + t * (p2.z - p1.z),
          });
          break;
        }

        currentDistance += segmentLength;
        currentIndex++;
      }
    }

    return points;
  }

  // 2D Projection for editing
  public projectTo2D(points: Point3D[]): Point2D[] {
    // Simple projection: use x and y coordinates
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  public projectTo3D(points: Point2D[], z: number = 0): Point3D[] {
    return points.map((p) => ({ x: p.x, y: p.y, z }));
  }

  // Undo/Redo
  public undo(): boolean {
    if (this.editHistory.length === 0) return false;

    const operation = this.editHistory.pop()!;
    this.undoStack.push(operation);
    this.applyUndoOperation(operation);
    return true;
  }

  public redo(): boolean {
    if (this.undoStack.length === 0) return false;

    const operation = this.undoStack.pop()!;
    this.editHistory.push(operation);
    this.applyRedoOperation(operation);
    return true;
  }

  // Get current data
  public getData(): JSONData | null {
    return this.data;
  }

  public getPointsForLevel(level: string, trial?: string): Point[] {
    if (!this.data) return [];

    const points: Point[] = [];

    // Get body points
    const bodyLevel = this.data.body.levels.find((l) => l.name === level);
    if (bodyLevel) {
      if (bodyLevel.intersectionPoints) {
        bodyLevel.intersectionPoints.forEach((point, index) => {
          points.push({
            id: `body_${level}_${index}`,
            position: point,
            type: "body",
            level,
            metadata: { originalIndex: index },
          });
        });
      }
      if (bodyLevel.landmarks) {
        bodyLevel.landmarks.forEach((landmark, index) => {
          if (landmark.point) {
            points.push({
              id: `landmark_${level}_${index}`,
              position: landmark.point,
              type: "landmark",
              level,
              metadata: { originalIndex: index },
            });
          }
        });
      }
    }

    // Get garment points
    if (trial) {
      const trail = this.data.trails.find((t) => t.trailName === trial);
      if (trail) {
        const trailLevel = trail.levels.find((l) => l.name === level);
        if (trailLevel && trailLevel.intersectionPoints) {
          trailLevel.intersectionPoints.forEach((point, index) => {
            points.push({
              id: `garment_${trial}_${level}_${index}`,
              position: point,
              type: "garment",
              level,
              trial,
              metadata: { originalIndex: index },
            });
          });
        }
      }
    }

    return points;
  }

  // Private helper methods
  private generatePointId(): string {
    return `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCurveId(): string {
    return `curve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findPointById(pointId: string): Point | null {
    if (!this.data) return null;

    // Search in body levels
    for (const level of this.data.body.levels) {
      if (level.intersectionPoints) {
        const index = level.intersectionPoints.findIndex(
          (_, i) => `body_${level.name}_${i}` === pointId
        );
        if (index !== -1) {
          return {
            id: pointId,
            position: level.intersectionPoints[index],
            type: "body",
            level: level.name,
            metadata: { originalIndex: index },
          };
        }
      }
      if (level.landmarks) {
        const index = level.landmarks.findIndex(
          (_, i) => `landmark_${level.name}_${i}` === pointId
        );
        if (index !== -1) {
          const landmark = level.landmarks[index];
          if (landmark.point) {
            return {
              id: pointId,
              position: landmark.point,
              type: "landmark",
              level: level.name,
              metadata: { originalIndex: index },
            };
          }
        }
      }
    }

    // Search in trails
    for (const trail of this.data.trails) {
      for (const level of trail.levels) {
        if (level.intersectionPoints) {
          const index = level.intersectionPoints.findIndex(
            (_, i) =>
              `garment_${trail.trailName}_${level.name}_${i}` === pointId
          );
          if (index !== -1) {
            return {
              id: pointId,
              position: level.intersectionPoints[index],
              type: "garment",
              level: level.name,
              trial: trail.trailName,
              metadata: { originalIndex: index },
            };
          }
        }
      }
    }

    return null;
  }

  private addPointToData(point: Point): void {
    if (!this.data) return;

    if (point.type === "body" || point.type === "landmark") {
      const level = this.data.body.levels.find((l) => l.name === point.level);
      if (level) {
        if (point.type === "body") {
          if (!level.intersectionPoints) level.intersectionPoints = [];
          level.intersectionPoints.push(point.position);
        } else {
          if (!level.landmarks) level.landmarks = [];
          level.landmarks.push({
            point: point.position,
            name: `Landmark_${level.landmarks.length}`,
          });
        }
      }
    } else if (point.type === "garment" && point.trial) {
      const trail = this.data.trails.find((t) => t.trailName === point.trial);
      if (trail) {
        const level = trail.levels.find((l) => l.name === point.level);
        if (level) {
          if (!level.intersectionPoints) level.intersectionPoints = [];
          level.intersectionPoints.push(point.position);
        }
      }
    }
  }

  private removePointFromData(pointId: string): void {
    if (!this.data) return;

    const point = this.findPointById(pointId);
    if (!point) return;

    if (point.type === "body") {
      const level = this.data.body.levels.find((l) => l.name === point.level);
      if (
        level &&
        level.intersectionPoints &&
        point.metadata?.originalIndex !== undefined
      ) {
        level.intersectionPoints.splice(point.metadata.originalIndex, 1);
      }
    } else if (point.type === "landmark") {
      const level = this.data.body.levels.find((l) => l.name === point.level);
      if (
        level &&
        level.landmarks &&
        point.metadata?.originalIndex !== undefined
      ) {
        level.landmarks.splice(point.metadata.originalIndex, 1);
      }
    } else if (point.type === "garment" && point.trial) {
      const trail = this.data.trails.find((t) => t.trailName === point.trial);
      if (trail) {
        const level = trail.levels.find((l) => l.name === point.level);
        if (
          level &&
          level.intersectionPoints &&
          point.metadata?.originalIndex !== undefined
        ) {
          level.intersectionPoints.splice(point.metadata.originalIndex, 1);
        }
      }
    }
  }

  private addCurveToData(curve: Curve): void {
    if (!this.data) return;

    if (curve.trial) {
      const trail = this.data.trails.find((t) => t.trailName === curve.trial);
      if (trail) {
        const level = trail.levels.find((l) => l.name === curve.level);
        if (level) {
          if (!level.curves) level.curves = [];
          level.curves.push(curve);
        }
      }
    } else {
      const level = this.data.body.levels.find((l) => l.name === curve.level);
      if (level) {
        if (!level.curves) level.curves = [];
        level.curves.push(curve);
      }
    }
  }

  private generateCurvePoints(
    points: Point2D[],
    type: "spline" | "bezier" | "linear"
  ): Point2D[] {
    if (points.length < 2) return points;

    switch (type) {
      case "linear":
        return this.generateLinearCurve(points);
      case "bezier":
        return this.generateBezierCurve(points);
      case "spline":
        return this.generateSplineCurve(points);
      default:
        return points;
    }
  }

  private generateLinearCurve(points: Point2D[]): Point2D[] {
    return points;
  }

  private generateBezierCurve(points: Point2D[]): Point2D[] {
    // Simple quadratic Bezier curve implementation
    const result: Point2D[] = [];
    const steps = 50;

    for (let i = 0; i < points.length - 2; i += 2) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const p2 = points[i + 2];

      for (let t = 0; t <= 1; t += 1 / steps) {
        const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
        const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
        result.push({ x, y });
      }
    }

    return result;
  }

  private generateSplineCurve(points: Point2D[]): Point2D[] {
    // Simple cubic spline implementation
    const result: Point2D[] = [];
    const steps = 50;

    for (let i = 0; i < points.length - 3; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const p2 = points[i + 2];
      const p3 = points[i + 3];

      for (let t = 0; t <= 1; t += 1 / steps) {
        const t2 = t * t;
        const t3 = t2 * t;
        const x =
          0.5 *
          ((-t3 + 2 * t2 - t) * p0.x +
            (3 * t3 - 5 * t2 + 2) * p1.x +
            (-3 * t3 + 4 * t2 + t) * p2.x +
            (t3 - t2) * p3.x);
        const y =
          0.5 *
          ((-t3 + 2 * t2 - t) * p0.y +
            (3 * t3 - 5 * t2 + 2) * p1.y +
            (-3 * t3 + 4 * t2 + t) * p2.y +
            (t3 - t2) * p3.y);
        result.push({ x, y });
      }
    }

    return result;
  }

  private calculatePathLength(points: Point3D[]): number {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      length += Math.sqrt(
        (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2
      );
    }
    return length;
  }

  private recordOperation(operation: PointEditOperation): void {
    this.editHistory.push(operation);
    this.undoStack = []; // Clear redo stack when new operation is performed
  }

  private applyUndoOperation(operation: PointEditOperation): void {
    // Implementation depends on the operation type
    // This would reverse the operation
    switch (operation.type) {
      case "add":
        if (operation.pointId) {
          this.removePointFromData(operation.pointId);
        }
        break;
      case "delete":
        if (operation.position && operation.pointType) {
          const point: Point = {
            id: operation.pointId || this.generatePointId(),
            position: operation.position,
            type: operation.pointType,
            level: operation.level,
            trial: operation.trial,
            metadata: {},
          };
          this.addPointToData(point);
        }
        break;
      case "edit":
        // Would need to store previous position to implement properly
        break;
      case "generate":
        // Would need to store generated points to implement properly
        break;
    }
  }

  private applyRedoOperation(operation: PointEditOperation): void {
    // Implementation depends on the operation type
    // This would re-apply the operation
    switch (operation.type) {
      case "add":
        if (operation.position && operation.pointType) {
          const point: Point = {
            id: operation.pointId || this.generatePointId(),
            position: operation.position,
            type: operation.pointType,
            level: operation.level,
            trial: operation.trial,
            metadata: {},
          };
          this.addPointToData(point);
        }
        break;
      case "delete":
        if (operation.pointId) {
          this.removePointFromData(operation.pointId);
        }
        break;
      case "edit":
        if (operation.pointId && operation.position) {
          const point = this.findPointById(operation.pointId);
          if (point) {
            point.position = operation.position;
          }
        }
        break;
      case "generate":
        // Would need to store generated points to implement properly
        break;
    }
  }
}
