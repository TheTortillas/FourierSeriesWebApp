import { Component, inject, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { RateLimitMetricsSnapshot, RateLimitBlockedEvent, RateLimitHistoryResponse } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

const LIMITER_OPTIONS = ['general', 'compute', 'parse_burst', 'parse_sustained', 'auth', 'auth_signin', 'auth_recovery'];
const HISTORY_PAGE_SIZE = 20;

@Component({
  selector: 'app-rate-limit',
  templateUrl: './rate-limit.component.html',
  standalone: true,
  imports: [NgClass, FormsModule, AdminDatePipe],
})
export class RateLimitComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading      = signal(true);
  readonly loadError    = signal(false);
  readonly metrics      = signal<RateLimitMetricsSnapshot | null>(null);

  readonly histLoading  = signal(false);
  readonly histError    = signal(false);
  readonly history      = signal<RateLimitBlockedEvent[]>([]);
  readonly histTotal    = signal(0);
  readonly histOffset   = signal(0);
  readonly histPageSize = HISTORY_PAGE_SIZE;

  filterIp     = '';
  filterLimiter= '';

  readonly LIMITER_OPTIONS = LIMITER_OPTIONS;

  readonly histTotalPages  = () => Math.ceil(this.histTotal() / this.histPageSize);
  readonly histCurrentPage = () => Math.floor(this.histOffset() / this.histPageSize) + 1;

  ngOnInit(): void {
    this.refresh();
    this.loadHistory();
  }

  refresh(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.getRateLimitMetrics().subscribe({
      next: (m) => { this.metrics.set(m); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  loadHistory(): void {
    this.histLoading.set(true);
    this.histError.set(false);
    this.api.getRateLimitHistory({
      limit:   this.histPageSize,
      offset:  this.histOffset(),
      ip:      this.filterIp.trim()      || undefined,
      limiter: this.filterLimiter        || undefined,
    }).subscribe({
      next: (r: RateLimitHistoryResponse) => {
        this.history.set(r.entries);
        this.histTotal.set(r.total);
        this.histLoading.set(false);
      },
      error: () => { this.histError.set(true); this.histLoading.set(false); },
    });
  }

  applyHistFilters(): void { this.histOffset.set(0); this.loadHistory(); }
  clearHistFilters(): void { this.filterIp = ''; this.filterLimiter = ''; this.applyHistFilters(); }
  prevHistPage(): void { this.histOffset.set(Math.max(0, this.histOffset() - this.histPageSize)); this.loadHistory(); }
  nextHistPage(): void { this.histOffset.set(this.histOffset() + this.histPageSize); this.loadHistory(); }

  filterByIp(ip: string): void { this.filterIp = ip; this.applyHistFilters(); }

  topEntries(source: Record<string, number>, limit = 6): Array<{ key: string; value: number }> {
    return Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => ({ key, value }));
  }

  bucketLabel(b: string): string {
    const map: Record<string, string> = {
      compute: 'cómputo', parse: 'parse', auth: 'auth/general',
    };
    return map[b] ?? b;
  }

  limiterBadgeClass(limiter: string): string {
    const map: Record<string, string> = {
      general:        'bg-slate-100  dark:bg-slate-800/40  text-slate-600  dark:text-slate-400  border-slate-200  dark:border-slate-700',
      compute:        'bg-blue-50    dark:bg-blue-950/30   text-blue-700   dark:text-blue-400   border-blue-200   dark:border-blue-800',
      parse_burst:    'bg-violet-50  dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
      parse_sustained:'bg-indigo-50  dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      auth:           'bg-teal-50    dark:bg-teal-950/30   text-teal-700   dark:text-teal-400   border-teal-200   dark:border-teal-800',
      auth_signin:    'bg-amber-50   dark:bg-amber-950/30  text-amber-700  dark:text-amber-400  border-amber-200  dark:border-amber-800',
      auth_recovery:  'bg-orange-50  dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    return map[limiter] ?? 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
  }
}
