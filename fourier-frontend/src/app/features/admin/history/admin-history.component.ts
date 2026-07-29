import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../core/services/api/api.service';
import { HistoryEntry, CALC_TYPE_LABEL, AdminHistoryQuery } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

const PAGE_SIZE = 20;

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const CALC_TYPES = Object.keys(CALC_TYPE_LABEL);

@Component({
  selector: 'app-admin-history',
  templateUrl: './admin-history.component.html',
  imports: [NgClass, FormsModule, AdminDatePipe],
})
export class AdminHistoryComponent implements OnInit {
  private readonly api      = inject(ApiService);
  private readonly router   = inject(Router);
  private readonly transloco = inject(TranslocoService);

  readonly loading  = signal(false);
  readonly entries  = signal<HistoryEntry[]>([]);
  readonly total    = signal(0);
  readonly offset   = signal(0);
  readonly pageSize = PAGE_SIZE;

  // Filters
  filterType         = '';
  filterUserId       = '';
  filterIp           = '';
  filterDateFrom     = '';
  filterDateTo       = '';
  filterFavorites    = false;
  filterAnonymous    = false;
  filterMinExecMs    = '';

  readonly CALC_TYPES  = CALC_TYPES;
  readonly typeLabel   = (t: string) => CALC_TYPE_LABEL[t] ?? t;

  readonly quickPeriods = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }];

  setQuickPeriod(days: number): void {
    this.filterDateFrom = dateNDaysAgo(days);
    this.filterDateTo   = '';
    this.applyFilters();
  }

  clearDateFilters(): void {
    this.filterDateFrom = '';
    this.filterDateTo   = '';
    this.applyFilters();
  }

  activeQuickDays(): number | null {
    if (!this.filterDateFrom || this.filterDateTo) return null;
    for (const p of this.quickPeriods) {
      if (this.filterDateFrom === dateNDaysAgo(p.days)) return p.days;
    }
    return null;
  }
  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);
  readonly hasFilters  = computed(() =>
    !!(this.filterType || this.filterUserId || this.filterIp || this.filterDateFrom ||
       this.filterDateTo || this.filterFavorites || this.filterAnonymous || this.filterMinExecMs)
  );

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const query: AdminHistoryQuery = { limit: this.pageSize, offset: this.offset() };
    if (this.filterType)      query.type          = this.filterType;
    if (this.filterUserId)    query.userId        = this.filterUserId.trim();
    if (this.filterIp)        query.ip            = this.filterIp.trim();
    if (this.filterDateFrom)  query.dateFrom      = this.filterDateFrom;
    if (this.filterDateTo)    query.dateTo        = this.filterDateTo;
    if (this.filterFavorites) query.favoritesOnly = true;
    if (this.filterAnonymous) query.anonymousOnly = true;
    if (this.filterMinExecMs) query.minExecutionMs = parseInt(this.filterMinExecMs);

    this.api.getAdminHistory(query).subscribe({
      next: (res) => { this.entries.set(res.entries); this.total.set(res.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.offset.set(0); this.load(); }

  clearFilters(): void {
    this.filterType      = '';
    this.filterUserId    = '';
    this.filterIp        = '';
    this.filterDateFrom  = '';
    this.filterDateTo    = '';
    this.filterFavorites = false;
    this.filterAnonymous = false;
    this.filterMinExecMs = '';
    this.applyFilters();
  }

  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  filterByUser(userId: string): void {
    this.filterUserId = userId;
    this.applyFilters();
  }

  readonly expandedIds  = signal<Set<string>>(new Set());
  readonly rawJsonIds   = signal<Set<string>>(new Set());

  toggleExpand(id: string): void {
    this.expandedIds.update((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
        // Resetear vista JSON al colapsar
        this.rawJsonIds.update((r) => { const rn = new Set(r); rn.delete(id); return rn; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  toggleRawJson(id: string, event: Event): void {
    event.stopPropagation();
    this.rawJsonIds.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean { return this.expandedIds().has(id); }
  isRawJson(id: string):  boolean { return this.rawJsonIds().has(id); }

  hasDftPoints(entry: HistoryEntry): boolean {
    const pts = entry.input?.['points'];
    return Array.isArray(pts) && (pts as unknown[]).length > 0;
  }

  dftMeta(entry: HistoryEntry): {
    mode: string | undefined;
    count: number;
    preview: Array<{ x: number; y: number }>;
    remaining: number;
  } {
    const points = entry.input['points'] as Array<{ x: number; y: number }>;
    const preview = points.slice(0, 6);
    return {
      mode:      entry.input['mode'] as string | undefined,
      count:     points.length,
      preview,
      remaining: points.length - preview.length,
    };
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

  // ── Abrir cálculo en la calculadora ──────────────────────────────────────
  // Reutiliza exactamente la misma lógica que el historial de usuario.

  openInCalculator(entry: HistoryEntry, event: Event): void {
    event.stopPropagation();
    const inp  = entry.input;
    const lang = this.transloco.getActiveLang();

    if (entry.type === 'dft_signal' || entry.type === 'dft_epicycles') {
      const encoded = this._encodeDftState(entry);
      if (encoded) {
        this.router.navigate(['/' + lang + '/transforms/dft'], { queryParams: { s: encoded } });
      }
      return;
    }

    const transformTypes = ['fourier_transform', 'inverse_fourier_transform'];
    if (transformTypes.includes(entry.type)) {
      this.router.navigate(['/' + lang + '/transforms/continuous'], {
        state: { restoreInput: { ...inp, type: entry.type } },
      });
    } else {
      this.router.navigate(['/' + lang + '/calculator'], { state: { restoreInput: inp } });
    }
  }

  private _encodeDftState(entry: HistoryEntry): string {
    const inp = entry.input;
    try {
      let state: Record<string, unknown>;
      if (entry.type === 'dft_epicycles') {
        const pts = inp['points'] as Array<{ x: number; y: number }> | undefined;
        state = { mode: 'epicycles', pts: pts?.map((p) => `${p.x}, ${p.y}`).join('\n') ?? '' };
      } else if (Array.isArray(inp['segments'])) {
        state = {
          mode: 'function', alg: 'fft',
          v: (inp['intVar'] as string | undefined) ?? 'x',
          N: (inp['N'] as number | undefined) ?? 128,
          seg: (inp['segments'] as Array<{ expression: string; from: string; to: string }>)
            .map((s) => ({ e: s.expression, et: s.expression, f: s.from, ft: s.from, t: s.to, tt: s.to })),
        };
      } else {
        const pts = inp['points'] as Array<{ x: number; y: number }> | undefined;
        state = { mode: 'manual', mr: pts?.map((p) => p.y.toFixed(4)).join(', ') ?? '', mN: pts?.length ?? 8 };
      }
      const json = JSON.stringify(state);
      return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
    } catch { return ''; }
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
      fourier_integral:          'bg-lime-50 dark:bg-lime-950/30 text-lime-700 dark:text-lime-400 border-lime-200 dark:border-lime-800',
    };
    return map[type] ?? 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
  }
}
