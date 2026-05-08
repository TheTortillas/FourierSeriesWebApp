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

  // Segmentos de la función a trozos (siempre al menos 1)
  segments: Segment[] = [
    { expression: 'x', from: '-%pi', to: '0' },
    { expression: '1', from: '0',    to: '%pi' },
  ];

  intVar   = 'x';
  seriesType: 'trigonometric' | 'complex' | 'halfRange' = 'trigonometric';
  nTerms   = 5;

  response  = signal<unknown>(null);
  error     = signal<string | null>(null);
  loading   = signal(false);

  addSegment(): void {
    this.segments = [...this.segments, { expression: '', from: '', to: '' }];
  }

  removeSegment(index: number): void {
    if (this.segments.length > 1) {
      this.segments = this.segments.filter((_, i) => i !== index);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private buildRequest(): FourierSeriesRequest {
    return { segments: this.segments, seriesType: this.seriesType, intVar: this.intVar };
  }

  private call<T>(obs: () => import('rxjs').Observable<T>): void {
    this.loading.set(true);
    this.response.set(null);
    this.error.set(null);
    obs().subscribe({
      next:  (res) => { this.response.set(res); this.loading.set(false); },
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
    const body = { input: this.buildRequest(), nTerms: this.nTerms };
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
