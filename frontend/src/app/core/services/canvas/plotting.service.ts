import { Injectable } from '@angular/core';
import { PlotConfig } from '../../../interfaces/plot-config.interface';

@Injectable({
  providedIn: 'root',
})
export class PlottingService {
  /**
   * Dibuja una línea discreta con una “bolita hueca” al final.
   * @param startX Coordenada inicial X (espacio matemático)
   * @param startY Coordenada inicial Y (espacio matemático)
   * @param n Cuánto se va a “elevar” esa línea
   * @param color Color de la línea
   */
  drawDiscreteLine(
    config: PlotConfig,
    startX: number,
    startY: number,
    n: number,
    color: string
  ): void {
    const { ctx, origin, offsetX, offsetY, unit } = config;
    if (!ctx) return;

    // Coordenadas finales en el espacio matemático
    const endY = startY + n;

    // Convertir coordenadas a píxeles
    const startXPixel = origin.x - offsetX + unit * startX;
    const startYPixel = origin.y - offsetY - unit * startY;
    const endYPixel = origin.y - offsetY - unit * endY;

    // Dibujar la línea
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(startXPixel, startYPixel);
    ctx.lineTo(startXPixel, endYPixel);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dibujar la bolita hueca al final de la línea
    ctx.beginPath();
    ctx.arc(startXPixel, endYPixel, 5, 0, 2 * Math.PI);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  /**
   * Dibuja una función matemática en todo el rango de pixeles del canvas.
   * @param mathFunction Función de x -> y
   * @param color Color de la curva
   */
  drawFunction(
    config: PlotConfig,
    mathFunction: (x: number) => number,
    color: string
  ): void {
    const { ctx, width, unit, offsetX, offsetY, origin } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // Convertir pixel (px) a coordenada matemática
      const x = (px + offsetX) / unit - width / unit / 2;
      const y = mathFunction(x);

      // Dibuja línea desde el punto anterior al actual
      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(
          origin.x - offsetX + unit * x,
          origin.y - offsetY - unit * y
        );
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      previousX = origin.x - offsetX + unit * x;
      previousY = origin.y - offsetY - unit * y;
    }
  }

  /**
   * Dibuja una función matemática únicamente en el intervalo [a, b].
   */
  drawFunctionFromAToB(
    config: PlotConfig,
    mathFunction: (x: number) => number,
    color: string,
    a: number,
    b: number
  ): void {
    const { ctx, offsetX, offsetY, origin, unit } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;
    const steps = 1000; // Número de pasos para “muestrear” la función

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a + t * (b - a);
      const y = mathFunction(x);

      const canvasX = origin.x - offsetX + unit * x;
      const canvasY = origin.y - offsetY - unit * y;

      if (previousX !== undefined && previousY !== undefined) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(canvasX, canvasY);
        ctx.lineWidth = 2;
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
   */
  drawSeries(
    config: PlotConfig,
    seriesTerm: (n: number, x: number) => number,
    terms: number,
    color: string
  ): void {
    const { ctx, width, unit, offsetX, offsetY, origin } = config;
    if (!ctx) return;

    let previousX: number | undefined = undefined;
    let previousY: number | undefined = undefined;

    for (let px = 0; px < width; px++) {
      // x en espacio matemático
      const x = (px + offsetX) / unit - width / unit / 2;

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
          origin.x - offsetX + unit * x,
          origin.y - offsetY - unit * sum
        );
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      previousX = origin.x - offsetX + unit * x;
      previousY = origin.y - offsetY - unit * sum;
    }
  }
}
