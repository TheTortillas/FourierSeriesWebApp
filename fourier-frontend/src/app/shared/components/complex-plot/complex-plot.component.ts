import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { GlslCompilerService, ComplexMathFn, CompileResult } from '../../../core/services/canvas/glsl-compiler.service';
import { ComplexRendererService } from '../../../core/services/canvas/complex-renderer.service';
import { CanvasRendererService } from '../../../core/services/canvas/canvas-renderer.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { CanvasColorService } from '../../../core/services/canvas/canvas-color.service';
import {
  ColorScheme,
  ComplexPoint,
  ComplexViewport2D,
  ComplexViewport3D,
  CanvasViewport,
} from '../../../core/services/canvas/canvas.types';

export type { ColorScheme, ComplexPoint } from '../../../core/services/canvas/canvas.types';

// ── JavaScript color helpers (for Canvas2D legend/overlay) ────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as [number, number, number][])[i % 6]
    .map(c => c * 255 | 0) as [number, number, number];
}

function phaseColorJS(argW: number, absW: number, scheme: ColorScheme, modLines: boolean, invertMod = false): [number, number, number] {
  const h = ((argW / (2 * Math.PI)) + 1) % 1;
  if (scheme === 'magnitude') { let v = Math.atan(absW * 1.2) / (Math.PI * 0.5); if (invertMod) v = 1 - v; const g = v * 255 | 0; return [g, g, g]; }
  if (scheme === 'phase') return hsvToRgb(h, 1, 0.88);
  // classic: Wegert-style, value encodes |f|
  const logA = Math.log2(Math.max(absW, 1e-12));
  const iso = 0.5 + 0.5 * Math.cos(2 * Math.PI * (logA - Math.floor(logA)));
  let vv = invertMod ? 1 / (1 + absW) : absW / (1 + absW);
  if (modLines) vv *= 0.80 + 0.20 * iso;
  return hsvToRgb(h, 0.95, vv);
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-complex-plot',
  providers: [ComplexRendererService],
  templateUrl: './complex-plot.component.html',
  host: { class: 'block w-full h-full' },
})
export class ComplexPlotComponent implements AfterViewInit, OnDestroy {

  // ── Services ───────────────────────────────────────────────────────────────
  private readonly isBrowser    = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly compiler     = inject(GlslCompilerService);
  private readonly webgl        = inject(ComplexRendererService);
  private readonly axisRenderer = inject(CanvasRendererService);
  private readonly coords       = inject(CoordinateTransformService);
  private readonly colors       = inject(CanvasColorService);

  // ── Template refs ──────────────────────────────────────────────────────────
  readonly wrapperRef  = viewChild<ElementRef<HTMLDivElement>>('wrapper');
  readonly wglRef      = viewChild<ElementRef<HTMLCanvasElement>>('canvasWgl');
  readonly overlay2dRef = viewChild<ElementRef<HTMLCanvasElement>>('overlay2d');
  readonly overlay3dRef = viewChild<ElementRef<HTMLCanvasElement>>('overlay3d');

  // ── Inputs ─────────────────────────────────────────────────────────────────
  readonly expr         = input<string>('gamma(z)');
  readonly mode         = input<'2d' | '3d'>('2d');
  readonly colorScheme  = input<ColorScheme>('classic');
  readonly showModLines = input<boolean>(true);
  readonly invertMod    = input<boolean>(false);
  readonly showAxes     = input<boolean>(true);
  readonly showGrid2d   = input<boolean>(true);
  readonly range3d      = input<number>(4);
  readonly resolution   = input<number>(80);
  readonly heightScale  = input<number>(1.0);
  readonly zClip        = input<number>(5.0);
  readonly showGrid3d   = input<boolean>(true);
  readonly wireframe    = input<boolean>(false);
  readonly legendStyle  = input<'strip' | 'circle'>('strip');

  // ── Inputs — free parameters ───────────────────────────────────────────────
  /** Current values for detected free real parameters. */
  readonly paramValues = input<Record<string, number>>({});
  /** Variable alias to treat as the complex variable z (e.g. 's' for Laplace). */
  readonly varAlias = input<string>('z');

