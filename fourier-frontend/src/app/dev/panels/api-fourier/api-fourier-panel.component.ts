import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api/api.service';
import { Segment, FourierSeriesRequest } from '../../../domain';

@Component({
  selector: 'app-api-fourier-panel',
  imports: [FormsModule],
  templateUrl: './api-fourier-panel.component.html',
})
export class ApiFourierPanelComponent {
  private readonly api = inject(ApiService);

  // Formulario
  expr     = 'x';
  from     = '-%pi';
  to       = '%pi';
  intVar   = 'x';
  seriesType: 'trigonometric' | 'complex' | 'halfRange' = 'trigonometric';
  nTerms   = 5;

  response  = signal<unknown>(null);
  error     = signal<string | null>(null);
  loading   = signal(false);

  private buildRequest(): FourierSeriesRequest {
    const segment: Segment = {
      expression: this.expr,
      from: this.from,
      to: this.to,
    };
    return { segments: [segment], seriesType: this.seriesType, intVar: this.intVar };
  }

  private call<T>(obs: () => import('rxjs').Observable<T>): void {
    this.loading.set(true);
    this.response.set(null);
    this.error.set(null);
    obs().subscribe({
      next: (res) => { this.response.set(res); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.error ?? err.message); this.loading.set(false); },
    });
  }

  calculate(): void {
    const req = this.buildRequest();
    if (this.seriesType === 'trigonometric') {
      this.call(() => this.api.calculateTrigonometric(req));
    } else if (this.seriesType === 'complex') {
      this.call(() => this.api.calculateComplex(req));
    } else {
      this.call(() => this.api.calculateHalfRange(req));
    }
  }

  calculateTerms(): void {
    const req = this.buildRequest();
    const body = { input: req, nTerms: this.nTerms };
    if (this.seriesType === 'trigonometric') {
      this.call(() => this.api.calculateTrigonometricTerms(body));
    } else if (this.seriesType === 'complex') {
      this.call(() => this.api.calculateComplexTerms(body));
    } else {
      this.call(() => this.api.calculateHalfRangeTerms(body));
    }
  }

  json(val: unknown): string {
    return JSON.stringify(val, null, 2);
  }
}
