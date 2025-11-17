import { Injectable } from '@angular/core';
import { Axis } from '../../../interfaces/axis.interface';
import { DrawScreenConfig } from '../../../interfaces/draw-screen-config.interface';

@Injectable({
  providedIn: 'root',
})
export class CanvasDrawingService {
  /**
   * Dibuja el plano cartesiano completo (fondo, ejes, cuadrícula)
   * @param config Configuración del dibujo que incluye: contexto, dimensiones,
   *               desplazamientos, origen, colores, unidad y escala del eje X
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
      xAxisScale = 'integer', // Default to integer
      xAxisFactor = 1, // Default factor is 1
      scaleX = 1, // Default scale X
      scaleY = 1, // Default scale Y
    } = config;

    // Verifica si el contexto es nulo
    if (!ctx) return;

    // Limpia el canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Establece el estilo de la fuente
    ctx.font = '12px CMU Serif';

    // Calcula los ejes X y Y
    const XAxis: Axis = {
      start: { x: 0, y: height / 2 },
      end: { x: width, y: height / 2 },
    };
    const YAxis: Axis = {
      start: { x: width / 2, y: 0 },
      end: { x: width / 2, y: height },
    };

    // Primero dibujamos la cuadrícula con los parámetros de escala
    this.drawGrid(
      ctx,
      origin,
      XAxis,
      YAxis,
      unit,
      gridColor,
      fontColor,
      offsetX,
      offsetY,
      xAxisScale,
      xAxisFactor,
      scaleX,
      scaleY
    );

    // Después dibujamos los ejes para que queden por encima
    this.drawAxes(ctx, XAxis, YAxis, axisColor, offsetX, offsetY, unit, scaleY);
  }

  /**
   * Dibuja los ejes X y Y
   * @param ctx Contexto del canvas
   * @param XAxis Objeto con coordenadas de inicio y fin del eje X
   * @param YAxis Objeto con coordenadas de inicio y fin del eje Y
   * @param axisColor Color de los ejes
   * @param offsetX Desplazamiento horizontal
   * @param offsetY Desplazamiento vertical
   * @param unit Unidad base
   * @param scaleY Escala del eje Y
   */
  drawAxes(
    ctx: CanvasRenderingContext2D,
    XAxis: Axis,
    YAxis: Axis,
    axisColor: string,
    offsetX: number,
    offsetY: number,
    unit: number = 75,
    scaleY: number = 1
  ): void {
    // Establecer el estilo para ambos ejes - aumentamos el grosor
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5; // Aumentamos el grosor para que destaquen más

    // Dibujar el eje X
    ctx.beginPath();
    ctx.moveTo(XAxis.start.x, XAxis.start.y - offsetY);
    ctx.lineTo(XAxis.end.x, XAxis.end.y - offsetY);
    ctx.stroke();

    // Dibujar el eje Y
    ctx.beginPath();
    ctx.moveTo(YAxis.start.x - offsetX, YAxis.start.y);
    ctx.lineTo(YAxis.end.x - offsetX, YAxis.end.y);
    ctx.stroke();
  }

