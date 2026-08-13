import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { CanvasRendererService } from '../../../core/services/canvas/canvas-renderer.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import {
  CanvasViewport,
  CanvasRenderConfig,
  DEFAULT_RENDER_CONFIG,
  Curve,
  MathPoint,
  PlotFn,
  DARK_THEME,
  LIGHT_THEME,
  NEUTRAL_DARK_THEME,
  NEUTRAL_LIGHT_THEME,
} from '../../../core/services/canvas/canvas.types';
export type { AxisConst, CanvasRenderConfig, PlotFn } from '../../../core/services/canvas/canvas.types';

export interface PlotLayer {
  curves: Curve[];
  /**
   * Declarative functions sampled and cached by FunctionPlotComponent.
   * Re-sampled only when the visible X range changes meaningfully (> ~5%).
   * Use instead of `onDraw` + `plotFn` for static mathematical curves.
   */
  fns?: PlotFn[];
  /** Called every frame — reserve for genuinely dynamic content (animation, crosshair). */
  onDraw?: (ctx: CanvasRenderingContext2D, vp: CanvasViewport) => void;
}

type ZoomMode = 'both' | 'x' | 'y';

/**
 * Reusable Cartesian canvas component.
 *
 * Features:
 * - Correct devicePixelRatio handling (sharp on HiDPI/Retina)
 * - Unlimited zoom in/out (mouse wheel / buttons)
 * - Independent X / Y axis zoom mode
 * - Pan: click-drag
 * - Responsive resize with ResizeObserver
 * - Light/dark theme via ThemeService
 * - Dynamic curve layers via `onDraw` callback
 */
@Component({
  selector: 'app-function-plot',
  template: `
    <div class="relative w-full h-full select-none" #wrapper>
      <canvas
        #canvas
        class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        (wheel)="onWheel($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointerleave)="onPointerLeave()"
      ></canvas>

      <!-- Controls overlay -->
      <div class="absolute bottom-3 right-3 flex flex-col gap-1">
        <!-- Zoom mode selector -->
        <div class="flex flex-col gap-0.5 mb-1">
          @for (mode of zoomModes; track mode.value) {
            <button
              (click)="setZoomMode(mode.value)"
              [class]="
                zoomMode() === mode.value
                  ? 'w-7 h-5 bg-gray-600 border border-gray-400 rounded text-gray-100 text-[10px] cursor-pointer flex items-center justify-center'
                  : 'w-7 h-5 bg-white/70 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 text-[10px] hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center justify-center'
              "
            >
              {{ mode.label }}
            </button>
          }
        </div>

        <!-- Zoom buttons -->
        <button
          (click)="zoom(1.25)"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center leading-none"
        >
          +
        </button>
        <button
          (click)="zoom(0.8)"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center leading-none"
        >
          −
        </button>
        <button
          (click)="resetView()"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-xs hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center"
        >
          ⌂
        </button>
      </div>
    </div>
  `,
  host: { class: 'block w-full h-full' },
})
export class FunctionPlotComponent implements AfterViewInit, OnDestroy {
  // ── Services ──────────────────────────────────────────────────────────────
  private readonly theme      = inject(ThemeService);
  private readonly isBrowser  = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly renderer = inject(CanvasRendererService);
  private readonly plotter = inject(PlottingService);
  private readonly coords = inject(CoordinateTransformService);

  // ── Template refs ─────────────────────────────────────────────────────────
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly wrapperRef = viewChild<ElementRef<HTMLDivElement>>('wrapper');

  // ── Inputs ────────────────────────────────────────────────────────────────
  readonly layers      = input<PlotLayer[]>([]);
  readonly initialUnit = input<number>(75);
  readonly xAxisFormat = input<CanvasViewport['xAxisFormat']>('integer');
  readonly customConst = input<CanvasViewport['customConst']>({ symbol: 'T', value: 1 });
  /**
   * Optional rendering overrides merged on top of DEFAULT_RENDER_CONFIG.
   * Any key not provided falls back to the default value, so existing callers
   * that don't pass this input are completely unaffected.
   *
   * Example — use system font and tighter grid:
   *   [renderConfig]="{ labelFont: 'system-ui', targetGridPx: 60 }"
   */
  readonly renderConfig = input<Partial<CanvasRenderConfig>>({});

