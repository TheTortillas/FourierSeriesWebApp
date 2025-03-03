import { Injectable } from '@angular/core';

interface Axis {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

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

@Injectable({
  providedIn: 'root',
})
export class CanvasDrawingService {
  /**
   * Dibuja el plano cartesiano completo (fondo, ejes, cuadrícula)
   */
  drawScreen(config: DrawScreenConfig): void {
    const {
      ctx,
      width,
      height,
      offsetX,
      offsetY,
      origin,
      bgColor,
      axisColor,
      gridColor,
      fontColor,
      unit,
    } = config;

    // Verifica si el contexto es nulo
    if (!ctx) return;

    // Limpia el canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Establece el estilo de la fuente
    ctx.font = '14px CMU Serif';

    // Calcula los ejes X y Y
    const XAxis: Axis = {
      start: { x: 0, y: height / 2 },
      end: { x: width, y: height / 2 },
    };
    const YAxis: Axis = {
      start: { x: width / 2, y: 0 },
      end: { x: width / 2, y: height },
    };

    // Dibuja ejes
    this.drawAxes(ctx, XAxis, YAxis, axisColor, offsetX, offsetY);

    // Dibuja cuadrícula
    this.drawGrid(ctx, origin, XAxis, YAxis, unit, gridColor, fontColor, offsetX, offsetY);
  }

  /**
   * Dibuja los ejes X y Y
   */
  drawAxes(
    ctx: CanvasRenderingContext2D,
    XAxis: Axis,
    YAxis: Axis,
    axisColor: string,
    offsetX: number,
    offsetY: number
  ): void {
    ctx.beginPath();
    // Eje X
    ctx.moveTo(XAxis.start.x, XAxis.start.y - offsetY);
    ctx.lineTo(XAxis.end.x, XAxis.end.y - offsetY);
    // Eje Y
    ctx.moveTo(YAxis.start.x - offsetX, YAxis.start.y);
    ctx.lineTo(YAxis.end.x - offsetX, YAxis.end.y);

    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Dibuja la cuadrícula en el plano cartesiano
   */
  drawGrid(
    ctx: CanvasRenderingContext2D,
    origin: { x: number; y: number },
    XAxis: Axis,
    YAxis: Axis,
    unit: number,
    gridColor: string,
    fontColor: string,
    offsetX: number,
    offsetY: number
  ): void {
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = fontColor;

    const cuadrosGrandesFrecuencia = unit >= 65 ? 1 : 5;

    // Líneas verticales
    for (let i = -1000; i < 1000; i++) {
      const x = origin.x + unit * i - offsetX;

      // Dibujar líneas pequeñas
      if (unit >= 25 && cuadrosGrandesFrecuencia === 1) {
        for (let j = 1; j < 5; j++) {
          const smallX = x + unit * (j / 5);
          ctx.beginPath();
          ctx.moveTo(smallX, YAxis.start.y);
          ctx.lineTo(smallX, YAxis.end.y);
          ctx.lineWidth = 0.25;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.moveTo(x, YAxis.start.y);
      ctx.lineTo(x, YAxis.end.y);
      ctx.lineWidth = i % cuadrosGrandesFrecuencia === 0 ? 1 : 0.25;
      ctx.stroke();

      // Números en el eje X
      if (i !== 0 && i % cuadrosGrandesFrecuencia === 0) {
        ctx.fillText(i.toString(), x, origin.y - offsetY);
      }
    }

    // Líneas horizontales
    for (let i = -1000; i < 1000; i++) {
      const y = origin.y + unit * i - offsetY;

      if (unit >= 25 && cuadrosGrandesFrecuencia === 1) {
        for (let j = 1; j < 5; j++) {
          const smallY = y + unit * (j / 5);
          ctx.beginPath();
          ctx.moveTo(XAxis.start.x, smallY);
          ctx.lineTo(XAxis.end.x, smallY);
          ctx.lineWidth = 0.25;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.moveTo(XAxis.start.x, y);
      ctx.lineTo(XAxis.end.x, y);
      ctx.lineWidth = i % cuadrosGrandesFrecuencia === 0 ? 1 : 0.25;
      ctx.stroke();

      // Números en el eje Y
      if (i !== 0 && i % cuadrosGrandesFrecuencia === 0) {
        ctx.fillText((-i).toString(), origin.x - offsetX, y);
      }
    }
  }
}
