import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { TranslocoPipe } from '@jsverse/transloco';
import { MathquillService, MathField } from '../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../core/services/math/latex-to-maxima.service';

export interface GraphExpression {
  id: string;
  latex: string;
  maxima: string;
  color: string;
  visible: boolean;
  lineWidth: number;
  lineDash: 'solid' | 'dashed' | 'dotted';
}

export const GRAPH_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#d97706', // amber
  '#9333ea', // purple
  '#0891b2', // cyan
] as const;

@Component({
  selector: 'app-grapher-expression',
  templateUrl: './grapher-expression.component.html',
  imports: [TranslocoPipe],
})
export class GrapherExpressionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mqExpr') mqExprRef!: ElementRef<HTMLElement>;

  private readonly mqs = inject(MathquillService);
  private readonly tex2max = inject(LatexToMaximaService);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  readonly expr = input.required<GraphExpression>();
  readonly isOnly = input<boolean>(false);
  /** When set to a non-empty string, forces the MathQuill field to that LaTeX value. */
  readonly syncLatex = input<string | null>(null);

  readonly changed = output<GraphExpression>();
  readonly removed = output<string>();

  readonly palette = GRAPH_PALETTE;

  field: MathField | null = null;
  private _syncing = false;

  constructor() {
    effect(() => {
      const lat = this.syncLatex();
      if (lat && this.field && !this._syncing) {
        this._syncing = true;
        this.field.latex(lat);
        this._syncing = false;
      }
    });
  }
  conversionError: string | null = null;
  readonly styleOpen = signal(false);

  private readonly _editSubject = new Subject<string>();
  private readonly _subs = new Subscription();

  private readonly _caretCapture = this.mqs.createCaretCapture(() => this.field);

  async ngAfterViewInit(): Promise<void> {
    this.elRef.nativeElement.addEventListener('keydown', this._caretCapture, true);

    this.field = await this.mqs.createField(this.mqExprRef.nativeElement, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf: MathField) => {
          if (this._syncing) return;
          const latex = mf.latex();
          if (!latex.trim()) {
            this.conversionError = null;
            this.emit({ latex: '', maxima: '' });
            return;
          }
          this.emit({ latex });
          this._editSubject.next(latex);
        },
      },
    });

    const initial = this.expr().latex;
    if (initial && this.field) {
      this._syncing = true;
      this.field.latex(initial);
      this._syncing = false;
    }

    this._subs.add(
      this._editSubject
        .pipe(
          debounceTime(350),
          switchMap((latex) => this.tex2max.convertWithSpecialFns(latex)),
        )
        .subscribe((result) => {
          if (result.ok) {
            this.conversionError = null;
            this.emit({ maxima: result.maxima });
          } else {
            this.conversionError = result.error ?? null;
            this.emit({ maxima: '' });
          }
        }),
    );
  }

  ngOnDestroy(): void {
    this.elRef.nativeElement.removeEventListener('keydown', this._caretCapture, true);
    this._subs.unsubscribe();
    this._editSubject.complete();
    if (this.mqExprRef?.nativeElement) this.mqExprRef.nativeElement.innerHTML = '';
  }

  toggleStyle(): void {
    this.styleOpen.update(v => !v);
  }

  setColor(color: string): void {
    this.emit({ color });
  }

  setLineWidth(w: number): void {
    this.emit({ lineWidth: w });
  }

  setLineDash(lineDash: GraphExpression['lineDash']): void {
    this.emit({ lineDash });
  }

  toggleVisible(): void {
    this.emit({ visible: !this.expr().visible });
  }

  remove(): void {
    this.removed.emit(this.expr().id);
  }

  onFocus(): void {
    this.mqs.setActiveField(this.field, `f(x)`);
  }

  private emit(patch: Partial<GraphExpression>): void {
    this.changed.emit({ ...this.expr(), ...patch });
  }
}
