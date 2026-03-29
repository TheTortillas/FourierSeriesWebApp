import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FunctionPlotComponent, PlotLayer } from '../function-plot/function-plot.component';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport } from '../../../core/services/canvas/canvas.types';
import { DrawingUtilsService } from '../../../core/services/canvas/drawing-utils.service';
import { TrigonometricTerm, ComplexTerm } from '../../../domain/types/fourier.types';
import { ThemeService } from '../../../core/services/theme/theme.service';

type SpectrumMode =
  | 'trigAmp'
  | 'trigAn'
  | 'trigAnAbs'
  | 'trigBn'
  | 'trigBnAbs'
  | 'complexAbs'
  | 'complexRe'
  | 'complexIm'
  | 'complexPhase';

interface StemPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

@Component({
  selector: 'app-spectrum-chart',
  imports: [FunctionPlotComponent],
  template: `
    <div class="space-y-3">
      <div class="flex items-center gap-3 px-4 py-2 rounded bg-paper2 dark:bg-dark-surface2">
        <span class="text-xs font-semibold text-muted dark:text-dark-muted">Ver:</span>
        <div class="flex gap-2">
          @for (option of displayOptions(); track option.value) {
            <button
              (click)="spectrumMode.set(option.value)"
              [class]="
                spectrumMode() === option.value
                  ? 'px-3 py-1 rounded border text-xs font-medium transition flex items-center gap-1.5'
                  : 'px-3 py-1 rounded border border-border dark:border-dark-border bg-white/50 dark:bg-gray-700 text-ink dark:text-dark-ink text-xs hover:bg-white dark:hover:bg-gray-600 transition flex items-center gap-1.5'
              "
              [style.borderColor]="
                spectrumMode() === option.value ? optionColor(option.value) : null
              "
              [style.color]="spectrumMode() === option.value ? optionColor(option.value) : null"
              [style.backgroundColor]="
                spectrumMode() === option.value
                  ? colorWithAlpha(optionColor(option.value), 0.14)
                  : null
              "
            >
              <span
                class="inline-block w-2 h-2 rounded-full"
                [style.backgroundColor]="optionColor(option.value)"
              ></span>
              {{ option.label }}
            </button>
          }
        </div>

        <div class="ml-auto relative">
          <button
            type="button"
            (click)="showStylePanel.set(!showStylePanel())"
            class="px-3 py-1 rounded bg-white/50 dark:bg-gray-700 text-ink dark:text-dark-ink text-xs hover:bg-white dark:hover:bg-gray-600 transition"
          >
            Personalizar stems
          </button>

          @if (showStylePanel()) {
            <div
              class="absolute right-0 mt-2 z-20 w-56 p-3 rounded border border-border dark:border-dark-border bg-paper dark:bg-dark-surface shadow-lg space-y-3"
            >
              <label class="block text-[11px] text-muted dark:text-dark-muted">
                Color
                <input
                  type="color"
                  [value]="stemColor()"
                  (input)="setStemColor($any($event.target).value)"
                  class="mt-1 w-full h-8 cursor-pointer"
                />
              </label>

              <button
                type="button"
                (click)="resetAutoColor()"
                class="w-full px-2 py-1 rounded bg-white/50 dark:bg-gray-700 text-ink dark:text-dark-ink text-xs hover:bg-white dark:hover:bg-gray-600 transition"
              >
                Restaurar color automatico
              </button>

              <label class="block text-[11px] text-muted dark:text-dark-muted">
                Grosor ({{ stemWidth().toFixed(1) }})
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.1"
                  [value]="stemWidth()"
                  (input)="stemWidth.set(+$any($event.target).value)"
                  class="mt-1 w-full"
                />
              </label>
            </div>
          }
        </div>
      </div>

      <div
        #chartWrapper
        class="relative h-80 border border-border dark:border-dark-border rounded bg-paper dark:bg-dark-bg overflow-hidden"
        (pointermove)="onChartPointerMove($event)"
        (pointerleave)="onChartPointerLeave()"
      >
        <app-function-plot [layers]="layers()" [initialUnit]="48" [xAxisFormat]="'integer'" />

        <div class="absolute top-2 left-2 flex gap-1 pointer-events-none">
          <button
            type="button"
            (click)="toggleFullscreen()"
            [title]="isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'"
            class="pointer-events-auto w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          >
            @if (isFullscreen()) {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" />
                <line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            } @else {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            }
          </button>
        </div>

        @if (tooltip(); as t) {
          <div
            class="absolute z-20 pointer-events-none px-2 py-1 rounded bg-ink/90 text-white text-[11px] font-mono shadow"
            [style.left.px]="t.x"
            [style.top.px]="t.y"
          >
            <div class="font-semibold">{{ t.label }}</div>
            <div>{{ t.value.toFixed(6) }}</div>
          </div>
        }
      </div>
    </div>
  `,
})
export class SpectrumChartComponent {
  private readonly coordTransform = inject(CoordinateTransformService);
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly plotRef = viewChild(FunctionPlotComponent);
  readonly chartWrapper = viewChild<ElementRef<HTMLDivElement>>('chartWrapper');

