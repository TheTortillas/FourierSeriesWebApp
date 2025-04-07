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
  selector: 'app-half-range-series',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './half-range-series.component.html',
  styleUrl: './half-range-series.component.scss',
})
export class HalfRangeSeriesComponent implements OnInit, AfterViewChecked {
  // Matriz de funciones a trozos (función, inicio, fin)
  pieces: {
    function: string;
    start: string;
    end: string;
  }[] = [{ function: 'x', start: '0', end: '%pi' }];

  variable: string = 'x';
  selectedSeries: string = 'both'; // 'both', 'cosine', 'sine'

  // Results
  result: any = null;
  loading: boolean = false;
  error: string | null = null;
  latexRendered: { a0: SafeHtml; an: SafeHtml; bn: SafeHtml } | null = null;
  fullCosineLatexFormula: SafeHtml | null = null;
  fullSineLatexFormula: SafeHtml | null = null;

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
      end: (parseFloat(lastPiece.end.replace('%pi', 'Math.PI')) + 1).toString(),
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
    this.fullCosineLatexFormula = null;
    this.fullSineLatexFormula = null;

    // Convertir el formato de datos al que espera la API
    const funcionMatrix = this.pieces.map((piece) => [
      piece.function,
      piece.start,
      piece.end,
    ]);

    this.apiService
      .calculateHalfRangeSeries({
        funcionMatrix,
        intVar: this.variable,
      })

      .subscribe({
        next: (data) => {
          console.log('API Request:', {
            funcionMatrix,
            intVar: this.variable,
          });
          this.result = data;
          console.log('API Response:', data);
          this.loading = false;
          this.processLatexResults(data.latex);
          this.formulasNeedRendering = true;
        },
        error: (err) => {
          this.error =
            err.message || 'Error al calcular las series de medio rango';
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
    const cosine = this.stripLatexDelimiters(latexResults.cosineCore || '');
    const sine = this.stripLatexDelimiters(latexResults.sineCore || '');

    // Construimos la serie de cosenos si a0 o an no son cero
    let cosineLatexFormula = '';
    if (a0 !== '0' && an !== '0') {
      cosineLatexFormula = `${a0} + \\sum_{n=1}^{\\infty} ${an} \\cdot ${cosine}`;
    } else if (a0 !== '0') {
      cosineLatexFormula = a0;
    } else if (an !== '0') {
      cosineLatexFormula = `\\sum_{n=1}^{\\infty} ${an} \\cdot ${cosine}`;
    } else {
      cosineLatexFormula = '0';
    }

    // Construimos la serie de senos si bn no es cero
    let sineLatexFormula = '';
    if (bn !== '0') {
      sineLatexFormula = `\\sum_{n=1}^{\\infty} ${bn} \\cdot ${sine}`;
    } else {
      sineLatexFormula = '0';
    }

    // Guardamos la fórmula renderizada
    this.latexRendered = {
      a0: this.sanitizer.bypassSecurityTrustHtml(`\\[${a0}\\]`),
      an: this.sanitizer.bypassSecurityTrustHtml(`\\[${an}\\]`),
      bn: this.sanitizer.bypassSecurityTrustHtml(`\\[${bn}\\]`),
    };

    this.fullCosineLatexFormula = this.sanitizer.bypassSecurityTrustHtml(
      `\\[ f_c(${this.variable}) = ${cosineLatexFormula} \\]`
    );

    this.fullSineLatexFormula = this.sanitizer.bypassSecurityTrustHtml(
      `\\[ f_s(${this.variable}) = ${sineLatexFormula} \\]`
    );
  }
}
