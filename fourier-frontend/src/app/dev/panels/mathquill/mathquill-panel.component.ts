import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MathquillService, MathField } from '../../../core/services/math/mathquill.service';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';

@Component({
  selector: 'app-mathquill-panel',
  imports: [FormsModule],
  templateUrl: './mathquill-panel.component.html',
})
export class MathquillPanelComponent implements AfterViewInit, OnDestroy {
  private readonly mqs    = inject(MathquillService);
  private readonly l2m    = inject(LatexToMaximaService);
  private readonly math   = inject(MathUtilsService);

  readonly mqContainer = viewChild<ElementRef<HTMLSpanElement>>('mqContainer');

  private field: MathField | null = null;

  latex  = signal('');
  maxima = signal('');
  evalResult = signal<string | null>(null);
  evalX  = 1;
  error  = signal<string | null>(null);
  mqReady = signal(false);

  async ngAfterViewInit(): Promise<void> {
    const el = this.mqContainer()?.nativeElement;
    if (!el) return;

    this.field = await this.mqs.createField(el, {
      ...this.mqs.defaultConfig(),
      handlers: {
        edit: (mf) => {
          const tex = mf.latex();
          this.latex.set(tex);
          this.updateConversion(tex);
        },
      },
    });

    if (this.field) {
      this.mqReady.set(true);
    } else {
      this.error.set(
        'MathQuill no pudo cargarse. Comprueba que jQuery y mathquill estén instalados.',
      );
    }
  }

  ngOnDestroy(): void {
    this.field = null;
  }

  setLatex(tex: string): void {
    this.field?.latex(tex);
    this.latex.set(tex);
    this.updateConversion(tex);
  }

  evaluate(): void {
    const res = this.math.evaluate(this.maxima(), this.evalX);
    this.evalResult.set(isNaN(res) ? 'NaN (no evaluable en JS)' : String(res));
  }

  private updateConversion(tex: string): void {
    const res = this.l2m.convert(tex);
    if (res.ok) {
      this.maxima.set(res.maxima);
      this.error.set(null);
    } else {
      this.maxima.set('');
      this.error.set(res.error ?? null);
    }
    this.evalResult.set(null);
  }

  readonly presets = [
    { label: 'x²',          latex: 'x^2'                     },
    { label: 'sin(πx)',     latex: '\\sin(\\pi x)'            },
    { label: '1/2',         latex: '\\frac{1}{2}'             },
    { label: 'e⁻ˣ',        latex: 'e^{-x}'                   },
    { label: '√(x²+1)',    latex: '\\sqrt{x^2+1}'            },
    { label: '|x|',         latex: '\\left|x\\right|'         },
  ];

  json(v: unknown): string { return JSON.stringify(v, null, 2); }
}