  /**
   * Dibuja la cuadrícula en el plano cartesiano
   * @param ctx Contexto del canvas
   * @param origin Coordenadas del origen
   * @param XAxis Objeto con coordenadas de inicio y fin del eje X
   * @param YAxis Objeto con coordenadas de inicio y fin del eje Y
   * @param unit Tamaño de cada unidad en píxeles
   * @param gridColor Color de la cuadrícula
   * @param fontColor Color del texto
   * @param offsetX Desplazamiento horizontal
   * @param offsetY Desplazamiento vertical
   * @param xAxisScale Escala del eje X ('integer', 'pi' o 'e')
   * @param xAxisFactor Factor de escala aplicado al eje X
   * @param scaleX Escala independiente para eje X
   * @param scaleY Escala independiente para eje Y
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
    offsetY: number,
    xAxisScale: 'integer' | 'pi' | 'e' = 'integer',
    xAxisFactor: number = 1,
    scaleX: number = 1,
    scaleY: number = 1
  ): void {
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = fontColor;

    // Calcular pasos "bonitos" para cada eje
    const stepX = this.computeNiceStep(scaleX, unit);
    const stepY = this.computeNiceStep(scaleY, unit);

    // Calcular rango visible en coordenadas matemáticas
    const width = XAxis.end.x;
    const height = YAxis.end.y;

    const startX = this.screenToMathX(0, origin, offsetX, unit, scaleX);
    const endX = this.screenToMathX(width, origin, offsetX, unit, scaleX);
    const startY = this.screenToMathY(height, origin, offsetY, unit, scaleY);
    const endY = this.screenToMathY(0, origin, offsetY, unit, scaleY);

    // Líneas verticales
    const kStartX = Math.ceil(startX / stepX);
    const kEndX = Math.floor(endX / stepX);

    for (let k = kStartX; k <= kEndX; k++) {
      const worldX = k * stepX;
      const px = this.mathToScreenX(worldX, origin, offsetX, unit, scaleX);

      if (px < -2 || px > width + 2) continue;

      const isAxis = Math.abs(worldX) < 1e-8;

      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);

      if (isAxis) {
        ctx.lineWidth = 0.5;
      } else if (k % 5 === 0) {
        ctx.lineWidth = 1;
      } else {
        ctx.lineWidth = 0.25;
      }
      ctx.strokeStyle = gridColor;
      ctx.stroke();
    }

    // Líneas horizontales
    const kStartY = Math.ceil(startY / stepY);
    const kEndY = Math.floor(endY / stepY);

    for (let k = kStartY; k <= kEndY; k++) {
      const worldY = k * stepY;
      const py = this.mathToScreenY(worldY, origin, offsetY, unit, scaleY);

      if (py < -2 || py > height + 2) continue;

      const isAxis = Math.abs(worldY) < 1e-8;

      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);

      if (isAxis) {
        ctx.lineWidth = 0.5;
      } else if (k % 5 === 0) {
        ctx.lineWidth = 1;
      } else {
        ctx.lineWidth = 0.25;
      }
      ctx.strokeStyle = gridColor;
      ctx.stroke();
    }

    // ===== Etiquetas de ejes =====
    ctx.fillStyle = fontColor;

    // Etiquetas en eje X
    const textY = Math.min(
      height - 5,
      Math.max(15, this.mathToScreenY(0, origin, offsetY, unit, scaleY) + 15)
    );

    let lastLabelX = -Infinity;
    for (let k = kStartX; k <= kEndX; k++) {
      const worldX = k * stepX;
      if (Math.abs(worldX) < 1e-8) continue; // no dibujar el 0

      const px = this.mathToScreenX(worldX, origin, offsetX, unit, scaleX);
      if (px < -50 || px > width + 50) continue;

      if (px - lastLabelX < 40) continue; // evitar etiquetas muy juntas
      lastLabelX = px;

      const label = this.formatXAxisLabel(worldX, xAxisScale);
      ctx.fillText(label, px + 3, textY);
    }

    // Etiquetas en eje Y
    const textX = Math.max(
      3,
      Math.min(
        width - 50,
        this.mathToScreenX(0, origin, offsetX, unit, scaleX) + 3
      )
    );

    let lastLabelY = -Infinity;
    for (let k = kStartY; k <= kEndY; k++) {
      const worldY = k * stepY;
      if (Math.abs(worldY) < 1e-8) continue;

      const py = this.mathToScreenY(worldY, origin, offsetY, unit, scaleY);
      if (py < -20 || py > height + 20) continue;

      if (Math.abs(py - lastLabelY) < 20) continue;
      lastLabelY = py;

      const label = this.formatNumber(worldY);
      ctx.fillText(label, textX, py - 3);
    }
  }

  /**
   * Calcula un paso "bonito" para la cuadrícula usando el algoritmo 1-2-5 × 10^n
   * @param scale Escala del eje
   * @param unit Unidad base en píxeles
   * @returns Paso en unidades matemáticas
   */
  private computeNiceStep(scale: number, unit: number): number {
    const pixelsPerUnit = unit * scale;
    const target = 36; // píxeles entre líneas principales aproximadamente ¡CUIDADO! Acá es donde al pasar por debajo de 36 el eje x negativo parpadea
    const raw = target / pixelsPerUnit; // en unidades matemáticas

    if (raw <= 0) return 1;

    const log10 = Math.log10(raw);
    const base = Math.pow(10, Math.floor(log10));
    const frac = raw / base;

    let step = base;
    if (frac > 5) step = 10 * base;
    else if (frac > 2) step = 5 * base;
    else if (frac > 1) step = 2 * base;

    return step;
  }

