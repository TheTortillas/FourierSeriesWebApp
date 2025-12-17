import { Injectable } from '@angular/core';
import { EpicycleData, Point2D, EpicycleCalculationResult, EpicycleState } from '../../../interfaces/epicycle.interface';

@Injectable({
  providedIn: 'root'
})
export class EpicycleService {

  /**
   * Calcula la posición final y estados de todos los epiciclos en un tiempo dado
   * @param epicycles Array de epiciclos
   * @param time Tiempo actual
   * @returns Resultado con punto final y estados de cada epiciclo
   */
  calculateEpicycles(epicycles: EpicycleData[], time: number): EpicycleCalculationResult {
    let currentX = 0;
    let currentY = 0;
    const epicycleStates: EpicycleState[] = [];

    epicycles.forEach(epicycle => {
      const centerX = currentX;
      const centerY = currentY;

      // Calcular nueva posición
      const angle = time * epicycle.frequency + epicycle.phase;
      currentX = centerX + epicycle.amplitude * Math.cos(angle);
      currentY = centerY + epicycle.amplitude * Math.sin(angle);

      epicycleStates.push({
        centerX,
        centerY,
        currentX,
        currentY,
        epicycle: { ...epicycle }
      });
    });

    return {
      finalPoint: { x: currentX, y: currentY },
      epicycleStates
    };
  }

  /**
   * Calcula solo el punto final de los epiciclos (más eficiente)
   * @param epicycles Array de epiciclos
   * @param time Tiempo actual
   * @returns Punto final
   */
  calculateFinalPoint(epicycles: EpicycleData[], time: number): Point2D {
    let x = 0;
    let y = 0;

    epicycles.forEach(epicycle => {
      const angle = time * epicycle.frequency + epicycle.phase;
      x += epicycle.amplitude * Math.cos(angle);
      y += epicycle.amplitude * Math.sin(angle);
    });

    return { x, y };
  }

  /**
   * Genera epiciclos aleatorios para demostración
   * @param count Número de epiciclos a generar
   * @returns Array de epiciclos aleatorios
   */
  generateRandomEpicycles(count: number): EpicycleData[] {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#a55eea', '#26de81', '#fd79a8'];
    const epicycles: EpicycleData[] = [];

    for (let i = 0; i < count; i++) {
      epicycles.push({
        amplitude: Math.random() * 1.5 + 0.3,
        frequency: Math.floor(Math.random() * 8) + 1,
        phase: Math.random() * 2 * Math.PI,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    return epicycles;
  }

  /**
   * Crea un conjunto de epiciclos predefinidos
   * @returns Array de epiciclos por defecto
   */
  getDefaultEpicycles(): EpicycleData[] {
    return [
      { amplitude: 2, frequency: 1, phase: 0, color: '#ff6b6b' },
      { amplitude: 1.5, frequency: 2, phase: Math.PI / 4, color: '#4ecdc4' },
      { amplitude: 0.8, frequency: 3, phase: Math.PI / 2, color: '#45b7d1' },
      { amplitude: 0.5, frequency: 5, phase: 0, color: '#f9ca24' }
    ];
  }

  /**
   * Actualiza un epiciclo específico
   * @param epicycles Array de epiciclos
   * @param index Índice del epiciclo a actualizar
   * @param property Propiedad a actualizar
   * @param value Nuevo valor
   * @returns Nuevo array de epiciclos
   */
  updateEpicycle(
    epicycles: EpicycleData[], 
    index: number, 
    property: keyof EpicycleData, 
    value: any
  ): EpicycleData[] {
    if (index < 0 || index >= epicycles.length) return epicycles;

    const updated = [...epicycles];
    (updated[index] as any)[property] = value;
    return updated;
  }

  /**
   * Agrega un epiciclo aleatorio
   * @param epicycles Array actual de epiciclos
   * @returns Nuevo array con el epiciclo añadido
   */
  addRandomEpicycle(epicycles: EpicycleData[]): EpicycleData[] {
    const newEpicycles = this.generateRandomEpicycles(1);
    return [...epicycles, ...newEpicycles];
  }

  /**
   * Elimina el último epiciclo
   * @param epicycles Array actual de epiciclos
   * @returns Nuevo array sin el último epiciclo
   */
  removeLastEpicycle(epicycles: EpicycleData[]): EpicycleData[] {
    if (epicycles.length <= 1) return epicycles;
    return epicycles.slice(0, -1);
  }

  /**
   * Valida que un epiciclo tenga valores correctos
   * @param epicycle Epiciclo a validar
   * @returns true si es válido
   */
  validateEpicycle(epicycle: Partial<EpicycleData>): boolean {
    return (
      typeof epicycle.amplitude === 'number' &&
      epicycle.amplitude >= 0 &&
      typeof epicycle.frequency === 'number' &&
      typeof epicycle.phase === 'number' &&
      typeof epicycle.color === 'string' &&
      epicycle.color.length > 0
    );
  }
}