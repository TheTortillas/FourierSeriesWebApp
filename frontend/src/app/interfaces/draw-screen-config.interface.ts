/**
 * Interfaz que define la configuración necesaria para dibujar el plano cartesiano
 * y sus elementos en el canvas.
 */

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
  xAxisScale?: 'integer' | 'pi' | 'e';
  xAxisFactor?: number;
}