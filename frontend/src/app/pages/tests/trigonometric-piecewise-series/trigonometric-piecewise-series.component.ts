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
  selector: 'app-trigonometric-piecewise-series',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trigonometric-piecewise-series.component.html',
  styleUrl: './trigonometric-piecewise-series.component.scss',
})
export class TrigonometricPiecewiseSeriesComponent
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
  latexRendered: { a0: SafeHtml; an: SafeHtml; bn: SafeHtml } | null = null;
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
      .calculateTrigonometricSeriesPiecewise({
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
            err.message || 'Error al calcular la serie trigonométrica a trozos';
          this.loading = false;
          console.error('API Error:', err);
        },
      });
  }

  private stripLatexDelimiters(latex: string): string {
    return latex
      .replace(/\\\s*\n/g, '') // Elimina backslashes seguidos de nueva línea
      .replace(/\\\n/g, '') // En caso de que vengan escapados
      .replace(/^\$\$?/, '') // Elimina delimitador inicial $$ o $
      .replace(/\$\$?$/, '') // Elimina delimitador final $$ o $
      .trim();
  }

  processLatexResults(latexResults: any): void {
    // Guardamos los coeficientes y núcleos
    const a0 = this.stripLatexDelimiters(latexResults.a0 || '');
    const an = this.stripLatexDelimiters(latexResults.an || '');
    const bn = this.stripLatexDelimiters(latexResults.bn || '');
    const cosine = this.stripLatexDelimiters(latexResults.cosineCore || '');
    const sine = this.stripLatexDelimiters(latexResults.sineCore || '');

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
