import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { HistoryEntry, CALC_TYPE_LABEL } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

const PAGE_SIZE = 20;

const CALC_TYPES = Object.keys(CALC_TYPE_LABEL);

@Component({
  selector: 'app-admin-history',
  templateUrl: './admin-history.component.html',
  imports: [FormsModule, AdminDatePipe],
})
export class AdminHistoryComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading  = signal(false);
  readonly entries  = signal<HistoryEntry[]>([]);
  readonly total    = signal(0);
  readonly offset   = signal(0);
  readonly pageSize = PAGE_SIZE;

  filterType   = '';
  filterUserId = '';

  readonly CALC_TYPES  = CALC_TYPES;
  readonly typeLabel   = (t: string) => CALC_TYPE_LABEL[t] ?? t;
  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const query: Record<string, unknown> = { limit: this.pageSize, offset: this.offset() };
    if (this.filterType)   query['type']   = this.filterType;
    if (this.filterUserId) query['userId'] = this.filterUserId.trim();

    this.api.getAdminHistory(query as never).subscribe({
      next: (res) => { this.entries.set(res.entries); this.total.set(res.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.offset.set(0); this.load(); }
  clearFilters(): void { this.filterType = ''; this.filterUserId = ''; this.applyFilters(); }
  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  filterByUser(userId: string): void {
    this.filterUserId = userId;
    this.applyFilters();
  }

  readonly expandedIds = signal<Set<string>>(new Set());

  toggleExpand(id: string): void {
    this.expandedIds.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  inputPreview(entry: HistoryEntry): string {
    const inp = entry.input;
    if (!inp) return '—';

    const segments = inp['segments'] as Array<{ expression?: string; from?: string; to?: string }> | undefined;
    if (segments?.length) {
      const first = segments[0];
      const expr  = first.expression ?? '?';
      const range = (first.from !== undefined && first.to !== undefined)
        ? ` [${first.from}, ${first.to}]` : '';
      const more  = segments.length > 1 ? ` +${segments.length - 1} tramo${segments.length > 2 ? 's' : ''}` : '';
      const n     = inp['harmonics'] !== undefined ? `, n=${inp['harmonics']}` : '';
      return `${expr}${range}${more}${n}`;
    }

    const expr = inp['expression'] as string | undefined;
    if (expr) return expr;

    const points = inp['points'] as unknown[] | undefined;
    if (points) return `${points.length} puntos`;

    return JSON.stringify(inp).slice(0, 60);
  }

  inputJson(entry: HistoryEntry): string {
    return JSON.stringify(entry.input, null, 2);
  }

  typeBadgeClass(type: string): string {
    const map: Record<string, string> = {
      trigonometric:             'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      half_range:                'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      complex:                   'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
      fourier_transform:         'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
      inverse_fourier_transform: 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
      dft_signal:                'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      dft_epicycles:             'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    return map[type] ?? 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
  }
}
