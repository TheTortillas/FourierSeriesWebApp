export interface DrawScreenConfig {
  ctx: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  origin: { x: number; y: number };
  bgColor: string;
  axisColor: string;
  gridColor: string;
  fontColor: string;
  unit: number;
}
