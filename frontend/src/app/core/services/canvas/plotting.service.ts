import { Injectable } from '@angular/core';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

@Injectable({
  providedIn: 'root',
})
export class PlottingService {
  /**
   * Dibuja una línea discreta con una "bolita hueca" al final.
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
    } = config;
    if (!ctx) return;

    // Coordenadas finales en el espacio matemático
    const endY = startY + n;

    // Convertir de unidades matemáticas a píxeles, ajustando por factor de escala
    const xRaw = startX / xAxisFactor; // Convertimos a escala visual
    const startXPixel = origin.x - offsetX + unit * xRaw;
    const startYPixel = origin.y - offsetY - unit * startY;
    const endYPixel = origin.y - offsetY - unit * endY;

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
    } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel (px) a coordenada matemática, ajustando por factor de escala
      const xRaw = (px + offsetX) / unit - width / unit / 2;
      // Aplicar factor de escala según el tipo seleccionado
      const x = xRaw * xAxisFactor;
      const y = mathFunction(x);

      // Calcular la posición en píxeles, teniendo en cuenta el factor de escala
      const pixelX = origin.x - offsetX + unit * xRaw;
      const pixelY = origin.y - offsetY - unit * y;

      // Dibuja línea desde el punto anterior al actual
      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(pixelX, pixelY);
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      previousX = pixelX;
      previousY = pixelY;
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
      const canvasX = origin.x - offsetX + unit * xRaw;
      const canvasY = origin.y - offsetY - unit * y;

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
   * @param seriesTerm Función que recibe (n, x) y devuelve el término n-ésimo de la serie evaluado en x.
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
    } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel a coordenada matemática
      const xRaw = (px + offsetX) / unit - width / unit / 2;
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
          origin.x - offsetX + unit * xRaw,
          origin.y - offsetY - unit * sum
        );
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      previousX = origin.x - offsetX + unit * xRaw;
      previousY = origin.y - offsetY - unit * sum;
    }
  }

  /**
   * Dibuja la suma parcial de una serie de Fourier trigonométrica.
   * @param a0 Coeficiente constante
   * @param anFunction Función para calcular coeficiente an para cada n
   * @param bnFunction Función para calcular coeficiente bn para cada n
   * @param w0 Frecuencia angular
   * @param terms Cantidad de términos a sumar
   * @param color Color de la curva
   * @param lineWidth Grosor de la línea
   */
  drawFourierSeries(
    config: PlotConfig,
    a0: number,
    anFunction: ((n: number) => number) | null,
    bnFunction: ((n: number) => number) | null,
    w0: number,
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
    } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel a coordenada matemática
      const xRaw = (px + offsetX) / unit - width / unit / 2;
      // Aplicar factor de escala según el tipo seleccionado
      const x = xRaw * xAxisFactor;

      // Inicializar la suma con el término constante a0
      let sum = a0;

      // Sumar términos de la serie para cada n
      for (let n = 1; n <= terms; n++) {
        // Sumar término coseno si anFunction está definida
        if (anFunction) {
          const an = anFunction(n);
          if (an !== 0) {
            // Evitar sumar términos nulos
            sum += an * Math.cos(n * w0 * x);
          }
        }

        // Sumar término seno si bnFunction está definida
        if (bnFunction) {
          const bn = bnFunction(n);
          if (bn !== 0) {
            // Evitar sumar términos nulos
            sum += bn * Math.sin(n * w0 * x);
          }
        }
      }

      // Dibujar línea entre puntos consecutivos
      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(
          origin.x - offsetX + unit * xRaw,
          origin.y - offsetY - unit * sum
        );
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
      previousX = origin.x - offsetX + unit * xRaw;
      previousY = origin.y - offsetY - unit * sum;
    }
  }

  /**
   * Dibuja la serie de Fourier a partir de coeficientes numéricos precalculados.
   * @param a0 Coeficiente constante
   * @param aCoefficients Array con los coeficientes an
   * @param bCoefficients Array con los coeficientes bn
   * @param w0 Frecuencia angular
   * @param terms Cantidad de términos a sumar (máximo la longitud de los arrays)
   * @param color Color de la curva
   * @param lineWidth Grosor de la línea
   */
  drawFourierSeriesFromCoefficients(
    config: PlotConfig,
    a0: number,
    aCoefficients: number[],
    bCoefficients: number[],
    w0: number,
    terms: number,
    color: string,
    lineWidth: number = 2
  ): void {
    // Limita términos al tamaño de los arrays disponibles
    const maxTerms = Math.min(
      terms,
      aCoefficients ? aCoefficients.length : 0,
      bCoefficients ? bCoefficients.length : 0
    );

    // Crear funciones a partir de los arrays
    const anFunction =
      aCoefficients && aCoefficients.length > 0
        ? (n: number) => (n <= aCoefficients.length ? aCoefficients[n - 1] : 0)
        : null;

    const bnFunction =
      bCoefficients && bCoefficients.length > 0
        ? (n: number) => (n <= bCoefficients.length ? bCoefficients[n - 1] : 0)
        : null;

    this.drawFourierSeries(
      config,
      a0,
      anFunction,
      bnFunction,
      w0,
      maxTerms,
      color,
      lineWidth
    );
  }
}
