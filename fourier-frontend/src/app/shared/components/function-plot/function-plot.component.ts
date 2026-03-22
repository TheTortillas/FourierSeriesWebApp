import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
  effect,
} from '@angular/core';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { CanvasRendererService } from '../../../core/services/canvas/canvas-renderer.service';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { CanvasViewport, Curve, DARK_THEME, LIGHT_THEME } from '../../../core/services/canvas/canvas.types';

export interface PlotLayer {
  curves: Curve[];
  /** Called every frame — use for dynamic/animated content */
  onDraw?: (
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
  ) => void;
}

/**
 * Reusable Cartesian canvas component.
 *
 * Features:
 * - Correct devicePixelRatio handling (sharp on HiDPI/Retina)
 * - Zoom: mouse wheel / pinch
 * - Pan: click-drag
 * - Responsive resize with ResizeObserver
 * - Light/dark theme via ThemeService
 * - Accepts pre-sampled Curve layers via `layers` input
 */
@Component({
  selector: 'app-function-plot',
  template: `
    <div class="relative w-full h-full select-none" #wrapper>
      <canvas #canvas
        class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        (wheel)="onWheel($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointerleave)="onPointerUp($event)"
      ></canvas>

      <!-- Zoom controls -->
      <div class="absolute bottom-3 right-3 flex flex-col gap-1">
        <button (click)="zoom(1.25)"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center leading-none">+</button>
        <button (click)="zoom(0.8)"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-sm font-bold hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center leading-none">−</button>
        <button (click)="resetView()"
          class="w-7 h-7 bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-600
                 rounded text-gray-700 dark:text-gray-300 text-xs hover:bg-white dark:hover:bg-gray-700
                 transition-colors cursor-pointer flex items-center justify-center">⌂</button>
      </div>
    </div>
  `,
  host: { class: 'block w-full h-full' },
})
export class FunctionPlotComponent implements AfterViewInit, OnDestroy {
  // ── Injected services ────────────────────────────────────────────────────
  private readonly theme    = inject(ThemeService);
  private readonly renderer = inject(CanvasRendererService);
  private readonly plotter  = inject(PlottingService);
  private readonly coords   = inject(CoordinateTransformService);

  // ── Template refs ────────────────────────────────────────────────────────
  readonly canvasRef  = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly wrapperRef = viewChild<ElementRef<HTMLDivElement>>('wrapper');

  // ── Inputs ───────────────────────────────────────────────────────────────
  readonly layers      = input<PlotLayer[]>([]);
  readonly initialUnit = input<number>(75);
  readonly xAxisFormat = input<CanvasViewport['xAxisFormat']>('integer');

  // ── Viewport state ───────────────────────────────────────────────────────
  private vp = signal<CanvasViewport>({
    cssWidth:    300,
    cssHeight:   200,
    dpr:         1,
    unit:        75,
    originMath:  { x: 0, y: 0 },
    xAxisFormat: 'integer',
    scaleX:      1,
    scaleY:      1,
  });

  // ── Animation frame ──────────────────────────────────────────────────────
  private raf: number | null = null;

  // ── Interaction state ────────────────────────────────────────────────────
  private dragging    = false;
  private lastPointer = { x: 0, y: 0 };

  // ── Resize observer ──────────────────────────────────────────────────────
  private resizeObserver: ResizeObserver | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  constructor() {
    // Redraw whenever layers input changes
    effect(() => {
      void this.layers();
      this.scheduleRedraw();
    });
    // Redraw on theme change
    effect(() => {
      void this.theme.theme();
      this.scheduleRedraw();
    });
    // Sync xAxisFormat input to viewport
    effect(() => {
      const fmt = this.xAxisFormat();
      this.vp.update((v) => ({ ...v, xAxisFormat: fmt }));
      this.scheduleRedraw();
    });
  }

  ngAfterViewInit(): void {
    const canvas  = this.canvasRef()?.nativeElement;
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

  // ── Public API ───────────────────────────────────────────────────────────

  zoom(factor: number, cssCenter?: { x: number; y: number }): void {
    this.vp.update((v) => {
      const cx = cssCenter ? this.coords.cssToMathX(cssCenter.x, v) : v.originMath.x;
      const cy = cssCenter ? this.coords.cssToMathY(cssCenter.y, v) : v.originMath.y;
      const newUnit = Math.max(8, Math.min(2000, v.unit * factor));
      // Keep the zoom center fixed in math space:
      //   newOrigin = zoomPt - (zoomPt - oldOrigin) * oldUnit / newUnit
      return {
        ...v,
        unit:       newUnit,
        originMath: {
          x: cx - (cx - v.originMath.x) * (v.unit / newUnit),
          y: cy - (cy - v.originMath.y) * (v.unit / newUnit),
        },
      };
    });
    this.scheduleRedraw();
  }

  resetView(): void {
    this.vp.update((v) => ({
      ...v,
      unit:       this.initialUnit(),
      originMath: { x: 0, y: 0 },
    }));
    this.scheduleRedraw();
  }

  getViewport(): CanvasViewport {
    return this.vp();
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect   = (e.target as HTMLElement).getBoundingClientRect();
    const cssPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.zoom(factor, cssPos);
  }

  onPointerDown(e: PointerEvent): void {
    this.dragging    = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent): void {
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
    this.scheduleRedraw();
  }

  onPointerUp(e: PointerEvent): void {
    this.dragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private scheduleRedraw(): void {
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

    const vp    = this.vp();
    const theme = this.theme.isDark ? DARK_THEME : LIGHT_THEME;

    // Reset transform and apply DPR scale so all drawing is in CSS pixels
    ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);

    // Background + grid + axes + labels
    this.renderer.drawBackground(ctx, vp, theme);

    // Curve layers
    for (const layer of this.layers()) {
      for (const curve of layer.curves) {
        this.plotter.drawCurve(ctx, curve, vp);
      }
      layer.onDraw?.(ctx, vp);
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private resizeCanvas(
    canvas: HTMLCanvasElement,
    wrapper: HTMLDivElement,
  ): void {
    const dpr = window.devicePixelRatio || 1;
    const w   = wrapper.clientWidth;
    const h   = wrapper.clientHeight;

    // Physical pixels
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    this.vp.update((v) => ({ ...v, cssWidth: w, cssHeight: h, dpr }));
  }
}