  // ── Outputs ────────────────────────────────────────────────────────────────
  readonly compileError    = output<string>();
  readonly mathPointerMove = output<ComplexPoint | null>();
  /** Emits the list of free parameter names after each successful compile. */
  readonly paramsDetected  = output<string[]>();

  // ── Internal state ─────────────────────────────────────────────────────────
  readonly compileErrorMsg = signal('');
  private lastCompile: CompileResult | null = null;

  private vp2d = signal<ComplexViewport2D>({
    cssWidth: 300, cssHeight: 200,
    centerRe: 0, centerIm: 0, scale: 80,
  });

  private vp3d: ComplexViewport3D = {
    cssWidth: 300, cssHeight: 200,
    rotX: -0.50, rotY: 0.40, zoom: 1.0,
    range: 4, heightScale: 1.0, zClip: 5.0,
    showGrid: true, wireframe: false,
  };

  private mathFn: ComplexMathFn | null = null;
  private dirty = false;
  private raf = 0;
  private resizeObs!: ResizeObserver;
  private drag2d = false;
  private m2d = { x: 0, y: 0 };
  private drag3d = false;
  private m3d = { x: 0, y: 0 };

  // ── Theme tokens ───────────────────────────────────────────────────────────
  private readonly complexColors = computed(() => this.colors.complexPlotColors());

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    // Recompile when expression changes
    effect(() => {
      const e = this.expr();
      if (this.isBrowser) this.compile(e);
    });

    // Redraw on any visual input change
    effect(() => {
      void this.mode(); void this.colorScheme(); void this.showModLines(); void this.invertMod();
      void this.showAxes(); void this.showGrid2d();
      void this.range3d(); void this.heightScale(); void this.zClip();
      void this.showGrid3d(); void this.wireframe(); void this.legendStyle();
      void this.paramValues();
      this.scheduleRender();
    });

    // Redraw on theme change
    effect(() => { void this.complexColors(); this.scheduleRender(); });

