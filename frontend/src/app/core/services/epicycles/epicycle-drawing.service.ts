import { Injectable } from '@angular/core';
import { EpicycleState, Point2D, EpicycleVisualizationConfig } from '../../../interfaces/epicycle.interface';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

@Injectable({
  providedIn: 'root'
})
export class EpicycleDrawingService {

  /**
   * Dibuja un epiciclo completo (círculo + línea + punto)
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param state Estado del epiciclo
   */
  drawEpicycle(ctx: CanvasRenderingContext2D, config: PlotConfig, state: EpicycleState): void {
    // Dibujar círculo del epiciclo
    this.drawCircle(
      ctx, 
      config, 
      state.centerX, 
      state.centerY, 
      state.epicycle.amplitude, 
      state.epicycle.color, 
      1
    );

    // Dibujar línea radial
    this.drawLine(
      ctx,
      config,
      state.centerX,
      state.centerY,
      state.currentX,
      state.currentY,
      state.epicycle.color,
      2
    );

    // Dibujar flecha en el borde del círculo
    this.drawArrow(
      ctx,
      config,
      state.centerX,
      state.centerY,
      state.currentX,
      state.currentY,
      state.epicycle.color,
      8
    );
  }

  /**
   * Dibuja múltiples epiciclos
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param states Array de estados de epiciclos
   */
  drawEpicycles(ctx: CanvasRenderingContext2D, config: PlotConfig, states: EpicycleState[]): void {
    states.forEach(state => {
      this.drawEpicycle(ctx, config, state);
    });
  }

