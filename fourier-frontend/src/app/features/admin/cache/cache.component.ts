import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../../../core/services/api/api.service';
import { CacheStats } from '../../../domain';

@Component({
  selector: 'app-cache',
  templateUrl: './cache.component.html',
})
export class CacheComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading   = signal(true);
  readonly error     = signal(false);
  readonly stats     = signal<CacheStats | null>(null);
  readonly clearing  = signal(false);
  readonly cleared   = signal(false);
  readonly confirmOpen = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.getCacheStats().subscribe({
      next: (data) => { this.stats.set(data); this.loading.set(false); },
      error: ()     => { this.error.set(true);  this.loading.set(false); },
    });
  }

  openConfirm(): void  { this.confirmOpen.set(true); }
  cancelConfirm(): void { this.confirmOpen.set(false); }

  confirmClear(): void {
    this.confirmOpen.set(false);
    this.clearing.set(true);
    this.api.clearCache().subscribe({
      next: () => {
        this.clearing.set(false);
        this.cleared.set(true);
        this.load();
        setTimeout(() => this.cleared.set(false), 3000);
      },
      error: () => { this.clearing.set(false); },
    });
  }

  fillPct(stats: CacheStats): number {
    if (stats.max <= 0) return 0;
    return Math.min(100, Math.round((stats.size / stats.max) * 100));
  }

  fillBarClass(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-accent';
  }
}
