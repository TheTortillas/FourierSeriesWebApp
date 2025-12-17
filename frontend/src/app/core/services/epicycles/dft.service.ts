import { Injectable } from '@angular/core';
import { EpicycleData, Point2D, DFTOptions } from '../../../interfaces/epicycle.interface';

@Injectable({
  providedIn: 'root'
})
export class DFTService {

  /**
   * Calcula la Transformada Discreta de Fourier de un path de puntos
   * @param path Array de puntos 2D
   * @param options Opciones de configuración para DFT
   * @returns Array de datos de epiciclos ordenados por amplitud
   */
  calculateDFT(path: Point2D[], options?: Partial<DFTOptions>): EpicycleData[] {
    const opts: DFTOptions = {
      samplePoints: 200,
      maxEpicycles: 100,
      ...options
    };

    if (path.length === 0) return [];

    const N = path.length;
    const epicycles: EpicycleData[] = [];

    // Calcular DFT para frecuencias de -N/2 a N/2
    for (let k = -Math.floor(N/2); k < Math.floor(N/2); k++) {
      let realSum = 0;
      let imagSum = 0;

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        realSum += path[n].x * cos - path[n].y * sin;
        imagSum += path[n].x * sin + path[n].y * cos;
      }

      realSum /= N;
      imagSum /= N;

      const amplitude = Math.sqrt(realSum * realSum + imagSum * imagSum);
      const phase = Math.atan2(imagSum, realSum);
      
      if (amplitude > 0.001) { // Filtrar amplitudes muy pequeñas
        epicycles.push({
          amplitude,
          frequency: k,
          phase,
          color: this.getFrequencyColor(k, Math.floor(N/2))
        });
      }
    }

    // Ordenar por amplitud (los más importantes primero)
    return epicycles
      .sort((a, b) => b.amplitude - a.amplitude)
      .slice(0, Math.min(opts.maxEpicycles, epicycles.length));
  }

  /**
   * Muestrea un path a un número específico de puntos
   * @param path Path original
   * @param numSamples Número de puntos deseados
   * @returns Path muestreado
   */
  samplePath(path: Point2D[], numSamples: number): Point2D[] {
    if (path.length <= numSamples) return [...path];

    const sampled: Point2D[] = [];
    const step = (path.length - 1) / (numSamples - 1);

    for (let i = 0; i < numSamples; i++) {
      const index = Math.round(i * step);
      sampled.push({ ...path[Math.min(index, path.length - 1)] });
    }

    return sampled;
  }

  /**
   * Normaliza los puntos a un rango específico
   * @param points Puntos originales
   * @param targetRange Rango objetivo (default: 200)
   * @returns Puntos normalizados
   */
  normalizePoints(points: Point2D[], targetRange: number = 200): Point2D[] {
    if (points.length === 0) return [];

    // Encontrar el centro y rango de los datos
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const maxRange = Math.max(rangeX, rangeY);

    const scale = maxRange > 0 ? targetRange / maxRange : 1;

    return points.map(point => ({
      x: (point.x - centerX) * scale,
      y: (point.y - centerY) * scale
    }));
  }

  /**
   * Genera la aproximación completa de una forma usando epiciclos
   * @param epicycles Array de epiciclos
   * @param numPoints Número de puntos a generar
   * @returns Array de puntos que forman la aproximación
   */
  generateApproximation(epicycles: EpicycleData[], numPoints: number = 1000): Point2D[] {
    const points: Point2D[] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * 2 * Math.PI;
      let x = 0;
      let y = 0;

      epicycles.forEach(epicycle => {
        const angle = t * epicycle.frequency + epicycle.phase;
        x += epicycle.amplitude * Math.cos(angle);
        y += epicycle.amplitude * Math.sin(angle);
      });

      points.push({ x, y });
    }

    return points;
  }

  /**
   * Genera un color basado en la frecuencia del epiciclo
   * @param freq Frecuencia del epiciclo
   * @param maxFreq Frecuencia máxima
   * @returns Color hex
   */
  private getFrequencyColor(freq: number, maxFreq: number): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', 
      '#a55eea', '#26de81', '#fd79a8', '#feca57', 
      '#48dbfb', '#ff9ff3'
    ];
    const index = Math.abs(freq) % colors.length;
    return colors[index];
  }

  /**
   * Parsea datos CSV en formato x,y
   * @param csvText Texto CSV
   * @returns Array de puntos
   */
  parseCsvData(csvText: string): Point2D[] {
    const lines = csvText.trim().split('\n');
    const points: Point2D[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const parts = trimmedLine.split(',').map(part => part.trim());
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);

        if (!isNaN(x) && !isNaN(y)) {
          points.push({ x, y });
        }
      }
    }

    return points;
  }
}