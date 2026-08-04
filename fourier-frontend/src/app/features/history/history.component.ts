import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../core/services/api/api.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { HistoryEntry, CALC_TYPE_LABEL } from '../../domain';
import { NavComponent } from '../../shared/components/nav/nav.component';

const PAGE_SIZE = 15;

const TYPE_KEY: Record<string, string> = {
  trigonometric: 'history.types.trigonometric',
  half_range: 'history.types.halfRange',
  complex: 'history.types.complex',
  fourier_transform: 'history.types.fourierTransform',
  inverse_fourier_transform: 'history.types.inverseFourierTransform',
  dft_signal: 'history.types.dftSignal',
  dft_epicycles: 'history.types.dftEpicycles',
  fourier_integral: 'history.types.fourierIntegral',
  laplace_direct:  'history.types.laplaceDirect',
  laplace_inverse: 'history.types.laplaceInverse',
  laplace_ode:     'history.types.laplaceOde',
  ode_general:     'history.types.odeGeneral',
  ode_ivp:         'history.types.odeIvp',
  ode_bvp:         'history.types.odeBvp',
};

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  imports: [NavComponent, FormsModule, TranslocoPipe],
})
export class HistoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  readonly loading = signal(false);
  readonly entries = signal<HistoryEntry[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly pageSize = PAGE_SIZE;
  readonly isLimited = signal(false);
  readonly historyLimit = signal<{ max: number; favorites: number } | null>(null);

  // Filters
  showFavoritesOnly = false;
  activeTypeFilter  = '';

  // Rename dialog
  readonly renamingId = signal<string | null>(null);
  renameValue = '';

  // Expanded input rows
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly rawJsonIds = signal<Set<string>>(new Set());

  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  readonly CALC_TYPES = Object.keys(CALC_TYPE_LABEL);
  readonly typeLabel  = (t: string) => CALC_TYPE_LABEL[t] ?? t;
  readonly typeKey = (t: string) => TYPE_KEY[t] ?? t;
  readonly typeLabelI18n = (t: string) => {
    const key = TYPE_KEY[t];
    return key ? this.transloco.translate(key) : (CALC_TYPE_LABEL[t] ?? t);
  };

  entryTypeKey(entry: HistoryEntry): string {
    if (entry.type === 'dft_signal' && Array.isArray(entry.input?.['segments'])) {
      return 'history.types.dftFunction';
    }
    return TYPE_KEY[entry.type] ?? entry.type;
  }

  entryBadgeClass(entry: HistoryEntry): string {
    if (entry.type === 'dft_signal' && Array.isArray(entry.input?.['segments'])) {
      return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
    }
    return this.typeBadgeClass(entry.type);
  }

  ngOnInit(): void {
    this.seo.setNoIndex();
    const favParam = this.route.snapshot.queryParamMap.get('favorites');
    if (favParam === 'true' || favParam === '1') {
      this.showFavoritesOnly = true;
    }
    this.load();
  }

  setTypeFilter(type: string): void {
    this.activeTypeFilter = type;
    this.offset.set(0);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getHistory({
        limit: this.pageSize,
        offset: this.offset(),
        ...(this.showFavoritesOnly ? { favorites: true } : {}),
        ...(this.activeTypeFilter ? { type: this.activeTypeFilter } : {}),
      })
      .subscribe({
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

  toggleFilter(): void {
    this.offset.set(0);
    this.load();
  }
  prevPage(): void {
    this.offset.set(Math.max(0, this.offset() - this.pageSize));
    this.load();
  }
  nextPage(): void {
    this.offset.set(this.offset() + this.pageSize);
    this.load();
  }

  // ── Favorites ────────────────────────────────────────────────────────────

  toggleFavorite(entry: HistoryEntry, event: Event): void {
    event.stopPropagation();
    if (entry.isFavorite) {
      this.api.toggleFavorite(entry.id).subscribe({
        next: (updated) => this.patchEntry(updated),
      });
    } else {
      this.renamingId.set(entry.id);
      this.renameValue = '';
    }
  }

  startRenameFavorite(entry: HistoryEntry, event: Event): void {
    event.stopPropagation();
    this.renamingId.set(entry.id);
    this.renameValue = entry.favoriteName ?? '';
  }

  confirmFavorite(entry: HistoryEntry): void {
    const name = this.renameValue.trim() || undefined;
    if (entry.isFavorite) {
      // Already a favorite — just update the name via a PATCH that keeps isFavorite=true
      this.api.renameFavorite(entry.id, name).subscribe({
        next: (updated) => {
          this.patchEntry(updated);
          this.renamingId.set(null);
        },
      });
    } else {
      this.api.toggleFavorite(entry.id, name).subscribe({
        next: (updated) => {
          this.patchEntry(updated);
          this.renamingId.set(null);
        },
      });
    }
  }

  cancelRename(): void {
    this.renamingId.set(null);
  }

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
    const lang = this.transloco.getActiveLang();

    if (entry.type === 'dft_signal' || entry.type === 'dft_epicycles') {
      // Build the same encoded state the DFT component uses for its URL param
      const encoded = this._encodeDftState(entry);
      if (encoded) {
        this.router.navigate(['/' + lang + '/transforms/dft'], { queryParams: { s: encoded } });
      }
      return;
    }

    if (entry.type === 'laplace_direct' || entry.type === 'laplace_inverse') {
      const encoded = this._encodeLaplaceState(entry);
      if (encoded) {
        this.router.navigate(['/' + lang + '/laplace'], { queryParams: { s: encoded } });
      }
      return;
    }

    if (entry.type === 'laplace_ode') {
      const encoded = this._encodeLaplaceOdeForOdeComponent(entry);
      if (encoded) {
        this.router.navigate(['/' + lang + '/ode'], { queryParams: { s: encoded } });
      }
      return;
    }

    if (entry.type === 'ode_general' || entry.type === 'ode_ivp' || entry.type === 'ode_bvp') {
      const encoded = this._encodeOdeState(entry);
      if (encoded) {
        this.router.navigate(['/' + lang + '/ode'], { queryParams: { s: encoded } });
      }
      return;
    }

    if (!inp?.['segments']) return;

    const transformTypes = ['fourier_transform', 'inverse_fourier_transform'];
    if (transformTypes.includes(entry.type)) {
      this.router.navigate(['/' + lang + '/transforms/continuous'], {
        state: { restoreInput: { ...inp, type: entry.type } },
      });
    } else if (entry.type === 'fourier_integral') {
      this.router.navigate(['/' + lang + '/fourier-integral'], {
        state: { restoreInput: inp },
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
        // Points with mode=epicycles — use full precision to preserve SHA-256 dedup hash
        const pts = inp['points'] as Array<{ x: number; y: number }> | undefined;
        state = {
          mode: 'epicycles',
          pts: pts?.map((p) => `${p.x}, ${p.y}`).join('\n') ?? '',
        };
      } else if (Array.isArray(inp['segments'])) {
        // dft_signal saved from function mode — has segments
        state = {
          mode: 'function',
          alg: 'fft',
          v: (inp['intVar'] as string | undefined) ?? 'x',
          N: (inp['N'] as number | undefined) ?? 128,
          seg: (inp['segments'] as Array<{ expression: string; from: string; to: string; expressionTex?: string; fromTex?: string; toTex?: string }>)
            .map((s) => ({ e: s.expression, et: s.expressionTex ?? s.expression, f: s.from, ft: s.fromTex ?? s.from, t: s.to, tt: s.toTex ?? s.to })),
        };
      } else {
        // dft_signal with points — manual/discrete mode
        const pts = inp['points'] as Array<{ x: number; y: number }> | undefined;
        state = {
          mode: 'manual',
          mr: pts?.map((p) => p.y.toFixed(4)).join(', ') ?? '',
          mN: pts?.length ?? 8,
        };
      }
      const json = JSON.stringify(state);
      return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
    } catch { return ''; }
  }

  private _encodeLaplaceState(entry: HistoryEntry): string {
    const inp = entry.input;
    try {
      let state: Record<string, unknown>;
      if (entry.type === 'laplace_direct') {
        const segs = inp['segments'] as Array<{
          expression: string; expressionTex?: string;
          from: string; fromTex?: string;
          to: string; toTex?: string;
        }> | undefined;
        state = {
          m: 'direct',
          vp: inp['timeVar'] && inp['freqVar'] ? `${inp['timeVar']}-${inp['freqVar']}` : 't-s',
          seg: (segs ?? []).map(s => ({
            e: s.expression, et: s.expressionTex ?? s.expression,
            f: s.from, ft: s.fromTex ?? s.from,
            t: s.to,   tt: s.toTex ?? s.to,
          })),
        };
      } else if (entry.type === 'laplace_inverse') {
        state = {
          m: 'inverse',
          vp: inp['timeVar'] && inp['freqVar'] ? `${inp['timeVar']}-${inp['freqVar']}` : 't-s',
          expr: inp['expression'] as string ?? '',
          exprTex: inp['expressionTex'] as string ?? '',
        };
      } else {
        // Derive fnName from unknown field "y(t)" → "y"
        const unk = inp['unknown'] as string ?? 'y(t)';
        const fnName = unk.replace(/\(.*\)$/, '') || 'y';
        state = {
          m: 'ode',
          vp: inp['timeVar'] ? `${inp['timeVar']}-s` : 't-s',
          eq:     inp['equation'] as string ?? '',
          eqTex:  inp['equationTex'] as string ?? '',
          fnName,
          ics: inp['initialConditions'] ?? [],
        };
      }
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch { return ''; }
  }

  // ── Expand input ─────────────────────────────────────────────────────────

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    this.expandedIds.update((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
        // Reset raw-json mode when collapsing an entry.
        this.rawJsonIds.update((r) => {
          const rn = new Set(r);
          rn.delete(id);
          return rn;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleRawJson(id: string, event: Event): void {
    event.stopPropagation();
    this.rawJsonIds.update((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isRawJson(id: string): boolean {
    return this.rawJsonIds().has(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private patchEntry(updated: HistoryEntry): void {
    this.entries.update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
  }

  inputPreview(entry: HistoryEntry): string {
    const inp = entry.input;
    if (!inp) return '—';
    const segments = inp['segments'] as
      | Array<{ expression?: string; from?: string; to?: string }>
      | undefined;
    if (segments?.length) {
      const first = segments[0];
      const range = first.from !== undefined ? ` [${first.from}, ${first.to}]` : '';
      const count = segments.length - 1;
      const more =
        count > 0
          ? ` +${count} ${this.transloco.translate(count === 1 ? 'history.segment' : 'history.segments')}`
          : '';
      const n = inp['harmonics'] !== undefined ? `, n=${inp['harmonics']}` : '';
      return `${first.expression ?? '?'}${range}${more}${n}`;
    }
    const expr = inp['expression'] as string | undefined;
    if (expr) return expr;
    const equation = inp['equation'] as string | undefined;
    if (equation) return equation;
    const points = inp['points'] as unknown[] | undefined;
    if (points) return `${points.length} ${this.transloco.translate('history.points')}`;
    return JSON.stringify(inp).slice(0, 80);
  }

  inputJson(entry: HistoryEntry): string {
    return JSON.stringify(entry.input, null, 2);
  }

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
      mode: entry.input['mode'] as string | undefined,
      count: points.length,
      preview,
      remaining: points.length - preview.length,
    };
  }

  canReopen(entry: HistoryEntry): boolean {
    if (entry.type === 'laplace_direct' || entry.type === 'laplace_inverse' || entry.type === 'laplace_ode') return true;
    if (entry.type === 'ode_general' || entry.type === 'ode_ivp' || entry.type === 'ode_bvp') return true;
    if (entry.type === 'fourier_integral') return true;
    if (entry.type === 'dft_signal' || entry.type === 'dft_epicycles') {
      return Array.isArray(entry.input?.['points']) || Array.isArray(entry.input?.['segments']);
    }
    return Array.isArray(entry.input?.['segments']);
  }

  hasSegments(entry: HistoryEntry): boolean {
    return this.canReopen(entry);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(this.transloco.getActiveLang(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  typeBadgeClass(type: string): string {
    const map: Record<string, string> = {
      trigonometric:
        'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      half_range:
        'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      complex:
        'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
      fourier_transform:
        'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
      inverse_fourier_transform:
        'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
      dft_signal:
        'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      dft_epicycles:
        'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      fourier_integral:
        'bg-lime-50 dark:bg-lime-950/30 text-lime-700 dark:text-lime-400 border-lime-200 dark:border-lime-800',
      laplace_direct:
        'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      laplace_inverse:
        'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      laplace_ode:
        'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      ode_general:
        'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      ode_ivp:
        'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      ode_bvp:
        'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    };
    return (
      map[type] ??
      'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border'
    );
  }

  private _encodeLaplaceOdeForOdeComponent(entry: HistoryEntry): string {
    const inp = entry.input;
    try {
      const unk = (inp['unknown'] as string) ?? 'y(t)';
      const fnName = unk.replace(/\(.*\)$/, '') || 'y';
      const timeVar = (inp['timeVar'] as string) ?? 't';
      const rawIcs = inp['initialConditions'] as Array<{ order: number; value: string | number }> ?? [];
      const ics = rawIcs.map((ic) => ({
        order:    ic.order,
        value:    String(ic.value),
        valueTex: String(ic.value),
      }));
      const state: Record<string, unknown> = {
        mode:  'laplace',
        ivar:  timeVar,
        fn:    fnName,
        eq:    (inp['equation']    as string) ?? '',
        eqTex: (inp['equationTex'] as string) ?? '',
        ics,
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch { return ''; }
  }

  private _encodeOdeState(entry: HistoryEntry): string {
    const inp = entry.input;
    try {
      const mode = entry.type === 'ode_ivp' ? 'ivp' : entry.type === 'ode_bvp' ? 'bvp' : 'general';
      const state: Record<string, unknown> = {
        mode,
        ivar:  (inp['ivar']  as string) ?? 'x',
        fn:    (inp['unknown'] as string) ?? 'y',
        eq:    (inp['equation'] as string) ?? '',
        eqTex: (inp['equationTex'] as string) ?? '',
        x0:    (inp['x0']    as string) ?? '0',
        x0Tex: (inp['x0Tex'] as string) ?? (inp['x0'] as string) ?? '0',
        ics: mode === 'ivp' ? [
          { value: (inp['y0']   as string) ?? '0', valueTex: (inp['y0Tex']  as string) ?? (inp['y0']  as string) ?? '0' },
          { value: (inp['dy0']  as string) ?? '0', valueTex: (inp['dy0Tex'] as string) ?? (inp['dy0'] as string) ?? '0' },
        ] : [],
        bvp: mode === 'bvp' ? [
          { x: (inp['x1'] as string) ?? '0', xTex: (inp['x1Tex'] as string) ?? (inp['x1'] as string) ?? '0', value: (inp['y1'] as string) ?? '0', valueTex: (inp['y1Tex'] as string) ?? (inp['y1'] as string) ?? '0' },
          { x: (inp['x2'] as string) ?? '1', xTex: (inp['x2Tex'] as string) ?? (inp['x2'] as string) ?? '1', value: (inp['y2'] as string) ?? '0', valueTex: (inp['y2Tex'] as string) ?? (inp['y2'] as string) ?? '0' },
        ] : [],
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch { return ''; }
  }
}