  /**
   * Convierte coordenada de pantalla X a coordenada matemática
   */
  private screenToMathX(
    px: number,
    origin: { x: number; y: number },
    offsetX: number,
    unit: number,
    scaleX: number
  ): number {
    return (px + offsetX - origin.x) / (unit * scaleX);
  }

  /**
   * Convierte coordenada de pantalla Y a coordenada matemática
   */
  private screenToMathY(
    py: number,
    origin: { x: number; y: number },
    offsetY: number,
    unit: number,
    scaleY: number
  ): number {
    return -(py + offsetY - origin.y) / (unit * scaleY);
  }

  /**
   * Convierte coordenada matemática X a coordenada de pantalla
   */
  private mathToScreenX(
    x: number,
    origin: { x: number; y: number },
    offsetX: number,
    unit: number,
    scaleX: number
  ): number {
    return origin.x + x * unit * scaleX - offsetX;
  }

  /**
   * Convierte coordenada matemática Y a coordenada de pantalla
   */
  private mathToScreenY(
    y: number,
    origin: { x: number; y: number },
    offsetY: number,
    unit: number,
    scaleY: number
  ): number {
    return origin.y - y * unit * scaleY - offsetY;
  }

  /**
   * Formatea un número para mostrar en etiquetas
   */
  private formatNumber(num: number): string {
    if (Math.abs(num) >= 1e6) {
      return num.toExponential(2);
    } else if (Math.abs(num) >= 100) {
      return Math.round(num).toString();
    } else if (Math.abs(num) >= 1) {
      return num.toFixed(1).replace(/\.0$/, '');
    } else if (Math.abs(num) >= 0.01) {
      return num.toFixed(4).replace(/\.?0+$/, '');
    } else if (num === 0) {
      return '0';
    } else {
      return num.toExponential(2);
    }
  }

  /**
   * Formatea la etiqueta del eje X según la escala seleccionada
   */
  private formatXAxisLabel(
    worldX: number,
    xAxisScale: 'integer' | 'pi' | 'e'
  ): string {
    const eps = 1e-8;

    if (Math.abs(worldX) < eps) return '0';

    if (xAxisScale === 'pi') {
      const multiple = worldX;
      const n = Math.round(multiple);
      const symbol = 'π';

      if (Math.abs(multiple - n) < 1e-6) {
        if (n === 1) return symbol;
        if (n === -1) return '-' + symbol;
        return n + symbol;
      } else {
        return this.formatNumber(multiple) + symbol;
      }
    } else if (xAxisScale === 'e') {
      const multiple = worldX;
      const n = Math.round(multiple);
      const symbol = 'e';

      if (Math.abs(multiple - n) < 1e-6) {
        if (n === 1) return symbol;
        if (n === -1) return '-' + symbol;
        return n + symbol;
      } else {
        return this.formatNumber(multiple) + symbol;
      }
    } else {
      return this.formatNumber(worldX);
    }
  }
}
