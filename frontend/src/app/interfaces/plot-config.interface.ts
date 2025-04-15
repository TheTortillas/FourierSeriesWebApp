export interface PlotConfig {
  ctx: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  unit: number;
  origin: { x: number; y: number };
  xAxisScale?: 'integer' | 'pi' | 'e';  
  xAxisFactor?: number;                 
}