  /**
   * Dibuja un círculo en el sistema de coordenadas matemáticas
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param centerX Centro X en coordenadas matemáticas
   * @param centerY Centro Y en coordenadas matemáticas
   * @param radius Radio en unidades matemáticas
   * @param color Color del círculo
   * @param lineWidth Grosor de línea
   */
  drawCircle(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    centerX: number,
    centerY: number,
    radius: number,
    color: string,
    lineWidth: number
  ): void {
    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;
    
    const centerXPixel = origin.x + centerX * unit * scaleX - offsetX;
    const centerYPixel = origin.y - centerY * unit * scaleY - offsetY;
    const radiusPixel = radius * unit * scaleX;

    ctx.beginPath();
    ctx.arc(centerXPixel, centerYPixel, radiusPixel, 0, 2 * Math.PI);
    ctx.strokeStyle = color + '40'; // Semi-transparente
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /**
   * Dibuja una línea en el sistema de coordenadas matemáticas
   */
  drawLine(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number
  ): void {
    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    const x1Pixel = origin.x + x1 * unit * scaleX - offsetX;
    const y1Pixel = origin.y - y1 * unit * scaleY - offsetY;
    const x2Pixel = origin.x + x2 * unit * scaleX - offsetX;
    const y2Pixel = origin.y - y2 * unit * scaleY - offsetY;

    ctx.beginPath();
    ctx.moveTo(x1Pixel, y1Pixel);
    ctx.lineTo(x2Pixel, y2Pixel);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /**
   * Dibuja un punto en el sistema de coordenadas matemáticas
   */
  drawPoint(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    x: number,
    y: number,
    color: string,
    radius: number
  ): void {
    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    const xPixel = origin.x + x * unit * scaleX - offsetX;
    const yPixel = origin.y - y * unit * scaleY - offsetY;

    ctx.beginPath();
    ctx.arc(xPixel, yPixel, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Dibuja una pequeña flecha al final de una línea
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param fromX Coordenada X del inicio
   * @param fromY Coordenada Y del inicio
   * @param toX Coordenada X del final
   * @param toY Coordenada Y del final
   * @param color Color de la flecha
   * @param size Tamaño de la flecha
   */
  drawArrow(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    size: number = 8
  ): void {
    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    // Convertir coordenadas a píxeles
    const toXPixel = origin.x + toX * unit * scaleX - offsetX;
    const toYPixel = origin.y - toY * unit * scaleY - offsetY;
    const fromXPixel = origin.x + fromX * unit * scaleX - offsetX;
    const fromYPixel = origin.y - fromY * unit * scaleY - offsetY;

    // Calcular ángulo de la línea
    const angle = Math.atan2(toYPixel - fromYPixel, toXPixel - fromXPixel);
    
    // Calcular puntos de la flecha
    const arrowLength = size;
    const arrowAngle = Math.PI / 6; // 30 grados
    
    const x1 = toXPixel - arrowLength * Math.cos(angle - arrowAngle);
    const y1 = toYPixel - arrowLength * Math.sin(angle - arrowAngle);
    
    const x2 = toXPixel - arrowLength * Math.cos(angle + arrowAngle);
    const y2 = toYPixel - arrowLength * Math.sin(angle + arrowAngle);
    
    // Dibujar la punta de flecha
    ctx.beginPath();
    ctx.moveTo(toXPixel, toYPixel);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    // Opcional: agregar borde a la flecha
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Dibuja puntos conectados formando una línea
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param points Array de puntos
   * @param color Color de la línea
   * @param lineWidth Grosor de línea
   */
  drawConnectedPoints(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    points: Point2D[],
    color: string,
    lineWidth: number
  ): void {
    if (points.length < 2) return;

    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    // Mover al primer punto
    const firstPoint = points[0];
    const firstXPixel = origin.x + firstPoint.x * unit * scaleX - offsetX;
    const firstYPixel = origin.y - firstPoint.y * unit * scaleY - offsetY;
    ctx.moveTo(firstXPixel, firstYPixel);

    // Dibujar líneas a los puntos restantes
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const xPixel = origin.x + point.x * unit * scaleX - offsetX;
      const yPixel = origin.y - point.y * unit * scaleY - offsetY;
      ctx.lineTo(xPixel, yPixel);
    }

    ctx.stroke();
  }

  /**
   * Dibuja puntos discretos (para visualizar muestras)
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param points Array de puntos
   * @param color Color de los puntos
   * @param radius Radio de los puntos
   */
  drawDiscretePoints(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    points: Point2D[],
    color: string,
    radius: number = 3
  ): void {
    const { origin, offsetX, offsetY, unit, scaleX = 1, scaleY = 1 } = config;

    ctx.fillStyle = color;

    points.forEach((point, index) => {
      const xPixel = origin.x + point.x * unit * scaleX - offsetX;
      const yPixel = origin.y - point.y * unit * scaleY - offsetY;

      ctx.beginPath();
      ctx.arc(xPixel, yPixel, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Opcional: dibujar el índice del punto
      if (points.length < 50) { // Solo para conjuntos pequeños
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(index.toString(), xPixel, yPixel - radius - 2);
        ctx.fillStyle = color;
      }
    });
  }

  /**
   * Dibuja elementos DFT adicionales según la configuración
   * @param ctx Contexto del canvas
   * @param config Configuración del plot
   * @param sampledPoints Puntos muestreados originales
   * @param approximationPoints Puntos de la aproximación DFT
   * @param visualConfig Configuración de visualización
   */
  drawDFTElements(
    ctx: CanvasRenderingContext2D,
    config: PlotConfig,
    sampledPoints: Point2D[],
    approximationPoints: Point2D[],
    visualConfig: EpicycleVisualizationConfig
  ): void {
    // Dibujar puntos muestreados
    if (visualConfig.showSampledPoints && sampledPoints.length > 0) {
      this.drawDiscretePoints(ctx, config, sampledPoints, '#ff6b6b', 2);
    }

    // Dibujar aproximación completa
    if (visualConfig.showApproximation && approximationPoints.length > 0) {
      this.drawConnectedPoints(ctx, config, approximationPoints, '#00ff88', 2);
    }
  }
}