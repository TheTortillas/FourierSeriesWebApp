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
import { TranslocoPipe } from '@jsverse/transloco';
import { FunctionPlotComponent, PlotLayer } from '../function-plot/function-plot.component';
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
  imports: [FunctionPlotComponent, TranslocoPipe],
  template: `
    <div
      #chartWrapper
      class="relative h-80 border border-border dark:border-dark-border rounded bg-paper dark:bg-dark-bg overflow-hidden"
    >
      <app-function-plot
        [layers]="layers()"
        [initialUnit]="48"
        [xAxisFormat]="'integer'"
        (mathPointerMove)="onMathPointerMove($event)"
      />

      <!-- Overlay buttons — shift right when side panel open -->
      <div
        class="absolute top-2 flex gap-1 pointer-events-none transition-[left] duration-200"
        [style.left]="showStylePanel() ? 'calc(33.333% + 8px)' : '8px'"
      >
        <!-- Fullscreen -->
        <button
          type="button"
          (click)="toggleFullscreen()"
          [title]="isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'"
          class="pointer-events-auto w-7 h-7 bg-paper/80 dark:bg-dark-surface/80 backdrop-blur-sm border border-border dark:border-dark-border rounded text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:border-accent transition-colors flex items-center justify-center"
        >
          @if (isFullscreen()) {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
              <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          }
        </button>

        <!-- Settings toggle -->
        <button
          type="button"
          (click)="showStylePanel.set(!showStylePanel())"
          title="Ajustes del espectro"
          [class]="showStylePanel()
            ? 'pointer-events-auto w-7 h-7 bg-accent/20 border border-accent/50 rounded text-accent transition-colors flex items-center justify-center'
            : 'pointer-events-auto w-7 h-7 bg-paper/80 dark:bg-dark-surface/80 backdrop-blur-sm border border-border dark:border-dark-border rounded text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:border-accent transition-colors flex items-center justify-center'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <!-- Hovered point tooltip -->
      @if (hoveredPoint(); as hov) {
        <div class="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-10
          px-3 py-2 rounded-lg border border-border dark:border-dark-border
          bg-paper/95 dark:bg-dark-surface/95 backdrop-blur-sm shadow text-[11px] font-mono
          flex gap-3 items-center whitespace-nowrap">
          <span class="font-semibold" [style.color]="stemColor()">{{ hov.label }}</span>
          <span class="text-ink/60 dark:text-dark-ink/60">= <span class="text-ink dark:text-dark-ink font-semibold">{{ hov.value.toFixed(6) }}</span></span>
        </div>
      }

      <!-- ── Side panel ─────────────────────────────────────────────────── -->
      @if (showStylePanel()) {
        <div class="panel-slide-in absolute top-0 left-0 bottom-0 w-1/3 min-w-56 z-20 flex flex-col border-r border-border dark:border-dark-border shadow-xl bg-paper/95 dark:bg-dark-surface/95 backdrop-blur-sm">

          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-border dark:border-dark-border shrink-0 bg-paper2/60 dark:bg-dark-surface2/60">
            <span class="text-[10px] uppercase tracking-widest font-semibold text-ink/75 dark:text-dark-ink/75 font-mono">{{ 'settingsCanvas.spectrumSettings' | transloco }}</span>
            <button type="button" (click)="showStylePanel.set(false)"
              class="w-6 h-6 flex items-center justify-center rounded text-ink/75 dark:text-dark-ink/75 hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface2 transition-colors cursor-pointer text-lg leading-none font-light"
            >×</button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto flex flex-col divide-y divide-border dark:divide-dark-border pt-1">

            <!-- ── Vista: selector de modo con color editable por modo ──── -->
            <section class="px-5 py-4 flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <p class="text-[10px] uppercase tracking-widest font-semibold text-ink/75 dark:text-dark-ink/75 font-mono">{{ 'settingsCanvas.spectrumView' | transloco }}</p>
                <button type="button" (click)="resetAllColors()"
                  class="text-[10px] font-mono text-ink/75 dark:text-dark-ink/75 hover:text-accent transition-colors cursor-pointer underline underline-offset-2"
                >{{ 'settingsCanvas.spectrumResetColors' | transloco }}</button>
              </div>
              <div class="flex flex-col gap-1.5">
                @for (option of displayOptions(); track option.value) {
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 rounded border transition-colors cursor-pointer"
                    [class]="spectrumMode() === option.value
                      ? 'border-transparent'
                      : 'border-border dark:border-dark-border hover:border-accent/50'"
                    [style.borderColor]="spectrumMode() === option.value ? optionColor(option.value) : null"
                    [style.backgroundColor]="spectrumMode() === option.value ? colorWithAlpha(optionColor(option.value), 0.10) : null"
                    (click)="spectrumMode.set(option.value)"
                  >
                    <!-- Color picker por modo (no propaga el click al modo) -->
                    <input type="color"
                      [value]="optionColor(option.value)"
                      (input)="$event.stopPropagation(); spectrumMode.set(option.value); setStemColor($any($event.target).value)"
                      (click)="$event.stopPropagation()"
                      class="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                      [style.accentColor]="optionColor(option.value)"
                    />
                    <span class="text-xs font-mono flex-1 select-none"
                      [style.color]="spectrumMode() === option.value ? optionColor(option.value) : null"
                      [class]="spectrumMode() === option.value ? 'font-semibold' : 'text-ink/75 dark:text-dark-ink/75'"
                    >{{ option.label }}</span>
                    <!-- Indicador de override manual -->
                    @if (customColors()[option.value]) {
                      <span class="w-1.5 h-1.5 rounded-full shrink-0" [style.backgroundColor]="optionColor(option.value)"></span>
                    }
                  </div>
                }
              </div>
            </section>

            <!-- ── Forma del stem (global) ─────────────────────────────── -->
            <section class="px-5 py-4 flex flex-col gap-3">
              <p class="text-[10px] uppercase tracking-widest font-semibold text-ink/75 dark:text-dark-ink/75 font-mono">{{ 'settingsCanvas.spectrumMarkerShape' | transloco }}</p>

              <!-- Selector de estilo: 4 opciones con preview SVG -->
              <div class="grid grid-cols-2 gap-2">
                @for (s of stemStyles; track s.value) {
                  <button type="button"
                    (click)="stemStyle.set(s.value)"
                    class="flex flex-col items-center gap-1.5 py-2.5 rounded border transition-colors cursor-pointer"
                    [class]="stemStyle() === s.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border dark:border-dark-border text-ink/70 dark:text-dark-ink/70 hover:border-accent/50'"
                  >
                    <svg width="22" height="28" viewBox="0 0 22 28">
                      <line x1="11" y1="26" x2="11" y2="6"
                        [attr.stroke]="stemStyle() === s.value ? stemColor() : 'currentColor'"
                        stroke-width="1.5" stroke-linecap="round"/>
                      @if (s.value === 'filled') {
                        <circle cx="11" cy="5" r="4" [attr.fill]="stemStyle() === s.value ? stemColor() : 'currentColor'"/>
                      } @else if (s.value === 'open') {
                        <circle cx="11" cy="5" r="3.5"
                          fill="none"
                          [attr.stroke]="stemStyle() === s.value ? stemColor() : 'currentColor'"
                          stroke-width="1.5"/>
                      } @else if (s.value === 'square') {
                        <rect x="7" y="1" width="8" height="8"
                          [attr.fill]="stemStyle() === s.value ? stemColor() : 'currentColor'"/>
                      } @else if (s.value === 'diamond') {
                        <polygon points="11,1 16,5 11,9 6,5"
                          [attr.fill]="stemStyle() === s.value ? stemColor() : 'currentColor'"/>
                      }
                    </svg>
                    <span class="text-[10px] font-mono">{{ s.labelKey | transloco }}</span>
                  </button>
                }
              </div>

              <!-- Grosor -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono text-ink/90 dark:text-dark-ink/90">{{ 'settingsCanvas.spectrumLineWidth' | transloco }}</span>
                  <span class="text-sm font-semibold font-mono text-ink dark:text-dark-ink tabular-nums">{{ stemWidth().toFixed(1) }}</span>
                </div>
                <input type="range" min="0.5" max="5" step="0.1" [value]="stemWidth()"
                  (input)="stemWidth.set(+$any($event.target).value)"
                  class="w-full accent-accent h-1.5" />
              </div>
            </section>

          </div>
        </div>
      }
    </div>
  `,
})
export class SpectrumChartComponent {
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly chartWrapper = viewChild<ElementRef<HTMLDivElement>>('chartWrapper');

