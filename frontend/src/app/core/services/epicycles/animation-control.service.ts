import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnimationConfig, Point2D } from '../../../interfaces/epicycle.interface';

@Injectable({
  providedIn: 'root'
})
export class AnimationControlService {
  private animationId: number | null = null;
  private config: AnimationConfig = {
    speed: 0.02,
    isAnimating: false,
    showTrace: true,
    maxTracePoints: 500
  };

  private time = 0;
  private tracePoints: Point2D[] = [];

  // Observables para el estado de la animación
  private timeSubject = new BehaviorSubject<number>(0);
  private isAnimatingSubject = new BehaviorSubject<boolean>(false);
  private tracePointsSubject = new BehaviorSubject<Point2D[]>([]);

  // Getters públicos para los observables
  public readonly time$ = this.timeSubject.asObservable();
  public readonly isAnimating$ = this.isAnimatingSubject.asObservable();
  public readonly tracePoints$ = this.tracePointsSubject.asObservable();

  /**
   * Inicia la animación
   */
  startAnimation(): void {
    if (this.config.isAnimating) return;
    
    this.config.isAnimating = true;
    this.isAnimatingSubject.next(true);
    this.ensureRenderLoop();
  }

  /**
   * Pausa la animación
   */
  stopAnimation(): void {
    this.config.isAnimating = false;
    this.isAnimatingSubject.next(false);
    // No cancelar el animationFrame para mantener el redibujado adaptativo
  }

  /**
   * Alterna entre play/pause
   */
  toggleAnimation(): void {
    if (this.config.isAnimating) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }

  /**
   * Reinicia el tiempo y la estela
   */
  resetAnimation(): void {
    this.time = 0;
    this.tracePoints = [];
    this.timeSubject.next(this.time);
    this.tracePointsSubject.next([...this.tracePoints]);
  }

  /**
   * Limpia solo la estela
   */
  clearTrace(): void {
    this.tracePoints = [];
    this.tracePointsSubject.next([...this.tracePoints]);
  }

  /**
   * Actualiza la velocidad de animación
   * @param speed Nueva velocidad (0.001 - 0.1)
   */
  setSpeed(speed: number): void {
    this.config.speed = Math.max(0.001, Math.min(0.1, speed));
  }

  /**
   * Obtiene la velocidad actual
   */
  getSpeed(): number {
    return this.config.speed;
  }

  /**
   * Obtiene el tiempo actual
   */
  getCurrentTime(): number {
    return this.time;
  }

  /**
   * Obtiene el estado actual de animación
   */
  isCurrentlyAnimating(): boolean {
    return this.config.isAnimating;
  }

  /**
   * Obtiene los puntos de la estela actual
   */
  getCurrentTracePoints(): Point2D[] {
    return [...this.tracePoints];
  }

  /**
   * Configura si mostrar la estela
   * @param showTrace Mostrar estela
   */
  setShowTrace(showTrace: boolean): void {
    this.config.showTrace = showTrace;
  }

  /**
   * Configura el máximo de puntos de la estela
   * @param maxPoints Máximo número de puntos
   */
  setMaxTracePoints(maxPoints: number): void {
    this.config.maxTracePoints = Math.max(10, maxPoints);
    if (this.tracePoints.length > this.config.maxTracePoints) {
      this.tracePoints = this.tracePoints.slice(-this.config.maxTracePoints);
      this.tracePointsSubject.next([...this.tracePoints]);
    }
  }

  /**
   * Agrega un punto a la estela
   * @param point Punto a agregar
   */
  addTracePoint(point: Point2D): void {
    if (!this.config.isAnimating) return;

    this.tracePoints.push({ ...point });
    
    if (this.tracePoints.length > this.config.maxTracePoints) {
      this.tracePoints = this.tracePoints.slice(-this.config.maxTracePoints);
    }
    
    this.tracePointsSubject.next([...this.tracePoints]);
  }

  /**
   * Asegura que el bucle de renderizado esté activo
   */
  ensureRenderLoop(): void {
    if (this.animationId === null) {
      this.animate();
    }
  }

  /**
   * Incrementa el tiempo si la animación está activa
   */
  updateTime(): void {
    if (this.config.isAnimating) {
      this.time += this.config.speed;
      this.timeSubject.next(this.time);
    }
  }

  /**
   * Bucle principal de animación
   */
  private animate(): void {
    // Incrementar tiempo
    this.updateTime();

    // Continuar el bucle de renderizado si hay animación activa
    if (this.config.isAnimating) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
    }
  }

  /**
   * Destruye el servicio y limpia recursos
   */
  destroy(): void {
    this.config.isAnimating = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.timeSubject.complete();
    this.isAnimatingSubject.complete();
    this.tracePointsSubject.complete();
  }

  /**
   * Establece el tiempo actual
   * @param time Nuevo tiempo
   */
  setTime(time: number): void {
    this.time = time;
    this.timeSubject.next(this.time);
  }

  /**
   * Obtiene la configuración completa
   */
  getConfig(): AnimationConfig {
    return { ...this.config };
  }

  /**
   * Actualiza la configuración
   * @param newConfig Nueva configuración parcial
   */
  updateConfig(newConfig: Partial<AnimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.isAnimatingSubject.next(this.config.isAnimating);
  }
}