  // ── Derived config (merges caller overrides with defaults) ────────────────
  readonly effectiveConfig = computed<CanvasRenderConfig>(() => ({
    ...DEFAULT_RENDER_CONFIG,
    ...this.renderConfig(),
  }));

  // ── Outputs ───────────────────────────────────────────────────────────────
  /**
   * Emits the current viewport every time the user zooms, pans, or the canvas
   * is resized. Useful for synchronising multiple canvases or displaying
   * current zoom/origin in a parent component.
   */
  readonly viewportChange = output<CanvasViewport>();
  /**
   * Emits the mathematical coordinate under the pointer on every pointermove.
   * Emits `null` on pointerleave. Allows parent components to display
   * crosshair tooltips or hit-test curves without duplicating the
   * CSS→math coordinate conversion.
   */
  readonly mathPointerMove = output<MathPoint | null>();

  // ── Zoom mode ─────────────────────────────────────────────────────────────
  readonly zoomModes = [
    { value: 'both' as ZoomMode, label: 'XY' },
    { value: 'x' as ZoomMode, label: 'X' },
    { value: 'y' as ZoomMode, label: 'Y' },
  ];
  readonly zoomMode = signal<ZoomMode>('both');

  // ── Viewport state ────────────────────────────────────────────────────────
  private vp = signal<CanvasViewport>({
    cssWidth: 300,
    cssHeight: 200,
    dpr: 1,
    unit: 75,
    originMath: { x: 0, y: 0 },
    xAxisFormat: 'integer',
    customConst: { symbol: 'T', value: 1 },
    scaleX: 1,
    scaleY: 1,
  });

