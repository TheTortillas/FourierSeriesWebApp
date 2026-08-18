import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FunctionPlotComponent, PlotLayer } from '../function-plot/function-plot.component';
import { CanvasShellComponent } from '../canvas-shell/canvas-shell.component';
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
  imports: [FunctionPlotComponent, CanvasShellComponent, TranslocoPipe],
  templateUrl: './spectrum-chart.component.html',
})
export class SpectrumChartComponent {
  private readonly drawingUtils = inject(DrawingUtilsService);
  private readonly theme = inject(ThemeService);

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
