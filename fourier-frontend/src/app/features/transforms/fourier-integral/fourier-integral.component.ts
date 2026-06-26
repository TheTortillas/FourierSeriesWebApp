import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject, switchMap } from 'rxjs';

import { NavComponent } from '../../../shared/components/nav/nav.component';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';
import {
  FunctionPlotComponent,
  PlotLayer,
} from '../../../shared/components/function-plot/function-plot.component';
import { ApiService } from '../../../core/services/api/api.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { formatApiError } from '../../../shared/utils/api-error.utils';
import { PlottingService } from '../../../core/services/canvas/plotting.service';
import { CoordinateTransformService } from '../../../core/services/canvas/coordinate-transform.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { SeoService } from '../../../core/services/seo/seo.service';
import { TransformSegmentComponent, TransformSegmentDraft } from '../continuous/transform-segment.component';
import { MathquillService, KeyBtn } from '../../../core/services/math/mathquill.service';
import { MobileMathKeyboardComponent } from '../../../shared/components/math-keyboard/mobile-math-keyboard.component';
import type {
  FourierIntegralVariant,
  FourierIntegralCoefficientsResponse,
  FourierIntegralReconstructResponse,
  ReconstructPoint,
} from '../../../domain/types/transform.types';

let _nextId = 0;
const mkId = () => `fi-${++_nextId}`;

function defaultSegment(): TransformSegmentDraft {
  return {
    id: mkId(),
    expression: '1',
    expressionTex: '1',
    from: '-1',
    fromTex: '-1',
    to: '1',
    toTex: '1',
  };
}

