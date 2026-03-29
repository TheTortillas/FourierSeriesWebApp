import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api/api.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport, Curve } from '../../../core/services/canvas/canvas.types';
import { DftCoefficient, DftPoint, DftResponse } from '../../../domain/types/dft.types';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';

interface EpicyclePreset {
  id: string;
  label: string;
  points: DftPoint[];
}

interface EpicycleState {
  color: string;
  selected: boolean;
  centerX: number;
  centerY: number;
  endX: number;
  endY: number;
  radius: number;
}

type CoeffOrderMode = 'amplitude' | 'frequency';

interface RenderCoeff extends DftCoefficient {
  kSigned: number;
  amplitudeSafe: number;
  amplitudePercentSafe: number;
  phaseSafe: number;
  phaseInPiSafe: string;
}

const TAU = Math.PI * 2;

function circlePreset(samples: number, radius = 1): DftPoint[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = (i / samples) * TAU;
    return { x: radius * Math.cos(t), y: radius * Math.sin(t) };
  });
}

function starPreset(samples: number): DftPoint[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = (i / samples) * TAU;
    const r = 1 + 0.35 * Math.cos(5 * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  });
}

function lissajousPreset(samples: number): DftPoint[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = (i / samples) * TAU;
    return {
      x: 1.1 * Math.sin(3 * t + Math.PI / 2),
      y: 1.1 * Math.sin(2 * t),
    };
  });
}

