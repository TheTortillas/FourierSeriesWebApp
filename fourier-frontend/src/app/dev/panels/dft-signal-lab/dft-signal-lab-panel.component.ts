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

type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman';

interface SpectrumBin {
  coeff: DftCoefficient;
  xBin: number;
}

interface LeakageStats {
  dominantK: number;
  dominantAmplitude: number;
  leakageRatio: number;
}

const TAU = Math.PI * 2;

@Component({
  selector: 'app-dft-signal-lab-panel',
  imports: [FormsModule, FunctionPlotComponent],
  template: `
    <div class="flex flex-col h-full gap-4">
      <h2 class="text-yellow-400 font-bold text-lg border-b border-gray-700 pb-2 shrink-0">
        DFT Lab - Señal 1D (Fase A/B)
      </h2>

      <div class="grid grid-cols-1 xl:grid-cols-[25rem_1fr] gap-4 min-h-0 flex-1">
        <section class="border border-gray-700 rounded p-4 space-y-4 overflow-auto">
          <div class="space-y-2">
            <p class="text-gray-500 text-xs">Fuente de señal</p>
            <div class="flex flex-wrap gap-2">
              <button
                (click)="sourceMode.set('preset')"
                [class]="
                  sourceMode() === 'preset'
                    ? 'bg-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                "
              >
                Presets
              </button>
              <button
                (click)="sourceMode.set('manual')"
                [class]="
                  sourceMode() === 'manual'
                    ? 'bg-yellow-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                "
              >
                Función manual
              </button>
            </div>
          </div>

          @if (sourceMode() === 'preset') {
            <div class="space-y-2">
              <p class="text-gray-500 text-xs">Preset de señal</p>
              <div class="flex flex-wrap gap-2">
                @for (preset of presets; track preset.id) {
                  <button
                    (click)="presetId.set(preset.id)"
                    [class]="
                      presetId() === preset.id
                        ? 'bg-cyan-500 text-gray-900 text-xs px-2.5 py-1 rounded font-semibold cursor-pointer'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs px-2.5 py-1 rounded cursor-pointer'
                    "
                  >
                    {{ preset.label }}
                  </button>
                }
              </div>
            </div>
          } @else {
            <div class="space-y-2">
              <p class="text-gray-500 text-xs">f(t) con t en [0, 1)</p>
              <textarea
                [ngModel]="manualExpression()"
                (ngModelChange)="manualExpression.set($event)"
                rows="4"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono"
              ></textarea>
              <p class="text-[11px] text-gray-500">
                Usa: sin, cos, tan, sqrt, abs, exp, log, pow, pi. Ej:
                sin(2*pi*7*t)+0.4*cos(2*pi*15*t+0.8)
              </p>
            </div>
          }

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

          <div class="space-y-2 rounded border border-gray-700 p-2">
            <p class="text-gray-500 text-xs">Capas visibles (señal temporal)</p>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showOriginalFunction()"
                (ngModelChange)="showOriginalFunction.set($event)"
              />
              Función original (continua)
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showNegativeOriginalFunction()"
                (ngModelChange)="showNegativeOriginalFunction.set($event)"
              />
              Mostrar f(-t) en eje x negativo
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showSampledSignal()"
                (ngModelChange)="showSampledSignal.set($event)"
              />
              Señal muestreada
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showWindowedSignal()"
                (ngModelChange)="showWindowedSignal.set($event)"
              />
              Señal ventaneada
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showReconstructedFull()"
                (ngModelChange)="showReconstructedFull.set($event)"
              />
              Reconstrucción full
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showReconstructedTopK()"
                (ngModelChange)="showReconstructedTopK.set($event)"
              />
              Reconstrucción top-K
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showSampledPoints()"
                (ngModelChange)="showSampledPoints.set($event)"
              />
              Marcar puntos discretos
            </label>
          </div>

          <div class="space-y-2 rounded border border-gray-700 p-2">
            <p class="text-gray-500 text-xs">Espectro</p>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="shiftedSpectrum()"
                (ngModelChange)="shiftedSpectrum.set($event)"
              />
              Centrar frecuencias (tipo fftshift)
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="showZeroBins()"
                (ngModelChange)="showZeroBins.set($event)"
              />
              Mostrar bins en cero
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="compareWithRectangular()"
                (ngModelChange)="compareWithRectangular.set($event)"
              />
              Comparar contra rectangular
            </label>
          </div>

          <div class="space-y-2 rounded border border-gray-700 p-2">
            <p class="text-gray-500 text-xs">Fase B - Leakage y Windowing</p>
            <label class="flex items-center gap-2 cursor-pointer text-gray-300 text-xs">
              <input
                type="checkbox"
                [ngModel]="applyWindow()"
                (ngModelChange)="applyWindow.set($event)"
              />
              Aplicar ventana al analizar DFT
            </label>
            <label class="space-y-1 text-xs block">
              <span class="text-gray-400">Tipo de ventana</span>
              <select
                [ngModel]="windowType()"
                (ngModelChange)="windowType.set($event)"
                class="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-100"
              >
                <option value="rectangular">Rectangular</option>
                <option value="hann">Hann</option>
                <option value="hamming">Hamming</option>
                <option value="blackman">Blackman</option>
              </select>
            </label>
            <p class="text-[11px] text-gray-500">
              Usa el preset Leakage para notar cómo cambia el ensanchamiento espectral.
            </p>
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

            @if (leakageCurrent(); as lc) {
              <div class="space-y-1 rounded border border-gray-700 p-2">
                <p class="text-gray-500 text-xs">Métricas leakage</p>
                <p class="text-[11px] font-mono text-gray-300">
                  Actual: k={{ lc.dominantK }} · pico={{ lc.dominantAmplitude.toFixed(6) }} ·
                  leakage={{ (lc.leakageRatio * 100).toFixed(2) }}%
                </p>
                @if (leakageBaseline(); as lb) {
                  <p class="text-[11px] font-mono text-cyan-300">
                    Rectangular: {{ (lb.leakageRatio * 100).toFixed(2) }}% · mejora:
                    {{ leakageImprovementPercent().toFixed(2) }}%
                  </p>
                }
              </div>
            }
          }
        </section>

        <section class="grid grid-rows-3 gap-3 min-h-0">
          <div class="border border-gray-700 rounded overflow-hidden bg-gray-950 min-h-0">
            <div class="text-[11px] px-2 py-1 border-b border-gray-800 text-gray-400">
              Señal temporal
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
  readonly baselineResult = signal<DftResponse | null>(null);

  readonly sourceMode = signal<'preset' | 'manual'>('preset');
  readonly presetId = signal('mix');
  readonly manualExpression = signal(
    'sin(2*pi*5*t) + 0.55*cos(2*pi*13*t + 0.8) + 0.35*sin(2*pi*29*t - 0.35)',
  );
  readonly sampleCount = signal(256);
  readonly noiseLevel = signal(0.02);
  readonly topK = signal(16);
  readonly phaseThresholdPercent = signal(1.5);

  readonly showOriginalFunction = signal(true);
  readonly showNegativeOriginalFunction = signal(false);
  readonly showSampledSignal = signal(true);
  readonly showWindowedSignal = signal(false);
  readonly showReconstructedFull = signal(true);
  readonly showReconstructedTopK = signal(true);
  readonly showSampledPoints = signal(false);

  readonly shiftedSpectrum = signal(false);
  readonly showZeroBins = signal(true);
  readonly compareWithRectangular = signal(true);

  readonly applyWindow = signal(false);
  readonly windowType = signal<WindowType>('hann');

  readonly originalFunctionCurve = signal<DftPoint[]>([]);
  readonly sampledSignal = signal<DftPoint[]>([]);
  readonly analyzedSignal = signal<DftPoint[]>([]);

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
      generator: (_n, t) => 1.0 * Math.sin(TAU * 18 * t) + 0.95 * Math.sin(TAU * 20 * t + 0.35),
    },
    {
      id: 'cos-phase',
      label: 'Coseno + fase',
      generator: (_n, t) =>
        0.9 * Math.cos(TAU * 11 * t + Math.PI / 3) + 0.4 * Math.cos(TAU * 3 * t - 0.6),
    },
    {
      id: 'leakage',
      label: 'Leakage (f fraccional)',
      generator: (_n, t) => 1.0 * Math.sin(TAU * 10.5 * t) + 0.55 * Math.sin(TAU * 22.25 * t + 0.2),
    },
  ];

  readonly maxTopK = computed(() => {
    const n = this.result()?.N ?? this.sampleCount();
    return Math.max(1, Math.floor(n / 2));
  });

  readonly spectrumBins = computed(() => this.buildSpectrumBins(this.result()));
  readonly baselineSpectrumBins = computed(() => this.buildSpectrumBins(this.baselineResult()));

  readonly topKCoefficients = computed(() => {
    const res = this.result();
    if (!res) return [] as DftCoefficient[];

    const count = Math.max(1, Math.min(this.topK(), this.maxTopK()));
    return [...res.coefficients].sort((a, b) => b.amplitude - a.amplitude).slice(0, count);
  });

  readonly reconstructedTopK = computed<DftPoint[]>(() => {
    const res = this.result();
    const analyzed = this.analyzedSignal();
    if (!res || analyzed.length === 0) return [];

    const coeffs = this.topKCoefficients();
    const N = res.N;

    return analyzed.map((p, n) => {
      let y = 0;
      for (const c of coeffs) {
        const angle = (TAU * c.k * n) / N;
        y += c.re * Math.cos(angle) - c.im * Math.sin(angle);
      }
      return { x: p.x, y };
    });
  });

  readonly rmsTopK = computed(() => {
    const original = this.analyzedSignal();
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

  readonly leakageCurrent = computed(() => this.computeLeakage(this.result()));
  readonly leakageBaseline = computed(() => this.computeLeakage(this.baselineResult()));
  readonly leakageImprovementPercent = computed(() => {
    const baseline = this.leakageBaseline();
    const current = this.leakageCurrent();
    if (!baseline || !current || baseline.leakageRatio <= 0) return 0;
    return ((baseline.leakageRatio - current.leakageRatio) / baseline.leakageRatio) * 100;
  });

  readonly timeLayers = computed<PlotLayer[]>(() => {
    const originalFn = this.originalFunctionCurve();
    const negativeOriginal = [...originalFn]
      .map((p) => ({ x: -p.x, y: p.y }))
      .sort((a, b) => a.x - b.x);
    const sampled = this.sampledSignal();
    const analyzed = this.analyzedSignal();
    const fullRecon = this.result()?.reconstructed ?? [];
    const topRecon = this.reconstructedTopK();

    const curves: Curve[] = [];

    if (this.showOriginalFunction() && originalFn.length > 1) {
      curves.push({ points: originalFn, color: '#94a3b8', lineWidth: 1.5 });
    }
    if (this.showNegativeOriginalFunction() && negativeOriginal.length > 1) {
      curves.push({ points: negativeOriginal, color: '#fca5a5', lineWidth: 1.2, dashed: true });
    }
    if (this.showSampledSignal() && sampled.length > 1) {
      curves.push({ points: sampled, color: '#f8fafc', lineWidth: 1.2, dashed: true });
    }
    if (this.showWindowedSignal() && analyzed.length > 1) {
      curves.push({ points: analyzed, color: '#22d3ee', lineWidth: 1.2, dashed: true });
    }
    if (this.showReconstructedFull() && fullRecon.length > 1) {
      curves.push({ points: fullRecon, color: '#22c55e', lineWidth: 1.4 });
    }
    if (this.showReconstructedTopK() && topRecon.length > 1) {
      curves.push({ points: topRecon, color: '#f59e0b', lineWidth: 1.8 });
    }

    return [
      {
        curves,
        onDraw: (ctx, vp) => {
          if (!this.showSampledPoints() || !this.showSampledSignal()) return;
          this.drawPoints(ctx, vp, sampled, '#f8fafc', 1.6);
        },
      },
    ];
  });

  readonly amplitudeLayers = computed<PlotLayer[]>(() => {
    const bins = this.spectrumBins();
    const baselineBins = this.baselineSpectrumBins();
    const topSet = new Set(this.topKCoefficients().map((c) => c.k));

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (bins.length === 0) return;

          if (this.compareWithRectangular() && baselineBins.length > 0) {
            for (const b of baselineBins) {
              const amp = b.coeff.amplitude;
              if (amp === 0 && !this.showZeroBins()) continue;
              this.drawStem(ctx, vp, b.xBin, amp, '#64748b', 1.1);
            }
          }

          const zeros: DftPoint[] = [];
          for (const b of bins) {
            const amp = b.coeff.amplitude;
            const highlight = topSet.has(b.coeff.k);
            if (amp === 0 && !this.showZeroBins()) continue;

            this.drawStem(ctx, vp, b.xBin, amp, highlight ? '#f59e0b' : '#60a5fa', 2);
            if (Math.abs(amp) < 1e-12) {
              zeros.push({ x: b.xBin, y: 0 });
            }
          }

          if (this.showZeroBins()) {
            this.drawPoints(ctx, vp, zeros, '#93c5fd', 1.8);
          }
        },
      },
    ];
  });

  readonly phaseLayers = computed<PlotLayer[]>(() => {
    const bins = this.spectrumBins();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => {
          if (bins.length === 0) return;

          const maxAmp = bins.reduce((m, b) => Math.max(m, b.coeff.amplitude), 0);
          const threshold = (this.phaseThresholdPercent() / 100) * maxAmp;
          const phasePoints: DftPoint[] = [];

          for (const b of bins) {
            const amp = b.coeff.amplitude;
            if (amp === 0 && !this.showZeroBins()) continue;

            const reliable = amp >= threshold;
            const phaseInPi = reliable ? b.coeff.phase / Math.PI : 0;
            const color = reliable ? '#22d3ee' : '#64748b';
            this.drawStem(ctx, vp, b.xBin, phaseInPi, color, 1.8);
            phasePoints.push({ x: b.xBin, y: phaseInPi });
          }

          this.drawPoints(ctx, vp, phasePoints, '#22d3ee', 2.2);
        },
      },
    ];
  });

  async calculate(): Promise<void> {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const generator = this.resolveGenerator();
      const sampled = this.generateSampledSignal(generator);
      const analyzed = this.applyWindow()
        ? this.applyWindowToSignal(sampled, this.windowType())
        : sampled;
      const originalFn = this.generateContinuousFunction(generator);

      this.sampledSignal.set(sampled);
      this.analyzedSignal.set(analyzed);
      this.originalFunctionCurve.set(originalFn);

      const shouldCompareRect =
        this.compareWithRectangular() && this.applyWindow() && this.windowType() !== 'rectangular';

      const [mainRes, baseRes] = await Promise.all([
        firstValueFrom(this.api.calculateDFT({ mode: 'signal', points: analyzed })),
        shouldCompareRect
          ? firstValueFrom(this.api.calculateDFT({ mode: 'signal', points: sampled }))
          : Promise.resolve(null),
      ]);

      this.result.set(mainRes);
      this.baselineResult.set(baseRes);
      this.topK.set(Math.min(16, Math.max(1, Math.floor(mainRes.N / 2))));
    } catch (err) {
      const anyErr = err as { error?: { error?: string }; message?: string };
      this.error.set(anyErr?.error?.error ?? anyErr?.message ?? 'No se pudo calcular la DFT.');
      this.result.set(null);
      this.baselineResult.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private buildSpectrumBins(res: DftResponse | null): SpectrumBin[] {
    if (!res) return [];
    const shifted = this.shiftedSpectrum();

    return res.coefficients
      .map((coeff) => ({
        coeff,
        xBin: shifted ? this.signedK(coeff.k, res.N) : coeff.k,
      }))
      .sort((a, b) => a.xBin - b.xBin);
  }

  private computeLeakage(res: DftResponse | null): LeakageStats | null {
    if (!res || res.coefficients.length === 0) return null;

    const bins = res.coefficients
      .map((c) => ({ coeff: c, kSigned: this.signedK(c.k, res.N) }))
      .filter((x) => x.kSigned >= 0 && x.kSigned <= Math.floor(res.N / 2));

    if (bins.length === 0) return null;

    const dominant = bins.reduce((best, cur) =>
      cur.coeff.amplitude > best.coeff.amplitude ? cur : best,
    );

    const totalEnergy = bins.reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);
    if (totalEnergy <= 0) {
      return { dominantK: dominant.kSigned, dominantAmplitude: 0, leakageRatio: 0 };
    }

    const mainLobeEnergy = bins
      .filter((x) => Math.abs(x.kSigned - dominant.kSigned) <= 1)
      .reduce((s, x) => s + x.coeff.amplitude * x.coeff.amplitude, 0);

    return {
      dominantK: dominant.kSigned,
      dominantAmplitude: dominant.coeff.amplitude,
      leakageRatio: Math.max(0, (totalEnergy - mainLobeEnergy) / totalEnergy),
    };
  }

  private resolveGenerator(): (n: number, t: number) => number {
    if (this.sourceMode() === 'preset') {
      const preset = this.presets.find((p) => p.id === this.presetId()) ?? this.presets[0];
      if (!preset) throw new Error('No hay preset disponible.');
      return preset.generator;
    }

    const manual = this.buildManualGenerator(this.manualExpression());
    if (!manual) {
      throw new Error('Expresión manual inválida. Revisa sintaxis y funciones permitidas.');
    }
    return manual;
  }

  private generateSampledSignal(generator: (n: number, t: number) => number): DftPoint[] {
    const n = this.sampleCount();
    const noise = this.noiseLevel();
    const points: DftPoint[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const base = generator(i, t);
      const noisy = base + this.randomNoise(noise);
      points.push({ x: i, y: noisy });
    }

    return points;
  }

  private generateContinuousFunction(generator: (n: number, t: number) => number): DftPoint[] {
    const n = this.sampleCount();
    const dense = Math.max(512, Math.min(2400, n * 3));
    const points: DftPoint[] = [];

    for (let i = 0; i < dense; i++) {
      const t = i / (dense - 1);
      points.push({ x: t * (n - 1), y: generator(i, t) });
    }

    return points;
  }

  private buildManualGenerator(rawExpression: string): ((n: number, t: number) => number) | null {
    const expression = rawExpression.trim().toLowerCase();
    if (!expression) return null;

    if (
      /constructor|window|global|process|require|import|function|=>|;|\{|\}|\[|\]|=/.test(
        expression,
      )
    ) {
      return null;
    }

    if (/[^0-9a-z_+\-*/^().,\s]/.test(expression)) {
      return null;
    }

    const jsExpr = expression.replace(/\^/g, '**');

    try {
      const fn = new Function(
        't',
        'pi',
        'sin',
        'cos',
        'tan',
        'sqrt',
        'abs',
        'exp',
        'log',
        'pow',
        `return (${jsExpr});`,
      ) as (
        t: number,
        pi: number,
        sin: typeof Math.sin,
        cos: typeof Math.cos,
        tan: typeof Math.tan,
        sqrt: typeof Math.sqrt,
        abs: typeof Math.abs,
        exp: typeof Math.exp,
        log: typeof Math.log,
        pow: typeof Math.pow,
      ) => number;

      const probe = fn(
        0.123,
        Math.PI,
        Math.sin,
        Math.cos,
        Math.tan,
        Math.sqrt,
        Math.abs,
        Math.exp,
        Math.log,
        Math.pow,
      );
      if (!Number.isFinite(probe)) return null;

      return (_n: number, t: number) => {
        const y = fn(
          t,
          Math.PI,
          Math.sin,
          Math.cos,
          Math.tan,
          Math.sqrt,
          Math.abs,
          Math.exp,
          Math.log,
          Math.pow,
        );
        return Number.isFinite(y) ? y : 0;
      };
    } catch {
      return null;
    }
  }

  private randomNoise(level: number): number {
    if (level <= 0) return 0;
    return (Math.random() * 2 - 1) * level;
  }

  private applyWindowToSignal(points: DftPoint[], type: WindowType): DftPoint[] {
    const n = points.length;
    if (n <= 1 || type === 'rectangular') return points;

    return points.map((p, i) => {
      const w = this.windowAt(type, i, n);
      return { x: p.x, y: p.y * w };
    });
  }

  private windowAt(type: WindowType, i: number, n: number): number {
    const denom = Math.max(1, n - 1);
    const x = (TAU * i) / denom;

    switch (type) {
      case 'hann':
        return 0.5 - 0.5 * Math.cos(x);
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(x);
      case 'blackman':
        return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
      case 'rectangular':
      default:
        return 1;
    }
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
