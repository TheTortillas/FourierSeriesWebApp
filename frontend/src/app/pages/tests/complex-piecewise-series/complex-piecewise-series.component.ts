import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

declare global {
  interface Window {
    MathJax: any;
  }
}

@Component({
  selector: 'app-complex-piecewise-series',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complex-piecewise-series.component.html',
  styleUrl: './complex-piecewise-series.component.scss',
})
export class ComplexPiecewiseSeriesComponent
  implements OnInit, AfterViewChecked
{
  // Matriz de funciones a trozos (función, inicio, fin)
  pieces: {
    function: string;
    start: string;
    end: string;
  }[] = [
    { function: 'x', start: '-%pi', end: '0' },
    { function: '%pi-x', start: '0', end: '%pi' },
  ];

  variable: string = 'x';

  // Results
  result: any = null;
  loading: boolean = false;
  error: string | null = null;
  latexRendered: { c0: SafeHtml; cn: SafeHtml } | null = null;
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

  addPiece(): void {
    const lastPiece = this.pieces[this.pieces.length - 1];
    this.pieces.push({
      function: 'x',
      start: lastPiece.end,
      end: (parseFloat(lastPiece.end) + 1).toString(),
    });
  }

  removePiece(index: number): void {
    if (this.pieces.length > 1) {
      this.pieces.splice(index, 1);
    }
  }

  calculateSeries(): void {
    this.loading = true;
    this.error = null;
    this.result = null;
    this.latexRendered = null;

    // Convertir el formato de datos al que espera la API
    const funcionMatrix = this.pieces.map((piece) => [
      piece.function,
      piece.start,
      piece.end,
    ]);

    this.apiService
      .calculateComplexSeriesPiecewise({
        funcionMatrix,
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
            err.message || 'Error al calcular la serie compleja a trozos';
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
    // Preparar el contenido LaTeX para MathJax
    this.latexRendered = {
      c0: this.sanitizer.bypassSecurityTrustHtml(
        `<div class="math-formula">\\[${latexResults.c0}\\]</div>`
      ),
      cn: this.sanitizer.bypassSecurityTrustHtml(
        `<div class="math-formula">\\[${latexResults.cn}\\]</div>`
      ),
    };

    // Guardamos los coeficientes y núcleos
    const c0 = this.stripLatexDelimiters(latexResults.c0 || '');
    const cn = this.stripLatexDelimiters(latexResults.cn || '');
    const w0 = this.stripLatexDelimiters(this.result.latex.w0 || '');
    const expCore = this.stripLatexDelimiters(
      this.result.latex.series_exp_core || ''
    );

    // Construimos la fórmula de la serie completa
    let latexFormula = '';

    if (c0 !== '0' && cn !== '0') {
      latexFormula = `${c0} + \\sum_{\\substack{n=-\\infty \\ n \\neq 0}}^{\\infty} ${cn} \\cdot ${expCore}`;
    } else if (c0 !== '0' && cn === '0') {
      latexFormula = c0; // Sólo el término c0
    } else if (c0 === '0' && cn !== '0') {
      latexFormula = `\\sum_{\\substack{n=-\\infty \\ n \\neq 0}}^{\\infty} ${cn} \\cdot ${expCore}`;
    } else {
      latexFormula = '0'; // Ambos son cero
    }

    this.fullLatexFormula = this.sanitizer.bypassSecurityTrustHtml(
      `<div class="math-formula">\\[ f(${this.variable}) = ${latexFormula} \\]</div>`
    );
  }
}