@Component({
  selector: 'app-fourier-integral',
  templateUrl: './fourier-integral.component.html',
  imports: [
    NavComponent,
    MathjaxDirective,
    FunctionPlotComponent,
    TransformSegmentComponent,
    FormsModule,
    TranslocoPipe,
    MobileMathKeyboardComponent,
  ],
})
export class FourierIntegralComponent implements OnInit {
  readonly api = inject(ApiService);
  readonly mqs = inject(MathquillService);
  readonly userStore = inject(UserStore);
  readonly theme = inject(ThemeService);
  readonly plotter = inject(PlottingService);
  readonly coordTransform = inject(CoordinateTransformService);
  readonly mathUtils = inject(MathUtilsService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  readonly destroyRef = inject(DestroyRef);

  showKeyboard = false;

  readonly mobileExtraGroup: KeyBtn[] = [
    { label: '∞', write: '\\infty' },
    { label: '-∞', write: '-\\infty' },
    { label: 'i', typedText: 'i' },
  ];

  readonly keyGroups: KeyBtn[][] = [
    // Row 1: Trig functions
    [
      { label: 'sin(□)', writeWithCursor: '\\sin\\left(\\right)' },
      { label: 'cos(□)', writeWithCursor: '\\cos\\left(\\right)' },
      { label: 'sinh(□)', writeWithCursor: '\\sinh\\left(\\right)' },
      { label: 'cosh(□)', writeWithCursor: '\\cosh\\left(\\right)' },
      { label: 'e^□' },
    ],
    // Row 2: Operators and constants
    [
      { label: '□²' },
      { label: '□^□' },
      { label: '□/□' },
      { label: '√□', cmd: '\\sqrt' },
      { label: '(□)', writeWithCursor: '\\left(\\right)' },
      { label: 'π', typedText: 'pi' },
      { label: '∞', write: '\\infty' },
      { label: '-∞', write: '-\\infty' },
      { label: '−', write: '-' },
      { label: '⌫', keystroke: 'Backspace' },
    ],
  ];

  /** Variant options list for the template. */
  readonly variants: { id: string; label: string }[] = [
    { id: 'trigonometric', label: 'Trigonométrica' },
    { id: 'complex', label: 'Compleja' },
    { id: 'cosine', label: 'Integral Coseno' },
    { id: 'sine', label: 'Integral Seno' },
  ];

  // ── State ──────────────────────────────────────────────────────────────────

  readonly variant = signal<FourierIntegralVariant>('trigonometric');
  readonly segments = signal<TransformSegmentDraft[]>([defaultSegment()]);
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly coeffResult = signal<FourierIntegralCoefficientsResponse | null>(null);

  // ── Reconstruction / slider ────────────────────────────────────────────────
  readonly upperLimit = signal(8);
  readonly upperLimitMin = 1;
  readonly upperLimitMax = 64;
  readonly reconstructPoints = signal<ReconstructPoint[]>([]);
  readonly reconstructLoading = signal(false);
  readonly showReconstruction = signal(false);

  private readonly sliderChange$ = new Subject<number>();

  // ── Canvas ────────────────────────────────────────────────────────────────
  readonly plotComponent = viewChild(FunctionPlotComponent);
  readonly canvasWrapper = viewChild<ElementRef<HTMLDivElement>>('canvasWrapper');

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly canCalculate = computed(() =>
    this.segments().every((s) => s.expression.trim() && s.from.trim() && s.to.trim()),
  );

  readonly hasResult = computed(() => this.coeffResult() !== null);
  readonly inputsLocked = computed(() => this.loading() || this.hasResult());

  readonly variantLabel = computed(() => {
    const v = this.variant();
    if (v === 'trigonometric') return 'Trigonométrica';
    if (v === 'complex') return 'Compleja';
    if (v === 'cosine') return 'Integral Coseno';
    return 'Integral Seno';
  });

  /** Live LaTeX preview of the piecewise input function. */
  readonly previewLatex = computed<string | null>(() => {
    const res = this.coeffResult();
    if (res?.fourierIntegralTex) return res.fourierIntegralTex;

    const segs = this.segments();
    if (segs.length === 0) return null;
    const hasContent = segs.some((s) => s.expressionTex || s.fromTex || s.toTex);
    if (!hasContent) return null;

    if (segs.length === 1) {
      const s = segs[0];
      return `f(v) = ${s.expressionTex || '\\square'}, \\quad ${s.fromTex || '\\square'} < v < ${s.toTex || '\\square'}`;
    }

    const rows = segs
      .map(
        (s) =>
          `${s.expressionTex || '\\square'}, & ${s.fromTex || '\\square'} < v < ${s.toTex || '\\square'}`,
      )
      .join(' \\\\ ');
    return `f(v) = \\begin{cases} ${rows} \\end{cases}`;
  });

  readonly reconstructionFormulaTex = computed(() => {
    const v = this.variant();
    const a = this.upperLimit();
    if (v === 'complex') {
      return `f(x) \\approx \\int_{-${a}}^{${a}} C(\\omega)\\, e^{i\\omega x}\\, d\\omega`;
    }
    if (v === 'cosine') {
      return `f(x) \\approx \\int_{0}^{${a}} A(\\omega)\\cos(\\omega x)\\, d\\omega`;
    }
    if (v === 'sine') {
      return `f(x) \\approx \\int_{0}^{${a}} B(\\omega)\\sin(\\omega x)\\, d\\omega`;
    }
    return `f(x) \\approx \\int_{0}^{${a}} \\left[A(\\omega)\\cos(\\omega x) + B(\\omega)\\sin(\\omega x)\\right] d\\omega`;
  });

  // ── Helpers for template type safety ─────────────────────────────────────
  castVariant(v: string): FourierIntegralVariant {
    return v as FourierIntegralVariant;
  }

  // ── Canvas layers ─────────────────────────────────────────────────────────

  readonly layers = computed<PlotLayer[]>(() => {
    const pts = this.reconstructPoints();
    const segs = this.segments();
    const plotter = this.plotter;
    const mathUtils = this.mathUtils;
    const isDark = this.theme.isDark;

    const originalColor = isDark ? '#f87171' : '#dc2626';
    const reconstructColor = isDark ? '#60a5fa' : '#2563eb';

    const layer: PlotLayer = {
      curves: [],
      onDraw: (ctx, vp) => {
        // Draw original function from segments (variable is v)
        const finitePieces: { fn: (x: number) => number; from: number; to: number }[] = [];
        for (const seg of segs) {
          if (!seg.expression || !seg.from || !seg.to) continue;
          const from = seg.from === 'minf' || seg.from === '-inf' ? -Infinity : parseFloat(seg.from);
          const to   = seg.to   === 'inf'                         ? Infinity  : parseFloat(seg.to);
          const fn = mathUtils.compile(seg.expression, 'v', {});
          if (!fn) continue;
          if (isFinite(from) && isFinite(to)) {
            finitePieces.push({ fn, from, to });
          } else {
            const gated = (x: number) =>
              (x >= (isFinite(from) ? from : -Infinity) && x <= (isFinite(to) ? to : Infinity)) ? fn(x) : NaN;
            plotter.plotFn(ctx, gated, vp, { color: originalColor, lineWidth: 2, dashed: true });
          }
        }
        if (finitePieces.length > 0) {
          plotter.plotPiecewise(ctx, finitePieces, vp, { color: originalColor, lineWidth: 2, dashed: true });
        }

        // Draw reconstructed points
        if (pts.length >= 2) {
          const ct = this.coordTransform;
          ctx.beginPath();
          ctx.strokeStyle = reconstructColor;
          ctx.lineWidth = 2;
          let started = false;
          for (const pt of pts) {
            const cx = ct.mathToScreenX(pt.x, vp);
            const cy = ct.mathToScreenY(pt.y, vp);
            if (!isFinite(cy) || Math.abs(cy) > 1e6) { started = false; continue; }
            if (!started) { ctx.moveTo(cx, cy); started = true; }
            else ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
      },
    };

    return [layer];
  });

  ngOnInit(): void {
    this.seo.setPage(
      'seo.fourierIntegral.title',
      'seo.fourierIntegral.description',
      'Fourier integral, integral de Fourier, A(w), B(w), C(w), cosine integral, sine integral',
    );

    // Debounce slider → reconstruct call
    this.sliderChange$
      .pipe(
        debounceTime(400),
        switchMap((limit) => {
          if (!this.coeffResult()?.exists) return [];
          this.reconstructLoading.set(true);
          return this.api.calculateFourierIntegralReconstruct({
            segments: this.segments().map((s) => ({
              expression: s.expression,
              from: s.from,
              to: s.to,
            })),
            variant: this.variant(),
            upperLimit: limit,
            xMin: -4,
            xMax: 4,
            nPoints: 200,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res: FourierIntegralReconstructResponse) => {
          this.reconstructPoints.set(res.points);
          this.reconstructLoading.set(false);
          this.plotComponent()?.redraw();
        },
        error: () => this.reconstructLoading.set(false),
      });
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setVariant(v: FourierIntegralVariant): void {
    if (this.inputsLocked()) return;
    this.variant.set(v);
  }

  addSegment(): void {
    if (this.inputsLocked()) return;
    this.segments.update((segs) => [
      ...segs,
      { ...defaultSegment(), id: mkId(), from: segs.at(-1)?.to ?? '', fromTex: segs.at(-1)?.toTex ?? '' },
    ]);
  }

  removeSegment(id: string): void {
    if (this.inputsLocked()) return;
    this.segments.update((s) => s.filter((seg) => seg.id !== id));
  }

  updateSegment(id: string, changes: Partial<TransformSegmentDraft>): void {
    if (this.inputsLocked()) return;
    this.segments.update((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  startNewCalculation(): void {
    this.coeffResult.set(null);
    this.reconstructPoints.set([]);
    this.errorMsg.set(null);
    this.showReconstruction.set(false);
  }

  calculate(): void {
    if (this.inputsLocked() || !this.canCalculate()) return;

    this.loading.set(true);
    this.errorMsg.set(null);
    this.coeffResult.set(null);
    this.reconstructPoints.set([]);

    this.api
      .calculateFourierIntegralCoefficients({
        segments: this.segments().map((s) => ({
          expression: s.expression,
          from: s.from,
          to: s.to,
        })),
        variant: this.variant(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.coeffResult.set(res);
          this.loading.set(false);
          this.userStore.refreshQuota();
          if (res.exists) this.triggerReconstruct();
        },
        error: (e) => {
          this.errorMsg.set(
            formatApiError(
              e,
              this.transloco.translate('errors.generic'),
              (key, params) => this.transloco.translate(key, params ?? {}),
              this.transloco.getActiveLang(),
            ),
          );
          this.loading.set(false);
        },
      });
  }

  onSliderInput(value: number): void {
    this.upperLimit.set(value);
    this.sliderChange$.next(value);
  }

  downloadCanvas(): void {
    const canvas = this.canvasWrapper()?.nativeElement?.querySelector('canvas');
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fourier-integral.png';
    a.click();
  }

  private triggerReconstruct(): void {
    this.showReconstruction.set(true);
    this.sliderChange$.next(this.upperLimit());
  }

  display(tex: string): string {
    return `\\[${tex}\\]`;
  }
}
