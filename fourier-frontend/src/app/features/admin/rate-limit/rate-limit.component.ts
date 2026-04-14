import { Component, inject, OnInit, signal } from '@angular/core';

import { ApiService } from '../../../core/services/api/api.service';
import { RateLimitMetricsSnapshot } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

@Component({
  selector: 'app-rate-limit',
  templateUrl: './rate-limit.component.html',
  standalone: true,
  imports: [AdminDatePipe],
})
export class RateLimitComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly metrics = signal<RateLimitMetricsSnapshot | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.api.getRateLimitMetrics().subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  topEntries(source: Record<string, number>, limit = 6): Array<{ key: string; value: number }> {
    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => ({ key, value }));
  }
}
