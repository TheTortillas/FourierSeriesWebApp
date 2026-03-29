import { Component, computed, inject, signal } from '@angular/core';
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

interface SignalPreset {
  id: string;
  label: string;
  generator: (n: number, t: number) => number;
}

const TAU = Math.PI * 2;

@Component({
  selector: 'app-dft-signal-lab-panel',
  imports: [FormsModule, FunctionPlotComponent],
  template: `
    <div class="flex flex-col h-full gap-4">
      <h2 class="text-yellow-400 font-bold text-lg border-b border-gray-700 pb-2 shrink-0">
        DFT Lab - Señal 1D (Fase A)
      </h2>

      <div class="grid grid-cols-1 xl:grid-cols-[24rem_1fr] gap-4 min-h-0 flex-1">
        <section class="border border-gray-700 rounded p-4 space-y-4 overflow-auto">
          <div class="space-y-2">
            <p class="text-gray-500 text-xs">Preset de señal</p>
            <div class="flex flex-wrap gap-2">
              @for (preset of presets; track preset.id) {
                <button
                  (click)="presetId.set(preset.id)"
                  [class]="
                    presetId() === preset.id
                      ? 'bg-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                  "
                >
                  {{ preset.label }}
                </button>
              }
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <label class="space-y-1">
              <span class="text-gray-400">N muestras</span>
              <input
                type="number"
                min="32"
                max="4096"
                step="1"
                [ngModel]="sampleCount()"
                (ngModelChange)="sampleCount.set(clampInt($event, 32, 4096))"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              />
            </label>
            <label class="space-y-1">
              <span class="text-gray-400">Ruido</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                [ngModel]="noiseLevel()"
                (ngModelChange)="noiseLevel.set(clampNum($event, 0, 1))"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              />
            </label>
          </div>

          <div class="space-y-2">
            <label class="text-gray-500 text-xs block">Top-K reconstrucción: {{ topK() }}</label>
            <input
              type="range"
              min="1"
              [max]="maxTopK()"
              [ngModel]="topK()"
              (ngModelChange)="topK.set(clampInt($event, 1, maxTopK()))"
              class="w-full accent-yellow-500"
            />
          </div>

          <div class="space-y-2">
            <label class="text-gray-500 text-xs block">
              Umbral de fase (en % del pico): {{ phaseThresholdPercent().toFixed(1) }}%
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              [ngModel]="phaseThresholdPercent()"
              (ngModelChange)="phaseThresholdPercent.set(clampNum($event, 0, 20))"
              class="w-full accent-cyan-500"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
            <input
              type="checkbox"
              [ngModel]="showSampledPoints()"
              (ngModelChange)="showSampledPoints.set($event)"
            />
            Ver muestras discretas en señal temporal
          </label>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              (click)="calculate()"
              [disabled]="loading()"
              class="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 text-sm font-semibold px-4 py-1.5 rounded transition-colors cursor-pointer"
            >
              @if (loading()) {
                Calculando...
              } @else {
                Calcular DFT señal
              }
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
                <p class="text-gray-500">RMS full</p>
                <p class="text-gray-100 text-sm">{{ res.rmsError.toExponential(3) }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">RMS top-K</p>
                <p class="text-gray-100 text-sm">{{ rmsTopK().toExponential(3) }}</p>
              </div>
              <div class="border border-gray-700 rounded p-2">
                <p class="text-gray-500">Tiempo</p>
                <p class="text-gray-100 text-sm">{{ res.executionTimeMs }} ms</p>
              </div>
            </div>

            <div class="space-y-1">
              <p class="text-gray-500 text-xs">Dominantes (top-6 por amplitud)</p>
              @for (c of dominantCoefficients(); track c.k) {
                <div class="text-[11px] font-mono text-gray-300">
                  k={{ signedK(c.k, res.N) }} · |Ck|={{ c.amplitude.toFixed(6) }} · fase={{ c.phaseInPi }}pi
                </div>
              }
            </div>
          }
        </section>

        <section class="grid grid-rows-3 gap-3 min-h-0">
          <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
            <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
              Señal temporal (original / reconstrucción full / reconstrucción top-K)
            </div>
            <app-function-plot [layers]="timeLayers()" [initialUnit]="38"></app-function-plot>
          </div>

          <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
            <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
              Espectro de amplitud (stems)
            </div>
            <app-function-plot [layers]="amplitudeLayers()" [initialUnit]="55"></app-function-plot>
          </div>

          <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
            <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
              Espectro de fase en fracción de pi (stems)
            </div>
            <app-function-plot [layers]="phaseLayers()" [initialUnit]="55"></app-function-plot>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class DftSignalLabPanelComponent {
  private readonly api = inject(ApiService);
  private readonly coords = inject(CoordinateTransformService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<DftResponse | null>(null);

  readonly presetId = signal('mix');
  readonly sampleCount = signal(256);
  readonly noiseLevel = signal(0.02);
  readonly topK = signal(16);
  readonly phaseThresholdPercent = signal(1.5);
  readonly showSampledPoints = signal(false);

  readonly originalSignal = signal<DftPoint[]>([]);

  readonly presets: SignalPreset[] = [
    {
      id: 'single',
      label: 'Seno puro (f=8)',
      generator: (_n, t) => 1.0 * Math.sin(TAU * 8 * t),
    },
    {
      id: 'mix',
      label: 'Mezcla 5+13+29',
      generator: (_n, t) =>
        1.0 * Math.sin(TAU * 5 * t) +
        0.55 * Math.cos(TAU * 13 * t + 0.8) +
        0.35 * Math.sin(TAU * 29 * t - 0.35),
    },
    {
      id: 'close',
      label: 'Frecuencias cercanas',
      generator: (_n, t) =>
        1.0 * Math.sin(TAU * 18 * t) + 0.95 * Math.sin(TAU * 20 * t + 0.35),
    },
    {
      id: 'cos-phase',
      label: 'Coseno + fase',
      generator: (_n, t) =>
        0.9 * Math.cos(TAU * 11 * t + Math.PI / 3) + 0.4 * Math.cos(TAU * 3 * t - 0.6),
    },
  ];

  readonly maxTopK = computed(() => {
    const n = this.result()?.N ?? this.sampleCount();
    return Math.max(1, Math.floor(n / 2));
  });

  readonly positiveCoefficients = computed(() => {
    const res = this.result();
    if (!res) return [] as DftCoefficient[];

    return [...res.coefficients]
      .filter((c) => {
        const ks = this.signedK(c.k, res.N);
        return ks >= 0 && ks <= Math.floor(res.N / 2);
      })
      .sort((a, b) => this.signedK(a.k, res.N) - this.signedK(b.k, res.N));
  });

  readonly topKCoefficients = computed(() => {
    const res = this.result();
    if (!res) return [] as DftCoefficient[];

    const count = Math.max(1, Math.min(this.topK(), this.maxTopK()));
    return [...res.coefficients].sort((a, b) => b.amplitude - a.amplitude).slice(0, count);
  });

  readonly dominantCoefficients = computed(() => this.topKCoefficients().slice(0, 6));

  readonly reconstructedTopK = computed<DftPoint[]>(() => {
    const res = this.result();
    const original = this.originalSignal();
    if (!res || original.length === 0) return [];

    const coeffs = this.topKCoefficients();
    const N = res.N;

    return original.map((p, n) => {
      let y = 0;
      for (const c of coeffs) {
        const angle = (TAU * c.k * n) / N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      return { x: p.x, y };
    });
  });

  readonly rmsTopK = computed(() => {
    const original = this.originalSignal();
    const recon = this.reconstructedTopK();
    const n = Math.min(original.length, recon.length);
    if (n === 0) return 0;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const e = (original[i]?.y ?? 0) - (recon[i]?.y ?? 0);
      sum += e * e;
    }
    return Math.sqrt(sum / n);
  });

  readonly timeLayers = computed<PlotLayer[]>(() => {
    const original = this.originalSignal();
    const fullRecon = this.result()?.reconstructed ?? [];
    const topRecon = this.reconstructedTopK();

    const curves: Curve[] = [];

    if (original.length > 1) {
      curves.push({ points: original, color: '#94a3b8', lineWidth: 1.6 });
    }
    if (fullRecon.length > 1) {
      curves.push({ points: fullRecon, color: '#22c55e', lineWidth: 1.4, dashed: true });
    }
    if (topRecon.length > 1) {
      curves.push({ points: topRecon, color: '#f59e0b', lineWidth: 1.8 });
    }

    return [
      {
        curves,
        onDraw: (ctx, vp) => {
          if (!this.showSampledPoints()) return;
          this.drawPoints(ctx, vp, original, '#f8fafc', 1.6);
        },
      },
    ];
  });

  readonly amplitudeLayers = computed<PlotLayer[]>(() => {
    const res = this.result();
    const coeffs = this.positiveCoefficients();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (!res || coeffs.length === 0) return;

          const topSet = new Set(this.topKCoefficients().map((c) => c.k));
          for (const c of coeffs) {
            const k = this.signedK(c.k, res.N);
            const highlight = topSet.has(c.k);
            this.drawStem(ctx, vp, k, c.amplitude, highlight ? '#f59e0b' : '#60a5fa', 2.1);
          }
        },
      },
    ];
  });

  readonly phaseLayers = computed<PlotLayer[]>(() => {
    const res = this.result();
    const coeffs = this.positiveCoefficients();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (!res || coeffs.length === 0) return;

          const maxAmp = coeffs.reduce((m, c) => Math.max(m, c.amplitude), 0);
          const threshold = (this.phaseThresholdPercent() / 100) * maxAmp;

          for (const c of coeffs) {
            if (c.amplitude < threshold) continue;
            const k = this.signedK(c.k, res.N);
            const phaseInPi = c.phase / Math.PI;
            this.drawStem(ctx, vp, k, phaseInPi, '#22d3ee', 1.8);
            this.drawPoints(ctx, vp, [{ x: k, y: phaseInPi }], '#22d3ee', 2.4);
          }
        },
      },
    ];
  });

  async calculate(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const points = this.generateSignal();
      this.originalSignal.set(points);

      const res = await firstValueFrom(this.api.calculateDFT({ mode: 'signal', points }));
      this.result.set(res);
      this.topK.set(Math.min(16, Math.max(1, Math.floor(res.N / 2))));
    } catch (err) {
      const anyErr = err as { error?: { error?: string }; message?: string };
      this.error.set(anyErr?.error?.error ?? anyErr?.message ?? 'No se pudo calcular la DFT.');
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private generateSignal(): DftPoint[] {
    const n = this.sampleCount();
    const preset = this.presets.find((p) => p.id === this.presetId()) ?? this.presets[0];
    const noise = this.noiseLevel();

    const points: DftPoint[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const base = preset.generator(i, t);
      const noisy = base + this.randomNoise(noise);
      points.push({ x: i, y: noisy });
    }

    return points;
  }

  private randomNoise(level: number): number {
    if (level <= 0) return 0;
    return (Math.random() * 2 - 1) * level;
  }

  signedK(k: number, n: number): number {
    return k > n / 2 ? k - n : k;
  }

  clampInt(value: unknown, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  clampNum(value: unknown, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  private drawStem(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    x: number,
    y: number,
    color: string,
    lineWidth: number,
  ): void {
    const x0 = this.coords.mathToScreenX(x, vp) / vp.dpr;
    const y0 = this.coords.mathToScreenY(0, vp) / vp.dpr;
    const y1 = this.coords.mathToScreenY(y, vp) / vp.dpr;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();
    ctx.restore();
  }

  private drawPoints(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    points: DftPoint[],
    color: string,
    radius: number,
  ): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.fillStyle = color;

    for (const p of points) {
      const sx = this.coords.mathToScreenX(p.x, vp) / vp.dpr;
      const sy = this.coords.mathToScreenY(p.y, vp) / vp.dpr;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }
}
