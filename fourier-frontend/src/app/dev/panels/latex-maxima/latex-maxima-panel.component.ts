import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LatexToMaximaService } from '../../../core/services/math/latex-to-maxima.service';
import { MathUtilsService } from '../../../core/services/math/math-utils.service';
import { FourierValidatorService } from '../../../core/services/math/fourier-validator.service';
import { Segment } from '../../../domain';

interface ConversionRow {
  latex: string;
  maxima: string;
  ok: boolean;
  error?: string;
  evaluated?: string;
}

@Component({
  selector: 'app-latex-maxima-panel',
  imports: [FormsModule],
  templateUrl: './latex-maxima-panel.component.html',
})
export class LatexMaximaPanelComponent {
  private readonly converter = inject(LatexToMaximaService);
  private readonly mathUtils = inject(MathUtilsService);
  private readonly validator = inject(FourierValidatorService);

  // ── Single expression tester ────────────────────────────────────────────
  latex = '';
  result = signal<ConversionRow | null>(null);
  evalX = 1;

  convert(): void {
    if (!this.latex.trim()) return;
    const res = this.converter.convert(this.latex);
    let evaluated: string | undefined;
    if (res.ok) {
      const val = this.mathUtils.evaluate(res.maxima, this.evalX);
      evaluated = isNaN(val) ? 'NaN (no evaluable en JS)' : String(val);
    }
    this.result.set({ ...res, latex: this.latex, evaluated });
  }

  // ── Batch examples ───────────────────────────────────────────────────────
  readonly examples: { label: string; latex: string }[] = [
    { label: 'Fracción',       latex: '\\frac{1}{2}' },
    { label: 'Potencia',       latex: 'x^2 + 3x' },
    { label: 'Trig',           latex: '\\sin(x)' },
    { label: 'Pi',             latex: '\\pi' },
    { label: 'Euler',          latex: 'e^{-x}' },
    { label: 'Integral log',   latex: '\\frac{\\sin(\\pi x)}{x}' },
    { label: 'Raíz cuadrada',  latex: '\\sqrt{x^2 + 1}' },
  ];

  batchResults = signal<ConversionRow[]>([]);

  runBatch(): void {
    const rows: ConversionRow[] = this.examples.map(({ latex }) => {
      const res = this.converter.convert(latex);
      let evaluated: string | undefined;
      if (res.ok) {
        const val = this.mathUtils.evaluate(res.maxima, 1);
        evaluated = isNaN(val) ? 'NaN' : String(val);
      }
      return { ...res, latex, evaluated };
    });
    this.batchResults.set(rows);
  }

  // ── Validator tester ─────────────────────────────────────────────────────
  segments: Segment[] = [
    { expression: 'x',   from: '-%pi', to: '0'    },
    { expression: '1',   from: '0',    to: '%pi'   },
  ];
  validationJson = signal<string | null>(null);

  validateSegments(): void {
    const res = this.validator.validate(this.segments);
    this.validationJson.set(JSON.stringify(res, null, 2));
  }

  addSegment(): void {
    this.segments = [...this.segments, { expression: '', from: '', to: '' }];
  }

  removeSegment(i: number): void {
    if (this.segments.length > 1) {
      this.segments = this.segments.filter((_, idx) => idx !== i);
    }
  }

  trackByIndex(i: number): number { return i; }

  json(v: unknown): string { return JSON.stringify(v, null, 2); }
}
