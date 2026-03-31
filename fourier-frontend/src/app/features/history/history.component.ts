import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/services/api/api.service';
import { HistoryEntry } from '../../domain';
import { NavComponent } from '../../shared/components/nav/nav.component';

const PAGE_SIZE = 15;

const TYPE_LABEL: Record<string, string> = {
  trigonometric:             'Trigonométrica',
  half_range:                'Medio rango',
  complex:                   'Compleja',
  fourier_transform:         'Transformada',
  inverse_fourier_transform: 'T. Inversa',
  dft_signal:                'DFT señal',
  dft_epicycles:             'DFT epiciclos',
};

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  imports: [NavComponent, FormsModule],
})
export class HistoryComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly router = inject(Router);

  readonly loading      = signal(false);
  readonly entries      = signal<HistoryEntry[]>([]);
  readonly total        = signal(0);
  readonly offset       = signal(0);
  readonly pageSize     = PAGE_SIZE;
  readonly isLimited    = signal(false);
  readonly historyLimit = signal<{ max: number; favorites: number } | null>(null);

  // Filters
  showFavoritesOnly = false;

  // Rename dialog
  readonly renamingId   = signal<string | null>(null);
  renameValue = '';

  // Expanded input rows
  readonly expandedIds = signal<Set<string>>(new Set());

  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  readonly typeLabel = (t: string) => TYPE_LABEL[t] ?? t;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getHistory({
      limit: this.pageSize,
      offset: this.offset(),
      ...(this.showFavoritesOnly ? { favorites: true } : {}),
    }).subscribe({
      next: (res) => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.isLimited.set(res.isLimited ?? false);
        this.historyLimit.set(res.historyLimit ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFilter(): void { this.offset.set(0); this.load(); }
  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  // ── Favorites ────────────────────────────────────────────────────────────

  toggleFavorite(entry: HistoryEntry, event: Event): void {
    event.stopPropagation();
    if (entry.isFavorite) {
      // Unmark — no name needed
      this.api.toggleFavorite(entry.id).subscribe({
        next: (updated) => this.patchEntry(updated),
      });
    } else {
      // Mark — open inline rename dialog
      this.renamingId.set(entry.id);
      this.renameValue = '';
    }
  }

  confirmFavorite(entry: HistoryEntry): void {
    this.api.toggleFavorite(entry.id, this.renameValue.trim() || undefined).subscribe({
      next: (updated) => { this.patchEntry(updated); this.renamingId.set(null); },
    });
  }

  cancelRename(): void { this.renamingId.set(null); }

  // ── Delete ───────────────────────────────────────────────────────────────

  deleteEntry(id: string, event: Event): void {
    event.stopPropagation();
    this.api.deleteHistoryEntry(id).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e.id !== id));
        this.total.update((t) => t - 1);
      },
    });
  }

  // ── Reopen in calculator ─────────────────────────────────────────────────

  reopenInCalculator(entry: HistoryEntry): void {
    const inp = entry.input;
    if (!inp?.['segments']) return;

    const transformTypes = ['fourier_transform', 'inverse_fourier_transform'];
    if (transformTypes.includes(entry.type)) {
      this.router.navigate(['/transforms'], {
        state: { restoreInput: { ...inp, type: entry.type } },
      });
    } else {
      this.router.navigate(['/calculator'], { state: { restoreInput: inp } });
    }
  }

  // ── Expand input ─────────────────────────────────────────────────────────

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    this.expandedIds.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean { return this.expandedIds().has(id); }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private patchEntry(updated: HistoryEntry): void {
    this.entries.update((list) => list.map((e) => e.id === updated.id ? updated : e));
  }

  inputPreview(entry: HistoryEntry): string {
    const inp = entry.input;
    if (!inp) return '—';
    const segments = inp['segments'] as Array<{ expression?: string; from?: string; to?: string }> | undefined;
    if (segments?.length) {
      const first = segments[0];
      const range = first.from !== undefined ? ` [${first.from}, ${first.to}]` : '';
      const more  = segments.length > 1 ? ` +${segments.length - 1} tramo${segments.length > 2 ? 's' : ''}` : '';
      const n     = inp['harmonics'] !== undefined ? `, n=${inp['harmonics']}` : '';
      return `${first.expression ?? '?'}${range}${more}${n}`;
    }
    const expr = inp['expression'] as string | undefined;
    if (expr) return expr;
    const points = inp['points'] as unknown[] | undefined;
    if (points) return `${points.length} puntos`;
    return JSON.stringify(inp).slice(0, 80);
  }

  inputJson(entry: HistoryEntry): string {
    return JSON.stringify(entry.input, null, 2);
  }

  hasSegments(entry: HistoryEntry): boolean {
    return !!(entry.input?.['segments']);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
