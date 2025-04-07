import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api/api.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

declare global {
  interface Window {
    MathJax: any;
  }
}

@Component({
  selector: 'app-trigonometric-series',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trigonometric-series.component.html',
  styleUrl: './trigonometric-series.component.scss',
})
export class TrigonometricSeriesComponent implements OnInit, AfterViewChecked {
  // Form fields
  function: string = 'x';
  period: string = '2*%pi';
  variable: string = 'x';

  // Results
  result: any = null;
  loading: boolean = false;
  error: string | null = null;
  latexRendered: {
    a0: SafeHtml;
    an: SafeHtml;
    bn: SafeHtml;
  } | null = null;
  fullLatexFormula: SafeHtml | null = null;

  // Flag to track when formulas need rendering
  private formulasNeedRendering = false;

  constructor(
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {}

  ngAfterViewChecked(): void {
    // Re-render MathJax when needed
    if (this.formulasNeedRendering && window.MathJax) {
      window.MathJax.typeset();
      this.formulasNeedRendering = false;
    }
  }

  calculateSeries(): void {
    this.loading = true;
    this.error = null;
    this.result = null;
    this.latexRendered = null;

    this.apiService
      .calculateTrigonometricSeries({
        funcion: this.function,
        periodo: this.period,
        intVar: this.variable,
      })
      .subscribe({
        next: (data) => {
          this.result = data;
          console.log('API Response:', data);
          this.loading = false;
          this.processLatexResults(data.latex);
          this.formulasNeedRendering = true;
        },
        error: (err) => {
          this.error =
            err.message || 'Error al calcular la serie trigonométrica';
          this.loading = false;
          console.error('API Error:', err);
        },
      });
  }

  private stripLatexDelimiters(latex: string): string {
    return latex
      .replace(/^\$\$?/, '')
      .replace(/\$\$?$/, '')
      .trim();
  }

  processLatexResults(latexResults: any): void {
    // Guardamos los coeficientes y núcleos
    const a0 = this.stripLatexDelimiters(latexResults.a0 || '');
    const an = this.stripLatexDelimiters(latexResults.an || '');
    const bn = this.stripLatexDelimiters(latexResults.bn || '');
    const cosine = this.stripLatexDelimiters(
      latexResults.series_cosine_core || ''
    );
    const sine = this.stripLatexDelimiters(latexResults.series_sine_core || '');

    // Construimos los términos de la suma si no son cero
    const terms = [];

    if (an !== '0') {
      terms.push(`${an} \\cdot ${cosine}`);
    }

    if (bn !== '0') {
      terms.push(`${bn} \\cdot ${sine}`);
    }

    let latexFormula = '';

    if (a0 !== '0') {
      latexFormula = `${a0} + \\sum_{n=1}^{\\infty} \\left( ${terms.join(
        ' + '
      )} \\right)`;
    } else if (terms.length > 0) {
      latexFormula = `\\sum_{n=1}^{\\infty} \\left( ${terms.join(
        ' + '
      )} \\right)`;
    } else {
      latexFormula = '0';
    }

    // Guardamos la fórmula renderizada
    this.latexRendered = {
      a0: this.sanitizer.bypassSecurityTrustHtml(`\\[${a0}\\]`),
      an: this.sanitizer.bypassSecurityTrustHtml(`\\[${an}\\]`),
      bn: this.sanitizer.bypassSecurityTrustHtml(`\\[${bn}\\]`),
    };

    this.fullLatexFormula = this.sanitizer.bypassSecurityTrustHtml(
      `\\[ f(${this.variable}) = ${latexFormula} \\]`
    );
  }
}