  readonly seriesType = input<'trigonometric' | 'halfRange' | 'complex'>('trigonometric');
  readonly trigTerms = input<TrigonometricTerm[] | null>(null);
  readonly complexTerms = input<ComplexTerm[] | null>(null);
  readonly trigZero = input<number | null>(null);
  readonly complexZero = input<number | null>(null);
  readonly halfRangeMode = input<'cosine' | 'sine'>('cosine');

  readonly spectrumMode = signal<SpectrumMode>('trigAmp');
  readonly tooltip = signal<{ x: number; y: number; label: string; value: number } | null>(null);
  readonly showStylePanel = signal(false);
  readonly useAutoColor = signal(true);
  readonly stemColor = signal('#3b82f6');
  readonly stemWidth = signal(1.6);
  readonly isFullscreen = signal(false);

  readonly displayOptions = computed(() => {
    const type = this.seriesType();
    if (type === 'complex') {
      return [
        { value: 'complexAbs' as SpectrumMode, label: '|cₙ|' },
        { value: 'complexRe' as SpectrumMode, label: 'Re(cₙ)' },
        { value: 'complexIm' as SpectrumMode, label: 'Im(cₙ)' },
        { value: 'complexPhase' as SpectrumMode, label: '∠cₙ (rad)' },
      ];
    }

    if (type === 'halfRange') {
      const mode = this.halfRangeMode();
      if (mode === 'cosine') {
        return [
          { value: 'trigAmp' as SpectrumMode, label: '|Aₙ|' },
          { value: 'trigAn' as SpectrumMode, label: 'aₙ (signado)' },
          { value: 'trigAnAbs' as SpectrumMode, label: '|aₙ|' },
        ];
      } else {
        return [
          { value: 'trigAmp' as SpectrumMode, label: '|Bₙ|' },
          { value: 'trigBn' as SpectrumMode, label: 'bₙ (signado)' },
          { value: 'trigBnAbs' as SpectrumMode, label: '|bₙ|' },
        ];
      }
    }

    return [
      { value: 'trigAmp' as SpectrumMode, label: '|Aₙ|' },
      { value: 'trigAn' as SpectrumMode, label: 'aₙ (signado)' },
      { value: 'trigAnAbs' as SpectrumMode, label: '|aₙ|' },
      { value: 'trigBn' as SpectrumMode, label: 'bₙ (signado)' },
      { value: 'trigBnAbs' as SpectrumMode, label: '|bₙ|' },
    ];
  });

  readonly points = computed<StemPoint[]>(() => {
    const type = this.seriesType();
    const mode = this.spectrumMode();
    const hrMode = this.halfRangeMode(); // Explicit dependency

    // Ensure spectrum mode is valid for current options
    const options = this.displayOptions();
    const isValid = options.some((opt) => opt.value === mode);
    const actualMode = isValid ? mode : (options[0]?.value ?? 'trigAmp');

    if (type === 'complex') return this.buildComplexPoints(actualMode);
    return this.buildTrigPoints(actualMode, hrMode, type);
  });

