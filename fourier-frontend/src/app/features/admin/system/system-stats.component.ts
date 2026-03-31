import { Component, inject, OnInit, signal } from '@angular/core';

import { ApiService } from '../../../core/services/api/api.service';
import { SystemStats } from '../../../domain';

@Component({
  selector: 'app-system-stats',
  templateUrl: './system-stats.component.html',
})
export class SystemStatsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly error   = signal(false);
  readonly stats   = signal<SystemStats | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.getSystemStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  diskBarClass(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-accent3';
  }
}