  readonly seriesType = input<'trigonometric' | 'halfRange' | 'complex'>('trigonometric');
  readonly trigTerms = input<TrigonometricTerm[] | null>(null);
  readonly complexTerms = input<ComplexTerm[] | null>(null);
  readonly trigZero = input<number | null>(null);
  readonly complexZero = input<number | null>(null);
  readonly halfRangeMode = input<'cosine' | 'sine'>('cosine');
  /** When true, opens the settings panel on first render (e.g. after computing). */
  readonly openPanel = input(false);

  readonly Math = Math;
  readonly spectrumMode = signal<SpectrumMode>('trigAmp');
  readonly hoveredPoint = signal<StemPoint | null>(null);
  readonly showStylePanel = signal(false);
  /** Per-mode manual color overrides. Empty key = auto (uses defaultColorForMode). */
  readonly customColors = signal<Partial<Record<SpectrumMode, string>>>({});
  readonly stemWidth = signal(1.6);
  readonly stemStyle = signal<'filled' | 'open' | 'square' | 'diamond'>('filled');
  readonly stemStyles: { value: 'filled' | 'open' | 'square' | 'diamond'; labelKey: string }[] = [
    { value: 'filled',  labelKey: 'settingsCanvas.spectrumMarkerFilled' },
    { value: 'open',    labelKey: 'settingsCanvas.spectrumMarkerOpen' },
    { value: 'square',  labelKey: 'settingsCanvas.spectrumMarkerSquare' },
    { value: 'diamond', labelKey: 'settingsCanvas.spectrumMarkerDiamond' },
  ];
  readonly isFullscreen = signal(false);

