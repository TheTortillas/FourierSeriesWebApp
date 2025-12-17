export interface EpicycleData {
  amplitude: number;
  frequency: number;
  phase: number;
  color: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface EpicycleCalculationResult {
  finalPoint: Point2D;
  epicycleStates: EpicycleState[];
}

export interface EpicycleState {
  centerX: number;
  centerY: number;
  currentX: number;
  currentY: number;
  epicycle: EpicycleData;
}

export interface DFTOptions {
  samplePoints: number;
  maxEpicycles: number;
}

export interface AnimationConfig {
  speed: number;
  isAnimating: boolean;
  showTrace: boolean;
  maxTracePoints: number;
}

export interface EpicycleVisualizationConfig {
  showSampledPoints: boolean;
  showApproximation: boolean;
  showTrace: boolean;
  showDftVisualization: boolean;
  epicycleCount: number;
}