  // ── RAF & interaction state ───────────────────────────────────────────────
  private raf: number | null = null;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private activePointers = new Map<number, PointerEvent>();
  private lastPinchDist = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ── PlotFn sample cache ───────────────────────────────────────────────────
  // Keyed by PlotFn object identity. Stores the last sampled xMin/xMax and the
  // resulting Curve so re-sampling only happens when the visible range changes
  // by more than FN_CACHE_THRESHOLD (fraction of visible width).
  private readonly fnCache = new Map<PlotFn, { xMin: number; xMax: number; curve: Curve }>();
  private static readonly FN_CACHE_THRESHOLD = 0.05;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      void this.layers();
      // Clear the fn cache whenever layers change so stale PlotFn entries
      // from the previous computed result don't accumulate.
      this.fnCache.clear();
      this.scheduleRedraw();
    });
    effect(() => {
      void this.theme.theme();
      this.scheduleRedraw();
    });
    effect(() => {
      void this.theme.palette();
      this.scheduleRedraw();
    });
    effect(() => {
      const fmt = this.xAxisFormat();
      const cc = this.customConst();
      this.vp.update((v) => {
        // When already in 'custom' mode and only the value changes,
        // rescale X so that pixels-per-T-unit stays constant.
        // This couples the grid marks and the curves together.
        if (
          fmt === 'custom' &&
          v.xAxisFormat === 'custom' &&
          cc.value > 0 &&
          v.customConst.value > 0 &&
          Math.abs(cc.value - v.customConst.value) > 1e-10
        ) {
          return {
            ...v,
            xAxisFormat: fmt,
            customConst: cc,
            scaleX: (v.scaleX * v.customConst.value) / cc.value,
          };
        }
        return { ...v, xAxisFormat: fmt, customConst: cc };
      });
      this.scheduleRedraw();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef()?.nativeElement;
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!canvas || !wrapper) return;

    this.vp.update((v) => ({ ...v, unit: this.initialUnit() }));
    this.resizeCanvas(canvas, wrapper);

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas(canvas, wrapper);
      this.scheduleRedraw();
    });
    this.resizeObserver.observe(wrapper);
    this.scheduleRedraw();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.raf !== null) cancelAnimationFrame(this.raf);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setZoomMode(mode: ZoomMode): void {
    this.zoomMode.set(mode);
  }

  /**
   * Zoom by `factor` centered on `cssCenter` (CSS pixel position).
   * Respects current zoomMode: 'both' scales unit, 'x' scales scaleX, 'y' scales scaleY.
   * Emits `viewportChange` after updating.
   */
  zoom(factor: number, cssCenter?: { x: number; y: number }): void {
    const mode = this.zoomMode();
    const cfg  = this.effectiveConfig();
    this.vp.update((v) => {
      const cx = cssCenter ? this.coords.cssToMathX(cssCenter.x, v) : v.originMath.x;
      const cy = cssCenter ? this.coords.cssToMathY(cssCenter.y, v) : v.originMath.y;

      if (mode === 'x') {
        const newScaleX = Math.max(
          cfg.minUnit / v.unit,
          Math.min(cfg.maxUnit / v.unit, v.scaleX * factor),
        );
        return {
          ...v,
          scaleX: newScaleX,
          originMath: {
            x: cx - (cx - v.originMath.x) * (v.scaleX / newScaleX),
            y: v.originMath.y,
          },
        };
      }

      if (mode === 'y') {
        const newScaleY = Math.max(
          cfg.minUnit / v.unit,
          Math.min(cfg.maxUnit / v.unit, v.scaleY * factor),
        );
        return {
          ...v,
          scaleY: newScaleY,
          originMath: {
            x: v.originMath.x,
            y: cy - (cy - v.originMath.y) * (v.scaleY / newScaleY),
          },
        };
      }

      // 'both' — scale unit, keep cursor fixed
      const newUnit = Math.max(cfg.minUnit, Math.min(cfg.maxUnit, v.unit * factor));
      return {
        ...v,
        unit: newUnit,
        originMath: {
          x: cx - (cx - v.originMath.x) * (v.unit / newUnit),
          y: cy - (cy - v.originMath.y) * (v.unit / newUnit),
        },
      };
    });
    this.viewportChange.emit(this.vp());
    this.scheduleRedraw();
  }

  resetView(): void {
    this.vp.update((v) => ({
      ...v,
      unit: this.initialUnit(),
      scaleX: 1,
      scaleY: 1,
      originMath: { x: 0, y: 0 },
    }));
    this.viewportChange.emit(this.vp());
    this.scheduleRedraw();
  }

  getViewport(): CanvasViewport {
    return this.vp();
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cssPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoom(factor, cssPos);
  }

  onPointerDown(e: PointerEvent): void {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.activePointers.set(e.pointerId, e);
    if (this.activePointers.size === 2) {
      this.dragging = false;
      const [a, b] = [...this.activePointers.values()];
      this.lastPinchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    } else {
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    }
  }

  onPointerMove(e: PointerEvent): void {
    this.activePointers.set(e.pointerId, e);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cssX  = e.clientX - rect.left;
    const cssY  = e.clientY - rect.top;
    const vp    = this.vp();

    // Pinch-to-zoom (two fingers)
    if (this.activePointers.size === 2) {
      const [a, b] = [...this.activePointers.values()];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      if (this.lastPinchDist > 0) {
        const factor = dist / this.lastPinchDist;
        const midCss = {
          x: (a.clientX + b.clientX) / 2 - rect.left,
          y: (a.clientY + b.clientY) / 2 - rect.top,
        };
        this.zoom(factor, midCss);
      }
      this.lastPinchDist = dist;
      return;
    }

    // Always emit math coordinates (even while dragging, so parent tooltips update)
    this.mathPointerMove.emit({
      x: this.coords.cssToMathX(cssX, vp),
      y: this.coords.cssToMathY(cssY, vp),
    });

    if (!this.dragging) return;

    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };

    this.vp.update((v) => ({
      ...v,
      originMath: {
        x: v.originMath.x - dx / (v.unit * v.scaleX),
        y: v.originMath.y + dy / (v.unit * v.scaleY),
      },
    }));
    this.viewportChange.emit(this.vp());
    this.scheduleRedraw();
  }

  onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    this.lastPinchDist = 0;
    this.dragging = this.activePointers.size === 1;
    if (this.dragging) {
      const remaining = [...this.activePointers.values()][0];
      this.lastPointer = { x: remaining.clientX, y: remaining.clientY };
    }
  }

  onPointerLeave(): void {
    this.activePointers.clear();
    this.dragging = false;
    this.lastPinchDist = 0;
    this.mathPointerMove.emit(null);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  redraw(): void { this.scheduleRedraw(); }

  private scheduleRedraw(): void {
    if (!this.isBrowser) return;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.draw();
    });
  }

  private draw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const vp  = this.vp();
    const cfg = this.effectiveConfig();
    const theme = this.theme.isDark
      ? this.theme.isNeutral
        ? NEUTRAL_DARK_THEME
        : DARK_THEME
      : this.theme.isNeutral
        ? NEUTRAL_LIGHT_THEME
        : LIGHT_THEME;

    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
    this.renderer.drawBackground(ctx, vp, theme, cfg);

    for (const layer of this.layers()) {
      for (const curve of layer.curves) {
        this.plotter.drawCurve(ctx, curve, vp, cfg);
      }
      if (layer.fns?.length) {
        for (const plotFn of layer.fns) {
          const curve = this.cachedSample(plotFn, vp, cfg);
          this.plotter.drawCurve(ctx, curve, vp, cfg);
        }
      }
      layer.onDraw?.(ctx, vp);
    }
  }

  /**
   * Returns a cached Curve for the given PlotFn, re-sampling only when the
   * visible X range has drifted more than FN_CACHE_THRESHOLD from the cached range.
   * Fixed-domain fns ([from, to]) are sampled once and never invalidated by pan.
   */
  private cachedSample(plotFn: PlotFn, vp: CanvasViewport, cfg: CanvasRenderConfig): Curve {
    const range = this.coords.visibleRange(vp);
    const isFixed = plotFn.from !== undefined && plotFn.to !== undefined;

    const cached = this.fnCache.get(plotFn);
    if (cached) {
      if (isFixed) {
        // Fixed domain: only re-sample when cssWidth changes (resize).
        // The cached xMin/xMax store cssWidth for this purpose.
        if (cached.xMin === vp.cssWidth) return cached.curve;
      } else {
        const cachedWidth = cached.xMax - cached.xMin;
        const drift = Math.max(
          Math.abs(range.xMin - cached.xMin),
          Math.abs(range.xMax - cached.xMax),
        );
        if (drift < cachedWidth * FunctionPlotComponent.FN_CACHE_THRESHOLD) {
          return cached.curve;
        }
      }
    }

    // Sample with extra margin (2×) so short pans never show an edge.
    let xMin: number, xMax: number, points: MathPoint[];
    if (isFixed) {
      xMin = vp.cssWidth; // sentinel: re-sample only on resize
      xMax = vp.cssWidth;
      const steps = plotFn.steps ?? Math.round(vp.cssWidth * cfg.defaultOversample);
      points = this.plotter.sampleRange(plotFn.fn, plotFn.from!, plotFn.to!, steps);
    } else {
      const margin = (range.xMax - range.xMin) * 0.5;
      xMin = range.xMin - margin;
      xMax = range.xMax + margin;
      const steps = plotFn.steps ?? Math.round(vp.cssWidth * cfg.defaultOversample * 2);
      points = this.plotter.sampleRange(plotFn.fn, xMin, xMax, steps);
    }

    const curve: Curve = {
      points,
      color: plotFn.color,
      lineWidth: plotFn.lineWidth,
      dashed: plotFn.dashed,
      dashPattern: plotFn.dashPattern,
      jumpStyle: plotFn.jumpStyle,
    };
    this.fnCache.set(plotFn, { xMin, xMax, curve });
    return curve;
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private resizeCanvas(canvas: HTMLCanvasElement, wrapper: HTMLDivElement): void {
    const dpr = (this.isBrowser ? window.devicePixelRatio : 1) || 1;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    this.vp.update((v) => ({ ...v, cssWidth: w, cssHeight: h, dpr }));
    this.viewportChange.emit(this.vp());
  }
}