    // Sync 3D inputs into mutable vp3d snapshot
    effect(() => {
      this.vp3d = {
        ...this.vp3d,
        range:       this.range3d(),
        heightScale: this.heightScale(),
        zClip:       this.zClip(),
        showGrid:    this.showGrid3d(),
        wireframe:   this.wireframe(),
      };
      this.webgl.buildSurface(this.resolution(), this.range3d());
      this.scheduleRender();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.compiler.ensureMathJs().then(() => {
      const canvas = this.wglRef()!.nativeElement;
      if (!this.webgl.init(canvas)) {
        this.compileErrorMsg.set('WebGL no disponible en este navegador');
        this.compileError.emit(this.compileErrorMsg());
        return;
      }
      this.resizeCanvases();
      this.resizeObs = new ResizeObserver(() => { this.resizeCanvases(); this.scheduleRender(); });
      this.resizeObs.observe(this.wrapperRef()!.nativeElement);
      this.webgl.buildSurface(this.resolution(), this.range3d());
      this.compile(this.expr());
      this.initEvents();
      this.raf = requestAnimationFrame(() => this.renderLoop());
    });
  }

  ngOnDestroy(): void {
    if (this.isBrowser) cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  redraw(): void { this.scheduleRender(); }

  resetView2D(): void {
    this.vp2d.update(v => ({ ...v, centerRe: 0, centerIm: 0, scale: 80 }));
    this.scheduleRender();
  }

  resetView3D(): void {
    this.vp3d = { ...this.vp3d, rotX: -0.50, rotY: 0.40, zoom: 1.0 };
    this.scheduleRender();
  }

  // ── Compilation ────────────────────────────────────────────────────────────

  private compile(expr: string): void {
    const opts = { varAlias: this.varAlias() };
    let result: CompileResult;
    try {
      result = this.compiler.compile(expr.trim(), opts);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      this.compileErrorMsg.set(msg);
      this.compileError.emit(msg);
      return;
    }
    try {
      this.webgl.setFunction(result.glsl, result.paramUniforms, result.params);
    } catch {
      const msg = 'Error de compilación GPU';
      this.compileErrorMsg.set(msg);
      this.compileError.emit(msg);
      return;
    }
    this.lastCompile = result;
    this.mathFn = this.compiler.compileMathFn(expr.trim(), result.params, opts);
    this.compileErrorMsg.set('');
    this.compileError.emit('');
    this.paramsDetected.emit(result.params);
    this.scheduleRender();
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  private scheduleRender(): void { this.dirty = true; }

  private renderLoop(): void {
    if (this.dirty) {
      this.dirty = false;
      if (this.mode() === '2d') this.render2D();
      else this.render3D();
    }
    this.raf = requestAnimationFrame(() => this.renderLoop());
  }

  private render2D(): void {
    const canvas = this.wglRef()?.nativeElement;
    const overlay = this.overlay2dRef()?.nativeElement;
    if (!canvas || !overlay) return;

    const vp = this.vp2d();
    this.webgl.setParams(this.paramValues());
    this.webgl.render2D(canvas, vp, this.colorScheme(), this.showModLines(), this.invertMod());

    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Delegate grid/axes/labels to CanvasRendererService via CanvasViewport mapping
    if (this.showGrid2d() || this.showAxes()) {
      const cvp = this.toCanvasViewport(vp, overlay);
      const theme = this.canvasTheme();
      this.axisRenderer.drawBackground(ctx, cvp, theme);
    }

    this.drawLegend2D(ctx, overlay.width, overlay.height);
  }

  private render3D(): void {
    const canvas = this.wglRef()?.nativeElement;
    const overlay = this.overlay3dRef()?.nativeElement;
    if (!canvas || !overlay) return;

    const w = overlay.width, h = overlay.height;
    this.vp3d = { ...this.vp3d, cssWidth: w, cssHeight: h };
    this.webgl.setParams(this.paramValues());
    this.webgl.render3D(canvas, this.vp3d);

    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    this.drawAxes3D(ctx, w, h);
    if (this.legendStyle() === 'strip') {
      this.drawLegend3D(ctx, w, h);
    } else {
      this.drawLegendCircle3D(ctx, w, h);
    }
  }

  // ── CanvasViewport mapping (2D overlay uses CanvasRendererService) ─────────

  private toCanvasViewport(vp: ComplexViewport2D, canvas: HTMLCanvasElement): CanvasViewport {
    return {
      cssWidth:    canvas.width,
      cssHeight:   canvas.height,
      dpr:         1,           // overlay canvas is already at CSS pixels
      unit:        vp.scale,
      originMath:  { x: vp.centerRe, y: vp.centerIm },
      xAxisFormat: 'integer',
      customConst: { symbol: 'T', value: 1 },
      scaleX: 1,
      scaleY: 1,
    };
  }

  private canvasTheme() {
    const c = this.complexColors();
    return {
      bg: 'rgba(0,0,0,0)',
      axis:      c.axis,
      gridMajor: c.gridMajor,
      gridMinor: c.gridMinor,
      label:     c.label,
    };
  }

  // ── Canvas2D overlays ──────────────────────────────────────────────────────

  private drawLegend2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.legendStyle() === 'strip') {
      this.drawLegendStrip2D(ctx, W, H);
    } else {
      this.drawLegendCircle2D(ctx, W, H);
    }
  }

  private backdropRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pad = 14): void {
    ctx.save();
    ctx.globalAlpha = 0.60;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
    ctx.fill();
    ctx.restore();
  }

  private drawLegendStrip2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const bh = 160, bw = 14, by = Math.round(H / 2 - bh / 2);
    const scheme = this.colorScheme();
    const modLines = this.showModLines();
    const invertMod = this.invertMod();
    const c2 = this.complexColors();