  /** Resolved color for the active mode (manual override or theme default). */
  readonly stemColor = computed(() => {
    const mode = this.spectrumMode();
    void this.theme.theme();
    void this.theme.palette();
    return this.customColors()[mode] ?? this.defaultColorForMode(mode);
  });

  readonly useAutoColor = computed(() => !this.customColors()[this.spectrumMode()]);

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
    const style = this.stemStyle();
    const hovered = this.hoveredPoint();

    return [
      {
        curves: [],
        onDraw: (ctx, vp) => this.drawStemChart(ctx, vp, points, color, width, style, hovered),
      },
    ];
  });

  constructor() {
    effect(() => {
      if (this.openPanel()) this.showStylePanel.set(true);
    });

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
    const mode = this.spectrumMode();
    this.customColors.update(c => ({ ...c, [mode]: value }));
  }

  resetAutoColor(): void {
    const mode = this.spectrumMode();
    this.customColors.update(c => { const n = { ...c }; delete n[mode]; return n; });
  }

  resetAllColors(): void {
    this.customColors.set({});
  }

  optionColor(mode: SpectrumMode): string {
    return this.customColors()[mode] ?? this.defaultColorForMode(mode);
  }

  /** Delegates to DrawingUtilsService.colorWithAlpha — supports hsl(), #rgb, #rrggbb. */
  colorWithAlpha(color: string, alpha: number): string {
    return this.drawingUtils.colorWithAlpha(color, alpha);
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

  /**
   * Called by FunctionPlotComponent's (mathPointerMove) output.
   * Receives pre-converted math coordinates — no manual CSS→math transform needed.
   * Emits null on pointerleave, which clears the hover state.
   */
  onMathPointerMove(p: { x: number; y: number } | null): void {
    if (!p) {
      this.hoveredPoint.set(null);
      return;
    }

    const points = this.points();
    // Check if cursor is over a stem (X proximity + Y between 0 and tip)
    const xTol = 0.4;
    let hit: StemPoint | null = null;
    for (const point of points) {
      if (Math.abs(point.x - p.x) > xTol) continue;
      const yMin = Math.min(0, point.y) - Math.abs(point.y) * 0.05 - 0.02;
      const yMax = Math.max(0, point.y) + Math.abs(point.y) * 0.05 + 0.02;
      if (p.y >= yMin && p.y <= yMax) { hit = point; break; }
    }

    this.hoveredPoint.set(hit);
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
    style: 'filled' | 'open' | 'square' | 'diamond',
    hovered: StemPoint | null,
  ): void {
    if (points.length === 0) return;

    const isDark = this.theme.isDark;
    const highlightColor = isDark ? '#fbbf24' : '#d97706';
    const markerRadius = Math.max(2.5, width + 1.2);
    for (const point of points) {
      const isHovered = hovered?.x === point.x && hovered?.label === point.label;
      this.drawingUtils.drawStem(
        ctx, vp, point.x, point.y,
        isHovered ? highlightColor : color,
        isHovered ? width * 2 : width,
        isHovered ? markerRadius + 2 : markerRadius,
        isHovered ? 'filled' : style,
      );
    }
  }
}
