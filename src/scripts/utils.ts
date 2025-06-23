export function rotatePoints180(dataset: {
  label?: string;
  data: any;
  borderColor?: string;
  showLine?: boolean;
  pointRadius?: number;
  borderWidth?: number;
  pointHitRadius?: number;
}) {
  return {
    ...dataset,
    data: dataset.data.map(({ x, y }: { x: number; y: number }) => ({
      x: x,
      y: -y,
    })),
  };
}
