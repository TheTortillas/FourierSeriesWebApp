import { Injectable } from '@angular/core';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

@Injectable({
  providedIn: 'root',
})
export class PlottingService {
  /**
   * Dibuja una línea discreta con una bolita al final.
   * @param startX Coordenada inicial X (espacio matemático)
   * @param startY Coordenada inicial Y (espacio matemático)
   * @param n Cuánto se va a "elevar" esa línea
   * @param color Color de la línea
   * @param lineWidth Grosor de la línea
   */
  drawDiscreteLine(
    config: PlotConfig,
    startX: number,
    startY: number,
    n: number,
    color: string,
    lineWidth: number = 2.5
  ): void {
    const {
      ctx,
      origin,
      offsetX,
      offsetY,
      unit,
      xAxisScale = 'integer',
      xAxisFactor = 1,
      scaleX = 1,
      scaleY = 1,
    } = config;
    if (!ctx) return;

    // Coordenadas finales en el espacio matemático
    const endY = startY + n;

    // Convertir de unidades matemáticas a píxeles, ajustando por factor de escala
    const xRaw = startX / xAxisFactor; // Convertimos a escala visual
    const startXPixel = origin.x - offsetX + unit * scaleX * xRaw;
    const startYPixel = origin.y - offsetY - unit * scaleY * startY;
    const endYPixel = origin.y - offsetY - unit * scaleY * endY;

    // Dibujar la línea
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(startXPixel, startYPixel);
    ctx.lineTo(startXPixel, endYPixel);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Dibujar la bolita hueca al final de la línea
    ctx.beginPath();
    ctx.arc(startXPixel, endYPixel, 5, 0, 2 * Math.PI);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /**
   * Dibuja una función matemática en todo el rango de pixeles del canvas.
   * OPTIMIZADO: Usa un solo path para toda la función en lugar de uno por píxel
   * @param mathFunction Función de x -> y
   * @param color Color de la curva
   * @param lineWidth Grosor de la línea
   */
  drawFunction(
    config: PlotConfig,
    mathFunction: (x: number) => number,
    color: string,
    lineWidth: number = 2
  ): void {
    const {
      ctx,
      width,
      unit,
      offsetX,
      offsetY,
      origin,
      xAxisScale = 'integer',
      xAxisFactor = 1,
      scaleX = 1,
      scaleY = 1,
    } = config;
    if (!ctx) return;

    // Configurar el estilo una sola vez antes de comenzar
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    let firstPoint = true;
    const maxDiscontinuityGap = 100; // Umbral para detectar discontinuidades
    let lastY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel (px) a coordenada matemática, ajustando por factor de escala
      const xRaw =
        (px + offsetX) / (unit * scaleX) - width / (unit * scaleX) / 2;
      // Aplicar factor de escala según el tipo seleccionado
      const x = xRaw * xAxisFactor;
      const y = mathFunction(x);

      // Calcular la posición en píxeles, teniendo en cuenta el factor de escala
      const pixelX = origin.x - offsetX + unit * scaleX * xRaw;
      const pixelY = origin.y - offsetY - unit * scaleY * y;

      // Saltar valores inválidos (NaN, Infinity)
      if (!isFinite(y)) {
        // Si encontramos un valor inválido, dibujar lo que tenemos hasta ahora
        if (!firstPoint) {
          ctx.stroke();
          ctx.beginPath();
          firstPoint = true;
        }
        lastY = undefined;
        continue;
      }

      // Detectar discontinuidades grandes
      if (!firstPoint && lastY !== undefined) {
        if (
          Math.abs(pixelY - (origin.y - offsetY - unit * scaleY * lastY)) >
          maxDiscontinuityGap
        ) {
          // Hay una discontinuidad, dibujar el path actual y comenzar uno nuevo
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pixelX, pixelY);
          lastY = y;
          continue;
        }
      }

      if (firstPoint) {
        ctx.moveTo(pixelX, pixelY);
        firstPoint = false;
      } else {
        ctx.lineTo(pixelX, pixelY);
      }

      lastY = y;
    }

    // Dibujar el path completo de una sola vez
    if (!firstPoint) {
      ctx.stroke();
    }
  }

  /**
   * Dibuja una función matemática únicamente en el intervalo [a, b].
   * @param mathFunction Función de x -> y
   * @param color Color de la curva
   * @param a Límite inferior del intervalo
   * @param b Límite superior del intervalo
   * @param lineWidth Grosor de la línea
   */
  drawFunctionFromAToB(
    config: PlotConfig,
    mathFunction: (x: number) => number,
    color: string,
    a: number,
    b: number,
    lineWidth: number = 2
  ): void {
    const {
      ctx,
      offsetX,
      offsetY,
      origin,
      unit,
      xAxisScale = 'integer',
      xAxisFactor = 1,
      scaleX = 1,
      scaleY = 1,
    } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;
    const steps = 1000; // Número de pasos para "muestrear" la función

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Calcular x en unidades matemáticas (ya escaladas con xAxisFactor)
      const x = a + t * (b - a);
      const y = mathFunction(x);

      // Convertir de unidades matemáticas a píxeles
      // Convertir el valor de x de nuevo a la escala visual
      const xRaw = x / xAxisFactor;
      const canvasX = origin.x - offsetX + unit * scaleX * xRaw;
      const canvasY = origin.y - offsetY - unit * scaleY * y;

      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(canvasX, canvasY);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      previousX = canvasX;
      previousY = canvasY;
    }
  }

  /**
   * Dibuja la suma parcial de una serie, con la cantidad de términos indicada.
   * @param seriesTerm Función que recibe (n, x) y la suma parcial de la serie hasta el n-ésimo término.
   * @param terms Cantidad de términos a sumar
   * @param color Color de la curva
   * @param lineWidth Grosor de la línea
   */
  drawSeries(
    config: PlotConfig,
    seriesTerm: (n: number, x: number) => number,
    terms: number,
    color: string,
    lineWidth: number = 2
  ): void {
    const {
      ctx,
      width,
      unit,
      offsetX,
      offsetY,
      origin,
      xAxisScale = 'integer',
      xAxisFactor = 1,
      scaleX = 1,
      scaleY = 1,
    } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel a coordenada matemática
      const xRaw =
        (px + offsetX) / (unit * scaleX) - width / (unit * scaleX) / 2;
      // Aplicar factor de escala según el tipo seleccionado
      const x = xRaw * xAxisFactor;

      // Suma parcial de la serie
      let sum = 0;
      for (let n = 1; n <= terms; n++) {
        sum += seriesTerm(n, x);
      }

      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(
          origin.x - offsetX + unit * scaleX * xRaw,
          origin.y - offsetY - unit * scaleY * sum
        );
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      previousX = origin.x - offsetX + unit * scaleX * xRaw;
      previousY = origin.y - offsetY - unit * scaleY * sum;
    }
  }
}
