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
  selector: 'app-trigonometric-series',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trigonometric-series.component.html',
  styleUrl: './trigonometric-series.component.scss'
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
  latexRendered: { a0: SafeHtml, an: SafeHtml, bn: SafeHtml } | null = null;
  
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

    this.apiService.calculateTrigonometricSeries({
      funcion: this.function,
      periodo: this.period,
      intVar: this.variable
    }).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        this.processLatexResults(data.latex);
        this.formulasNeedRendering = true;
      },
      error: (err) => {
        this.error = err.message || 'Error al calcular la serie trigonométrica';
        this.loading = false;
        console.error('API Error:', err);
      }
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
      )
    };
  }
}