    // magnitude mode: show only a |f| grayscale strip (arg is not encoded in color)
    if (scheme === 'magnitude') {
      const argX = W - 50;
      const backdropW = W - 6 - argX;
      ctx.save();
      this.backdropRect(ctx, argX, by, backdropW, bh, 20);
      ctx.globalAlpha = 0.92;
      for (let py = 0; py < bh; py++) {
        const t = 1 - py / bh;
        const absV = Math.tan(t * Math.PI * 0.48);
        const v = invertMod ? 1 / (1 + absV) : absV / (1 + absV);
        const lv = Math.round(v * 255);
        ctx.fillStyle = `rgb(${lv},${lv},${lv})`; ctx.fillRect(argX, by + py, bw, 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 1;
      ctx.strokeRect(argX, by, bw, bh);
      ctx.font = '10px monospace'; ctx.fillStyle = c2.legendMuted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('|f|', argX + bw / 2, by - 9);
      ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = c2.legendText;
      ctx.fillText(invertMod ? '0' : '∞', argX + bw + 5, by);
      ctx.fillText(invertMod ? '∞' : '0', argX + bw + 5, by + bh);
      ctx.restore();
      return;
    }

    // phase and classic: show arg strip. classic also shows |f| strip to the left.
    const hasModStrip = scheme === 'classic';
    // Layout: [|f| strip bw] [gap 6px] [arg strip bw] [tick labels]
    const argX   = W - 50;
    const gap    = 6;
    const modX   = argX - gap - bw;
    const backdropLeft = hasModStrip ? modX : argX;
    const backdropW = W - 6 - backdropLeft;

    ctx.save();
    this.backdropRect(ctx, backdropLeft, by, backdropW, bh, 20);

    // arg strip
    ctx.globalAlpha = 0.92;
    for (let py = 0; py < bh; py++) {
      const argV = Math.PI * (1 - 2 * py / bh);
      const [r, g, b] = phaseColorJS(argV, 1.5, scheme, modLines, invertMod);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(argX, by + py, bw, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 1;
    ctx.strokeRect(argX, by, bw, bh);

    // tick labels
    const ticks: [number, string][] = [[0, 'π'], [0.25, 'π/2'], [0.5, '0'], [0.75, '−π/2'], [1, '−π']];
    ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const [t, lbl] of ticks) {
      const ty = by + t * bh;
      ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(argX, ty); ctx.lineTo(argX - 3, ty); ctx.stroke();
      ctx.fillStyle = c2.legendText; ctx.fillText(lbl, argX + bw + 5, ty);
    }
    ctx.font = '10px monospace'; ctx.fillStyle = c2.legendMuted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('arg', argX + bw / 2, by - 9);

    // |f| strip (classic only)
    if (hasModStrip) {
      ctx.globalAlpha = 0.92;
      for (let py = 0; py < bh; py++) {
        const t = 1 - py / bh;
        const absV = Math.tan(t * Math.PI * 0.48);
        const v = invertMod ? 1 / (1 + absV) : absV / (1 + absV);
        const lv = Math.round(v * 255);
        ctx.fillStyle = `rgb(${lv},${lv},${lv})`; ctx.fillRect(modX, by + py, bw, 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 1;
      ctx.strokeRect(modX, by, bw, bh);
      ctx.font = '10px monospace'; ctx.fillStyle = c2.legendMuted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('|f|', modX + bw / 2, by - 9);
      ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(modX + bw, by); ctx.lineTo(modX + bw + 3, by); ctx.stroke();
      ctx.fillStyle = c2.legendText;
      ctx.fillText(invertMod ? '0' : '∞', modX - 4, by);
      ctx.beginPath(); ctx.moveTo(modX + bw, by + bh); ctx.lineTo(modX + bw + 3, by + bh); ctx.stroke();
      ctx.fillText(invertMod ? '∞' : '0', modX - 4, by + bh);
    }
    ctx.restore();
  }

  private drawLegendCircle2D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const R = 50, cx = W - 76, cy = H - 76;
    const scheme = this.colorScheme();
    const modLines = this.showModLines();
    const invertMod = this.invertMod();
    const c2 = this.complexColors();
    ctx.save();

    // Uniform backdrop: square with generous padding, drawn once
    this.backdropRect(ctx, cx - R, cy - R, R * 2, R * 2, 18);

    // Clip to circle so all drawing is cleanly circular
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
    ctx.globalAlpha = 0.92;

    if (scheme === 'classic') {
      // Offscreen canvas so we can clip+drawImage (putImageData ignores clip)
      const D = R * 2;
      const off = document.createElement('canvas');
      off.width = off.height = D;
      const octx = off.getContext('2d')!;
      const img = octx.createImageData(D, D);
      for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
          const dx = px - R, dy = py - R;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= R) continue;
          const argW = Math.atan2(-dy, dx);
          const absV = dist / (R - dist + 0.5);
          const [r, g, b] = phaseColorJS(argW, absV, scheme, modLines, invertMod);
          const i = (py * D + px) * 4;
          img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, cx - R, cy - R);
    } else if (scheme === 'magnitude') {
      // Radial grayscale: center=0 (or ∞ if inverted), edge=∞ (or 0)
      const D = R * 2;
      const off = document.createElement('canvas');
      off.width = off.height = D;
      const octx = off.getContext('2d')!;
      const img = octx.createImageData(D, D);
      for (let py = 0; py < D; py++) {
        for (let px = 0; px < D; px++) {
          const dx = px - R, dy = py - R;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= R) continue;
          const absV = dist / (R - dist + 0.5);
          const v = invertMod ? 1 / (1 + absV) : absV / (1 + absV);
          const lv = Math.round(v * 255);
          const i = (py * D + px) * 4;
          img.data[i] = lv; img.data[i+1] = lv; img.data[i+2] = lv; img.data[i+3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, cx - R, cy - R);
    } else {
      // phase: pure hue wheel
      for (let a = 0; a < 360; a++) {
        const argW = (a / 360) * 2 * Math.PI - Math.PI;
        const [r, g, b] = phaseColorJS(argW, 1.5, scheme, modLines, invertMod);
        const a1 = (a / 360) * 2 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a1, a1 + Math.PI / 180 + 0.02);
        ctx.closePath(); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
      }
    }

    // Remove clip for border and labels
    ctx.restore(); ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c2.legendStroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();

    ctx.fillStyle = c2.legendText;
    ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (scheme === 'magnitude') {
      // radial legend: center=0, edge=∞ (inverted: center=∞, edge=0)
      ctx.fillText(invertMod ? '∞' : '0',  cx,          cy + 4);
      ctx.fillText(invertMod ? '0' : '∞',  cx + R + 11, cy);
      ctx.font = '10px monospace'; ctx.fillStyle = c2.legendMuted;
      ctx.fillText('|f|', cx, cy - R - 12);
    } else {
      // arg labels for classic and phase
      ctx.fillText('0',     cx + R + 11, cy);
      ctx.fillText('π',    cx - R - 11, cy);
      ctx.fillText('π/2',   cx,          cy - R - 12);
      ctx.fillText('−π/2',  cx,          cy + R + 12);
      if (scheme === 'classic') {
        ctx.font = '10px monospace'; ctx.fillStyle = c2.legendMuted;
        ctx.fillText('0', cx, cy + 4);
      }
    }
    ctx.restore();
  }

  private proj3D(wx: number, wy: number, wz: number, W: number, H: number): { x: number; y: number } {
    const { rotX, rotY, zoom, range } = this.vp3d;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const x1 = wx * cy - wz * sy, z1 = wx * sy + wz * cy, y1 = wy;
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const y2 = y1 * cx + z1 * sx, z2 = -y1 * sx + z1 * cx, x2 = x1;
    const d = range * 2.8, ps = d / Math.max(d + z2, 0.01);
    const ppu = zoom * Math.min(W, H) * 0.42 / range;
    return { x: W / 2 + x2 * ps * ppu, y: H / 2 - y2 * ps * ppu };
  }

  private drawAxes3D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const R = this.vp3d.range;
    const c = this.complexColors();
    const axes = [
      { from: [0, 0, 0] as [number, number, number], to: [R * 1.15, 0, 0] as [number, number, number], col: c.axisRe, lbl: 'Re' },
      { from: [0, 0, 0] as [number, number, number], to: [0, 0, R * 1.15] as [number, number, number], col: c.axisIm, lbl: 'Im' },
      { from: [0, 0, 0] as [number, number, number], to: [0, R * 1.15, 0] as [number, number, number], col: c.axisF,  lbl: '|f|' },
    ];
    ctx.save();
    for (const ax of axes) {
      const s = this.proj3D(...ax.from, W, H), e = this.proj3D(...ax.to, W, H);
      ctx.strokeStyle = ax.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.fillStyle = ax.col; ctx.font = 'bold 12px monospace';
      ctx.fillText(ax.lbl, e.x + 6, e.y + 4);
    }
    const tickStep = this.niceStep3D(R);
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let v = tickStep; v <= R; v += tickStep) {
      const p = this.proj3D(v, 0, 0, W, H);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = c.tickRe; ctx.fill();
      ctx.fillStyle = c.tickLabel; ctx.fillText(this.fmtN(v), p.x, p.y - 6);
      const q = this.proj3D(0, 0, v, W, H);
      ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = c.tickIm; ctx.fill();
      ctx.fillStyle = c.tickLabel; ctx.fillText(this.fmtN(v), q.x, q.y - 6);
    }
    ctx.restore();
  }

  private drawLegend3D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    this.drawPhaseStrip(ctx, W, H, this.complexColors());
  }

  private drawLegendCircle3D(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    // 3D: circle shows only phase (hue), no module dimension
    const R = 50, cx = W - 76, cy = H - 76;
    const c3 = this.complexColors();
    ctx.save();
    this.backdropRect(ctx, cx - R, cy - R, R * 2, R * 2, 18);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
    ctx.globalAlpha = 0.92;
    for (let a = 0; a < 360; a++) {
      const argW = (a / 360) * 2 * Math.PI - Math.PI;
      const h = ((argW / (2 * Math.PI)) + 1) % 1;
      const [r, g, b] = hsvToRgb(h, 0.92, 0.88);
      const a1 = (a / 360) * 2 * Math.PI;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a1, a1 + Math.PI / 180 + 0.02);
      ctx.closePath(); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
    }
    ctx.restore(); ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c3.legendStroke; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = c3.legendText;
    ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('0',     cx + R + 11, cy);
    ctx.fillText('π',    cx - R - 11, cy);
    ctx.fillText('π/2',   cx,          cy - R - 12);
    ctx.fillText('−π/2',  cx,          cy + R + 12);
    ctx.restore();
  }

  private drawPhaseStrip(ctx: CanvasRenderingContext2D, W: number, H: number, c: ReturnType<ComplexPlotComponent['complexColors']>): void {
    const bh = 160, bw = 14, bx = W - 50, by = Math.round(H / 2 - bh / 2);
    ctx.save();
    // pad=20 so header 'arg' above and last tick below are well inside the backdrop
    this.backdropRect(ctx, bx, by, bw + 34, bh, 20);
    ctx.globalAlpha = 0.92;
    for (let py = 0; py < bh; py++) {
      const argV = Math.PI * (1 - 2 * py / bh);
      const h = ((argV / (2 * Math.PI)) + 1) % 1;
      const [r, g, b] = hsvToRgb(h, 0.92, 0.88);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(bx, by + py, bw, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.legendStroke; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    const ticks: [number, string][] = [[0, 'π'], [0.25, 'π/2'], [0.5, '0'], [0.75, '−π/2'], [1, '−π']];
    ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const [t, lbl] of ticks) {
      const ty = by + t * bh;
      ctx.strokeStyle = c.legendStroke; ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx - 3, ty); ctx.stroke();
      ctx.fillStyle = c.legendText; ctx.fillText(lbl, bx + bw + 5, ty);
    }
    ctx.font = '10px monospace'; ctx.fillStyle = c.legendMuted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('arg', bx + bw / 2, by - 8);
    ctx.restore();
  }

  // ── Public capture ─────────────────────────────────────────────────────────

  /** Composites all canvas layers (WebGL + overlays) into a single PNG dataURL. */
  captureImage(): string {
    const wgl = this.wglRef()?.nativeElement;
    if (!wgl) return '';
    const W = wgl.width, H = wgl.height;
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(wgl, 0, 0);
    const ov2 = this.overlay2dRef()?.nativeElement;
    if (ov2) ctx.drawImage(ov2, 0, 0);
    const ov3 = this.overlay3dRef()?.nativeElement;
    if (ov3) ctx.drawImage(ov3, 0, 0);
    return tmp.toDataURL('image/png');
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private resizeCanvases(): void {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;
    const W = wrapper.clientWidth, H = wrapper.clientHeight;
    for (const ref of [this.wglRef(), this.overlay2dRef(), this.overlay3dRef()])
      if (ref) { ref.nativeElement.width = W; ref.nativeElement.height = H; }
    this.vp2d.update(v => ({ ...v, cssWidth: W, cssHeight: H }));
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private initEvents(): void {
    const c2 = this.overlay2dRef()!.nativeElement;
    const c3 = this.overlay3dRef()!.nativeElement;

    // 2D: pan
    c2.addEventListener('mousedown', e => {
      this.drag2d = true; this.m2d = { x: e.clientX, y: e.clientY };
      c2.style.cursor = 'grabbing';
    });
    c2.addEventListener('mousemove', e => {
      const vp = this.vp2d();
      if (this.drag2d) {
        this.vp2d.update(v => ({
          ...v,
          centerRe: v.centerRe - (e.clientX - this.m2d.x) / v.scale,
          centerIm: v.centerIm + (e.clientY - this.m2d.y) / v.scale,
        }));
        this.m2d = { x: e.clientX, y: e.clientY };
        this.scheduleRender();
      }
      const rect = c2.getBoundingClientRect();
      const re = vp.centerRe + (e.clientX - rect.left - c2.width / 2) / vp.scale;
      const im = vp.centerIm + (c2.height / 2 - (e.clientY - rect.top)) / vp.scale;
      this.emitHover(re, im);
    });
    const end2d = () => { this.drag2d = false; c2.style.cursor = 'crosshair'; };
    c2.addEventListener('mouseup', end2d);
    c2.addEventListener('mouseleave', () => { end2d(); this.mathPointerMove.emit(null); });
    c2.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY > 0 ? 0.83 : 1.20;
      const rect = c2.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      this.vp2d.update(v => {
        const re0 = v.centerRe + (px - c2.width / 2) / v.scale;
        const im0 = v.centerIm + (c2.height / 2 - py) / v.scale;
        const sc = v.scale * f;
        return { ...v, scale: sc, centerRe: re0 - (px - c2.width / 2) / sc, centerIm: im0 - (c2.height / 2 - py) / sc };
      });
      this.scheduleRender();
    }, { passive: false });

    // 3D: rotate + zoom
    c3.addEventListener('mousedown', e => { this.drag3d = true; this.m3d = { x: e.clientX, y: e.clientY }; });
    c3.addEventListener('mousemove', e => {
      if (this.drag3d) {
        this.vp3d = {
          ...this.vp3d,
          rotY: this.vp3d.rotY + (e.clientX - this.m3d.x) * 0.009,
          rotX: this.vp3d.rotX + (e.clientY - this.m3d.y) * 0.009,
        };
        this.m3d = { x: e.clientX, y: e.clientY };
        this.scheduleRender();
      }
    });
    const end3d = () => { this.drag3d = false; };
    c3.addEventListener('mouseup', end3d);
    c3.addEventListener('mouseleave', end3d);
    c3.addEventListener('wheel', e => {
      e.preventDefault();
      this.vp3d = { ...this.vp3d, zoom: Math.max(0.1, Math.min(8, this.vp3d.zoom * (e.deltaY > 0 ? 0.90 : 1.11))) };
      this.scheduleRender();
    }, { passive: false });
  }

  private emitHover(re: number, im: number): void {
    if (!this.mathFn) { this.mathPointerMove.emit(null); return; }
    try {
      const w = this.mathFn(re, im, this.paramValues());
      this.mathPointerMove.emit({ re, im, fRe: w.re, fIm: w.im, fAbs: w.abs, fArg: w.arg });
    } catch {
      this.mathPointerMove.emit(null);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private niceStep3D(range: number): number {
    return range <= 1.5 ? 0.25 : range <= 2.5 ? 0.5 : range <= 5 ? 1 : range <= 10 ? 2 : 5;
  }

  private fmtN(n: number): string {
    if (Math.abs(n) >= 1000) return n.toExponential(1);
    if (Math.abs(n) >= 100)  return Math.round(n) + '';
    if (Math.abs(n) >= 1)    return +n.toFixed(1) + '';
    return +n.toPrecision(2) + '';
  }
}