@Component({
  selector: 'app-epicycles-panel',
  imports: [FormsModule, FunctionPlotComponent],
  template: `
    <div class="flex flex-col h-full gap-4">
      <h2 class="text-yellow-400 font-bold text-lg border-b border-gray-700 pb-2 shrink-0">
        Canvas - Epiciclos DFT (modo dev)
      </h2>

      <div class="grid grid-cols-1 xl:grid-cols-[26rem_1fr] gap-4 min-h-0 flex-1">
        <section class="border border-gray-700 rounded p-4 space-y-4 overflow-auto">
          <div class="space-y-2">
            <p class="text-gray-500 text-xs">Presets de figura</p>
            <div class="flex flex-wrap gap-2">
              @for (preset of presets; track preset.id) {
                <button
                  (click)="loadPreset(preset.id)"
                  class="bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-3 py-1 rounded transition-colors cursor-pointer"
                >
                  {{ preset.label }}
                </button>
              }
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-gray-500 text-xs">Puntos de entrada (x, y)</p>
              <span class="text-gray-600 text-[11px]">una fila por punto</span>
            </div>
            <textarea
              [ngModel]="rawPoints()"
              (ngModelChange)="rawPoints.set($event)"
              rows="11"
              class="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-2 text-xs text-gray-100 font-mono focus:outline-none focus:border-yellow-500"
            ></textarea>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              (click)="calculate()"
              [disabled]="loading()"
              class="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 text-sm font-semibold px-4 py-1.5 rounded transition-colors cursor-pointer"
            >
              @if (loading()) {
                Calculando...
              } @else {
                Calcular DFT (epicycles)
              }
            </button>

            <button
              (click)="resetAnimation()"
              class="bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>

          @if (error()) {
            <pre class="bg-red-950 text-red-300 rounded p-2 text-xs overflow-auto">{{
              error()
            }}</pre>
          }

          @if (result(); as res) {
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">N</p>
                <p class="text-gray-100 text-sm">{{ res.N }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">RMS (full)</p>
                <p class="text-gray-100 text-sm">{{ res.rmsError.toFixed(6) }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">Coeficientes</p>
                <p class="text-gray-100 text-sm">{{ res.coefficients.length }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">Tiempo</p>
                <p class="text-gray-100 text-sm">{{ res.executionTimeMs }} ms</p>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-gray-500 text-xs block">
                Top-K epiciclos: {{ topK() }} / {{ maxTopK() }}
              </label>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-gray-500">Orden:</span>
                <button
                  (click)="coeffOrder.set('amplitude')"
                  [class]="
                    coeffOrder() === 'amplitude'
                      ? 'bg-yellow-500 text-gray-900 text-[11px] px-2 py-1 rounded font-semibold cursor-pointer'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] px-2 py-1 rounded cursor-pointer'
                  "
                >
                  Amplitud
                </button>
                <button
                  (click)="coeffOrder.set('frequency')"
                  [class]="
                    coeffOrder() === 'frequency'
                      ? 'bg-yellow-500 text-gray-900 text-[11px] px-2 py-1 rounded font-semibold cursor-pointer'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] px-2 py-1 rounded cursor-pointer'
                  "
                >
                  Frecuencia
                </button>
              </div>
              <input
                type="range"
                min="1"
                [max]="maxTopK()"
                [ngModel]="topK()"
                (ngModelChange)="topK.set(+$event)"
                class="w-full accent-yellow-500"
              />
              <p class="text-[11px] text-gray-500">
                Cobertura amplitud: {{ topKCoverage().toFixed(2) }}%
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-gray-500 text-xs block">Velocidad: {{ speed().toFixed(3) }}</label>
              <input
                type="range"
                min="0.005"
                max="0.14"
                step="0.001"
                [ngModel]="speed()"
                (ngModelChange)="speed.set(+$event)"
                class="w-full accent-yellow-500"
              />
            </div>

            <div class="flex gap-2 flex-wrap">
              <button
                (click)="toggleAnimation()"
                class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                {{ isAnimating() ? 'Pausar' : 'Animar' }}
              </button>

              <button
                (click)="clearTrace()"
                class="bg-cyan-700 hover:bg-cyan-600 text-white text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                Limpiar trazo
              </button>

              <button
                (click)="showEpicycles.set(!showEpicycles())"
                class="bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                {{ showEpicycles() ? 'Ocultar' : 'Mostrar' }} epiciclos
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs">
              <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  [ngModel]="showOriginal()"
                  (ngModelChange)="showOriginal.set($event)"
                />
                Original
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  [ngModel]="showApproximation()"
                  (ngModelChange)="showApproximation.set($event)"
                />
                Aproximacion
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  [ngModel]="showTrace()"
                  (ngModelChange)="showTrace.set($event)"
                />
                Trazo
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  [ngModel]="showSampledPoints()"
                  (ngModelChange)="showSampledPoints.set($event)"
                />
                Muestras
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  [ngModel]="showEpicycles()"
                  (ngModelChange)="showEpicycles.set($event)"
                />
                Cadenas
              </label>
            </div>

            <div class="space-y-1 rounded border border-gray-700 p-2">
              <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
                <input
                  type="checkbox"
                  [ngModel]="autoNormalizeInput()"
                  (ngModelChange)="autoNormalizeInput.set($event)"
                />
                Auto-escalar coordenadas grandes
              </label>
              <p class="text-[11px] text-gray-500">
                Recomendado para puntos de SVG en miles: centra y escala antes de calcular.
              </p>
              @if (normalizationInfo(); as norm) {
                <p class="text-[11px] text-cyan-300">
                  Centro aplicado: ({{ norm.centerX.toFixed(2) }}, {{ norm.centerY.toFixed(2) }}) ·
                  escala: {{ norm.scale.toExponential(3) }}
                </p>
              }
            </div>

            <div class="space-y-2 pt-1">
              <p class="text-gray-500 text-xs">
                Inspector de coeficientes (
                @if (coeffOrder() === 'amplitude') {
                  amplitud
                } @else {
                  frecuencia
                }
                )
              </p>
              <div class="max-h-72 overflow-auto border border-gray-700 rounded">
                <table class="w-full text-[11px] font-mono">
                  <thead class="sticky top-0 bg-gray-900 text-gray-500">
                    <tr>
                      <th class="px-2 py-1 text-left">k</th>
                      <th class="px-2 py-1 text-left">|Ck|</th>
                      <th class="px-2 py-1 text-left">%</th>
                      <th class="px-2 py-1 text-left">fase</th>
                      <th class="px-2 py-1 text-left">freq</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of visibleCoefficients(); track $index; let i = $index) {
                      <tr
                        (click)="toggleSelectedCoefficient(c.k)"
                        [class]="
                          selectedCoeffK() === c.k
                            ? 'bg-cyan-500/15 border-t border-cyan-500/40 cursor-pointer'
                            : i < topK()
                              ? 'bg-yellow-500/10 border-t border-yellow-500/30 cursor-pointer'
                              : 'border-t border-gray-800 hover:bg-gray-800/40 cursor-pointer'
                        "
                      >
                        <td class="px-2 py-1 text-gray-100">{{ c.kSigned }}</td>
                        <td class="px-2 py-1 text-gray-200">{{ c.amplitudeSafe.toFixed(6) }}</td>
                        <td class="px-2 py-1 text-cyan-300">
                          {{ c.amplitudePercentSafe.toFixed(2) }}
                        </td>
                        <td class="px-2 py-1 text-gray-300">{{ c.phaseInPiSafe }}pi</td>
                        <td class="px-2 py-1 text-gray-400">{{ c.freq.toFixed(4) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="text-[11px] text-gray-600">
                Filas resaltadas = coeficientes actualmente usados por top-K.
              </p>
            </div>
          }
        </section>

        <section class="border border-gray-700 rounded overflow-hidden min-h-104 bg-gray-950">
          <app-function-plot [layers]="plotLayers()" [initialUnit]="100"></app-function-plot>
        </section>
      </div>

      <p class="text-gray-700 text-xs shrink-0">
        Modo dev: integra API real <span class="text-gray-500">POST /transforms/dft</span> con
        animacion de cadena de epiciclos basada en top-K.
      </p>
    </div>
  `,
})
export class EpicyclesPanelComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly coords = inject(CoordinateTransformService);

  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly rawPoints = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<DftResponse | null>(null);
  readonly sourcePoints = signal<DftPoint[]>([]);

  readonly topK = signal(18);
  readonly coeffOrder = signal<CoeffOrderMode>('amplitude');
  readonly speed = signal(0.03);
  readonly time = signal(0);
  readonly frameTick = signal(0);
  readonly isAnimating = signal(false);

  readonly showOriginal = signal(true);
  readonly showApproximation = signal(true);
  readonly showTrace = signal(true);
  readonly showSampledPoints = signal(false);
  readonly showEpicycles = signal(true);
  readonly selectedCoeffK = signal<number | null>(null);
  readonly autoNormalizeInput = signal(true);
  readonly normalizationInfo = signal<{
    applied: boolean;
    centerX: number;
    centerY: number;
    scale: number;
  } | null>(null);

  readonly trace = signal<DftPoint[]>([]);

  readonly presets: EpicyclePreset[] = [
    { id: 'circle', label: 'Circulo', points: circlePreset(180, 1) },
    { id: 'star', label: 'Estrella', points: starPreset(240) },
    { id: 'lissajous', label: 'Lissajous 3:2', points: lissajousPreset(220) },
  ];

  readonly normalizedCoefficients = computed<RenderCoeff[]>(() => {
    const res = this.result();
    if (!res || !Array.isArray(res.coefficients)) return [];

    const n = Math.max(1, res.N || res.coefficients.length || 1);
    const withSafeAmplitude = res.coefficients.map((c) => {
      const reSafe = this.toFiniteNumber(c.re);
      const imSafe = this.toFiniteNumber(c.im);
      const amp =
        Number.isFinite(c.amplitude) && c.amplitude > 0
          ? this.toFiniteNumber(c.amplitude)
          : Math.hypot(reSafe, imSafe);

      const kSigned = c.k > n / 2 ? c.k - n : c.k;
      const phaseCandidate = this.toFiniteNumber(c.phase);
      const phaseSafe = amp < 1e-12 ? 0 : phaseCandidate || Math.atan2(imSafe, reSafe);

      return {
        ...c,
        re: reSafe,
        im: imSafe,
        kSigned,
        amplitudeSafe: amp,
        amplitudePercentSafe: 0,
        phaseSafe,
        phaseInPiSafe: this.phaseToPiLabel(phaseSafe),
      };
    });

    const totalSafe = withSafeAmplitude.reduce((s, c) => s + c.amplitudeSafe, 0);

    return withSafeAmplitude.map((c) => ({
      ...c,
      amplitudePercentSafe: totalSafe > 0 ? (c.amplitudeSafe / totalSafe) * 100 : 0,
    }));
  });

  readonly orderedCoefficients = computed<RenderCoeff[]>(() => {
    const coeffs = this.normalizedCoefficients();

    if (this.coeffOrder() === 'frequency') {
      return [...coeffs].sort((a, b) => {
        const byAbs = Math.abs(a.kSigned) - Math.abs(b.kSigned);
        if (byAbs !== 0) return byAbs;
        return a.kSigned - b.kSigned;
      });
    }

    return [...coeffs].sort((a, b) => {
      const byAmp = b.amplitudeSafe - a.amplitudeSafe;
      if (byAmp !== 0) return byAmp;
      return Math.abs(a.kSigned) - Math.abs(b.kSigned);
    });
  });

  readonly maxTopK = computed(() => this.orderedCoefficients().length);

  readonly visibleCoefficients = computed(() => this.orderedCoefficients().slice(0, 240));

  readonly selectedCoefficients = computed(() => {
    const coeffs = this.orderedCoefficients();
    const count = Math.max(1, Math.min(this.topK(), coeffs.length || 1));
    return coeffs.slice(0, count);
  });

  readonly topKCoverage = computed(() =>
    this.selectedCoefficients().reduce((sum, c) => sum + c.amplitudePercentSafe, 0),
  );

  readonly epicycleStates = computed(() =>
    this.computeEpicycleStates(this.selectedCoefficients(), this.time()),
  );

  readonly approximationCurve = computed(() => {
    const coeffs = this.selectedCoefficients();
    if (coeffs.length === 0) return [] as DftPoint[];

    const samples = 420;
    const points: DftPoint[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * TAU;
      points.push(this.evaluatePoint(coeffs, t));
    }
    return points;
  });

  readonly endpoint = computed(() => {
    const states = this.epicycleStates();
    if (states.length === 0) return null;
    const last = states[states.length - 1];
    return { x: last.endX, y: last.endY };
  });

  readonly plotLayers = computed<PlotLayer[]>(() => {
    void this.frameTick();

    const original = this.sourcePoints();
    const approximation = this.approximationCurve();
    const trace = this.trace();

    const curves: Curve[] = [];

    if (this.showOriginal() && original.length > 1) {
      curves.push({
        points: this.closedPath(original),
        color: '#9ca3af',
        lineWidth: 1.2,
        dashed: true,
      });
    }

    if (this.showApproximation() && approximation.length > 1) {
      curves.push({
        points: approximation,
        color: '#22c55e',
        lineWidth: 2,
      });
    }

    if (this.showTrace() && trace.length > 1) {
      curves.push({
        points: trace,
        color: '#60a5fa',
        lineWidth: 2.1,
      });
    }

    return [
      {
        curves,
        onDraw: (ctx, vp) => this.drawEpicycleOverlay(ctx, vp),
      },
    ];
  });

  constructor() {
    this.loadPreset('circle');
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  loadPreset(id: string): void {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.rawPoints.set(this.formatPoints(preset.points));
    this.result.set(null);
    this.error.set(null);
    this.trace.set([]);
    this.time.set(0);
    this.selectedCoeffK.set(null);
  }

  async calculate(): Promise<void> {
    if (this.loading()) return;
    this.error.set(null);

    let parsed: DftPoint[];
    try {
      parsed = this.parsePoints(this.rawPoints());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Entrada invalida.');
      return;
    }

    const prepared = this.autoNormalizeInput() ? this.normalizePoints(parsed) : null;
    const effectivePoints = prepared?.points ?? parsed;
    this.normalizationInfo.set(prepared?.info ?? null);

    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.calculateDFT({ points: effectivePoints, mode: 'epicycles' }),
      );
      this.sourcePoints.set(effectivePoints);
      this.result.set(res);
      this.topK.set(Math.min(22, Math.max(1, res.coefficients.length)));
      this.time.set(0);
      this.trace.set([]);
      this.selectedCoeffK.set(null);
    } catch (err) {
      const anyErr = err as { error?: { error?: string }; message?: string };
      this.error.set(anyErr?.error?.error ?? anyErr?.message ?? 'No se pudo calcular la DFT.');
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  toggleAnimation(): void {
    if (this.isAnimating()) {
      this.stopAnimation();
      return;
    }

    if (typeof window === 'undefined') return;
    if (!this.result()) return;

    this.isAnimating.set(true);
    this.timerId = setInterval(() => {
      this.time.update((t) => {
        const next = t + this.speed();
        return next >= TAU ? next - TAU : next;
      });
      this.frameTick.update((v) => v + 1);

      const end = this.endpoint();
      if (end && this.showTrace()) {
        this.trace.update((pts) => {
          const nextPts = [...pts, end];
          if (nextPts.length > 1600) {
            return nextPts.slice(nextPts.length - 1600);
          }
          return nextPts;
        });
      }
    }, 16);
  }

  stopAnimation(): void {
    this.isAnimating.set(false);
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  clearTrace(): void {
    this.trace.set([]);
  }

  resetAnimation(): void {
    this.time.set(0);
    this.trace.set([]);
  }

  toggleSelectedCoefficient(k: number): void {
    this.selectedCoeffK.update((current) => (current === k ? null : k));
  }

  private parsePoints(raw: string): DftPoint[] {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 3) {
      throw new Error('Se requieren al menos 3 puntos x,y para epiciclos.');
    }

    const points = lines.map((line, i) => {
      const parts = line.split(/[\s,;]+/).filter(Boolean);
      if (parts.length < 2) {
        throw new Error(`Linea ${i + 1}: usa formato x,y.`);
      }

      const x = Number(parts[0]);
      const y = Number(parts[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Linea ${i + 1}: valores numericos invalidos.`);
      }
      return { x, y };
    });

    // if (points.length > 1024) {
    //   throw new Error('Maximo 1024 puntos.');
    // }

    return points;
  }

  private formatPoints(points: DftPoint[]): string {
    return points.map((p) => `${p.x.toFixed(6)}, ${p.y.toFixed(6)}`).join('\n');
  }

  private evaluatePoint(coeffs: RenderCoeff[], time: number): DftPoint {
    let x = 0;
    let y = 0;

    for (const c of coeffs) {
      const angle = c.kSigned * time;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      x += c.re * cos - c.im * sin;
      y += c.re * sin + c.im * cos;
    }

    return { x, y };
  }

  private computeEpicycleStates(coeffs: RenderCoeff[], time: number): EpicycleState[] {
    const states: EpicycleState[] = [];
    const selectedK = this.selectedCoeffK();
    const total = Math.max(1, coeffs.length);
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < coeffs.length; i++) {
      const c = coeffs[i];
      if (!c) continue;
      const angle = c.kSigned * time;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const vx = c.re * cos - c.im * sin;
      const vy = c.re * sin + c.im * cos;
      const ex = cx + vx;
      const ey = cy + vy;

      states.push({
        color: this.harmonicColor(i, total),
        selected: selectedK === null ? false : selectedK === c.k,
        centerX: cx,
        centerY: cy,
        endX: ex,
        endY: ey,
        radius: c.amplitudeSafe,
      });

      cx = ex;
      cy = ey;
    }

    return states;
  }

  private drawEpicycleOverlay(ctx: CanvasRenderingContext2D, vp: CanvasViewport): void {
    if (this.showSampledPoints()) {
      this.drawSampledPoints(ctx, vp, this.sourcePoints());
    }

    if (!this.showEpicycles()) return;

    const states = this.epicycleStates();
    if (states.length === 0) return;

    const toCssX = (x: number) => this.coords.mathToScreenX(x, vp) / vp.dpr;
    const toCssY = (y: number) => this.coords.mathToScreenY(y, vp) / vp.dpr;

    const pxPerUnit = vp.unit * ((vp.scaleX + vp.scaleY) / 2);

    ctx.save();

    const hasSelection = states.some((s) => s.selected);

    for (const state of states) {
      const cx = toCssX(state.centerX);
      const cy = toCssY(state.centerY);
      const ex = toCssX(state.endX);
      const ey = toCssY(state.endY);
      const isDimmed = hasSelection && !state.selected;
      const circleAlpha = state.selected ? 0.42 : isDimmed ? 0.12 : 0.28;
      const vectorAlpha = state.selected ? 1 : isDimmed ? 0.22 : 0.88;
      const lineWidth = state.selected ? 2.4 : 1.5;
      const circleStroke = this.withAlpha(state.color, circleAlpha);
      const vectorStroke = this.withAlpha(state.color, vectorAlpha);

      ctx.beginPath();
      ctx.strokeStyle = circleStroke;
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, Math.max(1.5, state.radius * pxPerUnit), 0, TAU);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = vectorStroke;
      ctx.lineWidth = lineWidth;
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      this.drawArrowHead(ctx, cx, cy, ex, ey, state.color, state.selected, isDimmed);
    }

    const end = states[states.length - 1];
    if (!end) {
      ctx.restore();
      return;
    }
    const ex = toCssX(end.endX);
    const ey = toCssY(end.endY);

    ctx.beginPath();
    ctx.fillStyle = hasSelection ? this.withAlpha('#f8fafc', 0.95) : '#f59e0b';
    ctx.arc(ex, ey, 3.1, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  private drawSampledPoints(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    points: DftPoint[],
  ): void {
    if (points.length === 0) return;

    const toCssX = (x: number) => this.coords.mathToScreenX(x, vp) / vp.dpr;
    const toCssY = (y: number) => this.coords.mathToScreenY(y, vp) / vp.dpr;

    ctx.save();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
    const radius = 1.8;

    for (const p of points) {
      ctx.beginPath();
      ctx.arc(toCssX(p.x), toCssY(p.y), radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    selected: boolean,
    dimmed: boolean,
  ): void {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 2.5) return;

    const angle = Math.atan2(dy, dx);
    const headLength = selected ? 8 : 6;
    const spread = Math.PI / 7;
    const alpha = selected ? 1 : dimmed ? 0.26 : 0.9;

    const x1 = toX - headLength * Math.cos(angle - spread);
    const y1 = toY - headLength * Math.sin(angle - spread);
    const x2 = toX - headLength * Math.cos(angle + spread);
    const y2 = toY - headLength * Math.sin(angle + spread);

    ctx.beginPath();
    ctx.fillStyle = this.withAlpha(color, alpha);
    ctx.moveTo(toX, toY);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  }

  private harmonicColor(index: number, total: number): string {
    const t = total <= 1 ? 0 : index / (total - 1);
    const hue = (200 + t * 300) % 360;
    return `hsl(${hue.toFixed(1)} 90% 62%)`;
  }

  private withAlpha(color: string, alpha: number): string {
    const clamped = Math.max(0, Math.min(1, alpha));
    if (!color.startsWith('hsl(')) return color;
    return color.replace(/^hsl\((.*)\)$/u, `hsl($1 / ${clamped.toFixed(3)})`);
  }

  private normalizePoints(points: DftPoint[]): {
    points: DftPoint[];
    info: { applied: boolean; centerX: number; centerY: number; scale: number };
  } {
    if (points.length === 0) {
      return {
        points,
        info: { applied: false, centerX: 0, centerY: 0, scale: 1 },
      };
    }

    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }

    const centerX = sumX / points.length;
    const centerY = sumY / points.length;

    let maxRadius = 0;
    for (const p of points) {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      const r = Math.hypot(dx, dy);
      if (r > maxRadius) maxRadius = r;
    }

    const scale = maxRadius > 0 ? 1 / maxRadius : 1;
    const normalized = points.map((p) => ({
      x: (p.x - centerX) * scale,
      y: (p.y - centerY) * scale,
    }));

    return {
      points: normalized,
      info: {
        applied: true,
        centerX,
        centerY,
        scale,
      },
    };
  }

  private closedPath(points: DftPoint[]): DftPoint[] {
    if (points.length < 2) return points;
    const first = points[0];
    const last = points[points.length - 1];
    if (first.x === last.x && first.y === last.y) return points;
    return [...points, first];
  }

  private toFiniteNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const n = parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  private phaseToPiLabel(phase: number): string {
    const ratio = phase / Math.PI;
    if (!Number.isFinite(ratio)) return '0';

    const common: Array<[number, string]> = [
      [0, '0'],
      [1, '1'],
      [-1, '-1'],
      [0.5, '1/2'],
      [-0.5, '-1/2'],
      [1 / 3, '1/3'],
      [-1 / 3, '-1/3'],
      [2 / 3, '2/3'],
      [-2 / 3, '-2/3'],
      [1 / 4, '1/4'],
      [-1 / 4, '-1/4'],
      [3 / 4, '3/4'],
      [-3 / 4, '-3/4'],
    ];

    for (const [target, label] of common) {
      if (Math.abs(ratio - target) < 1e-4) return label;
    }

    return Number(ratio.toFixed(4)).toString();
  }
}
