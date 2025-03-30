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
  }[] = [{ function: 'x', start: '0', end: 'pi' }];

  variable: string = 'x';

  // Results
  result: any = null;
  loading: boolean = false;
  error: string | null = null;
  latexRendered: { a0: SafeHtml; an: SafeHtml; bn: SafeHtml } | null = null;

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
      .calculateHalfRangeSeries({
        funcionMatrix,
        intVar: this.variable,
      })
      .subscribe({
        next: (data) => {
          this.result = data;
          this.loading = false;
          this.processLatexResults(data.latex);
          this.formulasNeedRendering = true;
        },
        error: (err) => {
          this.error =
            err.message || 'Error al calcular la serie de medio rango';
          this.loading = false;
          console.error('API Error:', err);
        },
      });
  }

  processLatexResults(latexResults: any): void {
    // Preparar el contenido LaTeX para MathJax
    this.latexRendered = {
      a0: this.sanitizer.bypassSecurityTrustHtml(
        `<div class="math-formula">\\[${latexResults.a0}\\]</div>`
      ),
      an: this.sanitizer.bypassSecurityTrustHtml(
        `<div class="math-formula">\\[${latexResults.an}\\]</div>`
      ),
      bn: this.sanitizer.bypassSecurityTrustHtml(
        `<div class="math-formula">\\[${latexResults.bn}\\]</div>`
      ),
    };
  }
}