  readonly layers = computed<PlotLayer[]>(() => {
    const points = this.points();
    const color = this.stemColor();
    const width = this.stemWidth();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => this.drawStemChart(ctx, vp, points, color, width),
      },
    ];
  });

  constructor() {
    effect(() => {
      const options = this.displayOptions();
      const current = this.spectrumMode();
      const exists = options.some((opt) => opt.value === current);
      // Force update if mode is invalid
      if (!exists) {
        const newMode = options[0]?.value ?? 'trigAmp';
        this.spectrumMode.set(newMode as SpectrumMode);
      }
    });

    effect(() => {
      const mode = this.spectrumMode();
      void this.theme.theme();
      void this.theme.palette();
      if (this.useAutoColor()) {
        this.stemColor.set(this.defaultColorForMode(mode));
      }
    });

    if (typeof document !== 'undefined') {
      const handler = () => {
        const wrapper = this.chartWrapper()?.nativeElement;
        this.isFullscreen.set(!!wrapper && document.fullscreenElement === wrapper);
      };
      document.addEventListener('fullscreenchange', handler);
      this.destroyRef.onDestroy(() => document.removeEventListener('fullscreenchange', handler));
    }
  }

  toggleFullscreen(): void {
    const wrapper = this.chartWrapper()?.nativeElement;
    if (!wrapper) return;

    if (document.fullscreenElement === wrapper) {
      void document.exitFullscreen();
      return;
    }

    if (!document.fullscreenElement) {
      void wrapper.requestFullscreen();
    }
  }

  setStemColor(value: string): void {
    this.useAutoColor.set(false);
    this.stemColor.set(value);
  }

  resetAutoColor(): void {
    this.useAutoColor.set(true);
    this.stemColor.set(this.defaultColorForMode(this.spectrumMode()));
  }

  optionColor(mode: SpectrumMode): string {
    return mode === this.spectrumMode() ? this.stemColor() : this.defaultColorForMode(mode);
  }

  colorWithAlpha(hex: string, alpha: number): string {
    const normalized = hex.trim();
    const short = /^#([0-9a-fA-F]{3})$/;
    const full = /^#([0-9a-fA-F]{6})$/;

    if (short.test(normalized)) {
      const m = normalized.match(short);
      if (!m) return `rgba(0,0,0,${alpha})`;
      const r = parseInt(m[1][0] + m[1][0], 16);
      const g = parseInt(m[1][1] + m[1][1], 16);
      const b = parseInt(m[1][2] + m[1][2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (full.test(normalized)) {
      const m = normalized.match(full);
      if (!m) return `rgba(0,0,0,${alpha})`;
      const r = parseInt(m[1].slice(0, 2), 16);
      const g = parseInt(m[1].slice(2, 4), 16);
      const b = parseInt(m[1].slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return `rgba(0,0,0,${alpha})`;
  }

  private defaultColorForMode(mode: SpectrumMode): string {
    const isDark = this.theme.isDark;
    const isNeutral = this.theme.isNeutral;

    switch (mode) {
      case 'trigAn':
      case 'trigAnAbs':
        return isDark ? '#7db7e8' : '#2563eb';
      case 'trigBn':
      case 'trigBnAbs':
        return !isNeutral ? (isDark ? '#e0ad74' : '#c14030') : isDark ? '#fb923c' : '#c2410c';
      case 'trigAmp':
        return isDark ? '#c4b5fd' : '#7c3aed';
      case 'complexRe':
        return isDark ? '#7db7e8' : '#2563eb';
      case 'complexIm':
        return isDark ? '#7dd3a0' : '#059669';
      case 'complexPhase':
        return isDark ? '#f6b26b' : '#d97706';
      case 'complexAbs':
      default:
        return isDark ? '#c4b5fd' : '#7c3aed';
    }
  }

  onChartPointerMove(event: PointerEvent): void {
    const plot = this.plotRef();
    if (!plot) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;

    const vp = plot.getViewport();
    const pointerX = cssX * vp.dpr;
    const pointerY = cssY * vp.dpr;
    const points = this.points();

    let nearest: StemPoint | null = null;
    let minDist = Infinity;
    const threshold = 14 * vp.dpr;

    for (const point of points) {
      const sx = this.coordTransform.mathToScreenX(point.x, vp);
      const sy = this.coordTransform.mathToScreenY(point.y, vp);
      const dx = sx - pointerX;
      const dy = sy - pointerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = point;
      }
    }

    if (!nearest || minDist > threshold) {
      this.tooltip.set(null);
      return;
    }

    this.tooltip.set({ x: cssX + 12, y: cssY - 12, label: nearest.label, value: nearest.value });
  }

  onChartPointerLeave(): void {
    this.tooltip.set(null);
  }

  private buildTrigPoints(
    mode: SpectrumMode,
    hrMode: 'cosine' | 'sine',
    type: 'trigonometric' | 'halfRange' | 'complex',
  ): StemPoint[] {
    const terms = this.trigTerms();
    if (!terms || terms.length === 0) return [];

    const points = terms.map((term) => {
      const amp = Math.sqrt(term.anFloat * term.anFloat + term.bnFloat * term.bnFloat);

      // In halfRange cosine mode, only show a_n terms
      if (type === 'halfRange' && hrMode === 'cosine') {
        if (mode === 'trigAn') {
          return { x: term.n, y: term.anFloat, label: `a_${term.n}`, value: term.anFloat };
        }
        if (mode === 'trigAnAbs') {
          const value = Math.abs(term.anFloat);
          return { x: term.n, y: value, label: `|a_${term.n}|`, value };
        }
        const value = Math.abs(term.anFloat);
        return { x: term.n, y: value, label: `|A_${term.n}|`, value };
      }

      // In halfRange sine mode, only show b_n terms
      if (type === 'halfRange' && hrMode === 'sine') {
        if (mode === 'trigBn') {
          return { x: term.n, y: term.bnFloat, label: `b_${term.n}`, value: term.bnFloat };
        }
        if (mode === 'trigBnAbs') {
          const value = Math.abs(term.bnFloat);
          return { x: term.n, y: value, label: `|b_${term.n}|`, value };
        }
        const value = Math.abs(term.bnFloat);
        return { x: term.n, y: value, label: `|B_${term.n}|`, value };
      }

      // In trigonometric mode, show all terms
      if (mode === 'trigAn') {
        return { x: term.n, y: term.anFloat, label: `a_${term.n}`, value: term.anFloat };
      }
      if (mode === 'trigAnAbs') {
        const value = Math.abs(term.anFloat);
        return { x: term.n, y: value, label: `|a_${term.n}|`, value };
      }
      if (mode === 'trigBn') {
        return { x: term.n, y: term.bnFloat, label: `b_${term.n}`, value: term.bnFloat };
      }
      if (mode === 'trigBnAbs') {
        const value = Math.abs(term.bnFloat);
        return { x: term.n, y: value, label: `|b_${term.n}|`, value };
      }
      return { x: term.n, y: amp, label: `|A_${term.n}|`, value: amp };
    });

    const a0Half = this.trigZero();
    if (a0Half !== null && a0Half !== undefined) {
      if (mode === 'trigAn') {
        points.unshift({ x: 0, y: a0Half, label: 'a_0/2', value: a0Half });
      } else if (mode === 'trigAnAbs' || mode === 'trigAmp') {
        const value = Math.abs(a0Half);
        points.unshift({ x: 0, y: value, label: '|a_0/2|', value });
      } else {
        points.unshift({ x: 0, y: 0, label: 'b_0', value: 0 });
      }
    }

    return points;
  }

  private buildComplexPoints(mode: SpectrumMode): StemPoint[] {
    const terms = this.complexTerms();
    if (!terms || terms.length === 0) {
      const c0Only = this.complexZero();
      if (c0Only === null || c0Only === undefined) return [];
      if (mode === 'complexAbs') {
        const value = Math.abs(c0Only);
        return [{ x: 0, y: value, label: '|c_0|', value }];
      }
      if (mode === 'complexRe') return [{ x: 0, y: c0Only, label: 'Re(c_0)', value: c0Only }];
      if (mode === 'complexIm') return [{ x: 0, y: 0, label: 'Im(c_0)', value: 0 }];
      return [{ x: 0, y: 0, label: '∠c_0', value: 0 }];
    }

    const points: StemPoint[] = [];
    for (const term of terms) {
      const re = term.amplitude * Math.cos(term.phase);
      const im = term.amplitude * Math.sin(term.phase);

      let yPos = term.amplitude;
      let yNeg = term.amplitude;
      let labelPos = `|c_${term.n}|`;
      let labelNeg = `|c_{-${term.n}}|`;

      if (mode === 'complexRe') {
        yPos = re;
        yNeg = re;
        labelPos = `Re(c_${term.n})`;
        labelNeg = `Re(c_{-${term.n}})`;
      } else if (mode === 'complexIm') {
        yPos = im;
        yNeg = -im;
        labelPos = `Im(c_${term.n})`;
        labelNeg = `Im(c_{-${term.n}})`;
      } else if (mode === 'complexPhase') {
        yPos = term.phase;
        yNeg = -term.phase;
        labelPos = `∠c_${term.n}`;
        labelNeg = `∠c_{-${term.n}}`;
      }

      points.push({ x: -term.n, y: yNeg, label: labelNeg, value: yNeg });
      points.push({ x: term.n, y: yPos, label: labelPos, value: yPos });
    }

    const c0 = this.complexZero();
    if (c0 !== null && c0 !== undefined) {
      if (mode === 'complexAbs') {
        const value = Math.abs(c0);
        points.push({ x: 0, y: value, label: '|c_0|', value });
      } else if (mode === 'complexRe') {
        points.push({ x: 0, y: c0, label: 'Re(c_0)', value: c0 });
      } else if (mode === 'complexIm') {
        points.push({ x: 0, y: 0, label: 'Im(c_0)', value: 0 });
      } else {
        points.push({ x: 0, y: 0, label: '∠c_0', value: 0 });
      }
    }

    return points.sort((a, b) => a.x - b.x);
  }

  private drawStemChart(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    points: StemPoint[],
    color: string,
    width: number,
  ): void {
    if (points.length === 0) return;

    const markerRadius = Math.max(2.5, width + 1.2);
    for (const point of points) {
      this.drawingUtils.drawStem(ctx, vp, point.x, point.y, color, width, markerRadius);
    }
  }
}
