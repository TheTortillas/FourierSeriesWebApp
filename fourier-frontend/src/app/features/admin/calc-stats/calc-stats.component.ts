import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../core/services/api/api.service';
import { CalcStats, CALC_TYPE_LABEL } from '../../../domain';

Chart.register(...registerables);

// ── Color tokens ──────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { bg: string; border: string }> = {
  trigonometric:             { bg: 'rgba(59,130,246,0.75)',  border: 'rgb(59,130,246)' },
  half_range:                { bg: 'rgba(99,170,255,0.75)',  border: 'rgb(99,170,255)' },
  complex:                   { bg: 'rgba(147,197,253,0.75)', border: 'rgb(147,197,253)' },
  fourier_transform:         { bg: 'rgba(16,185,129,0.75)',  border: 'rgb(16,185,129)' },
  inverse_fourier_transform: { bg: 'rgba(52,211,153,0.75)',  border: 'rgb(52,211,153)' },
  dft_signal:                { bg: 'rgba(168,85,247,0.75)',  border: 'rgb(168,85,247)' },
  dft_function:              { bg: 'rgba(192,132,252,0.75)', border: 'rgb(192,132,252)' },
  dft_epicycles:             { bg: 'rgba(216,180,254,0.75)', border: 'rgb(216,180,254)' },
};

const GROUP_COLORS = {
  series:     { bg: 'rgba(59,130,246,0.8)',  border: 'rgb(59,130,246)' },
  transforms: { bg: 'rgba(16,185,129,0.8)',  border: 'rgb(16,185,129)' },
  dft:        { bg: 'rgba(168,85,247,0.8)',  border: 'rgb(168,85,247)' },
};

const SERIES_TYPES    = new Set(['trigonometric', 'half_range', 'complex']);
const TRANSFORM_TYPES = new Set(['fourier_transform', 'inverse_fourier_transform']);
const DFT_TYPES       = new Set(['dft_signal', 'dft_function', 'dft_epicycles']);
const TREND_COLOR     = { bg: 'rgba(46,125,110,0.2)', border: 'rgb(46,125,110)' };

// Maxima symbols → readable text
function fmtMaxima(s: string): string {
  return s
    .replace(/\bminf\b/g, '-∞')
    .replace(/\binf\b/g, '+∞')
    .replace(/%pi\b/g, 'π')
    .replace(/%e\b/g, 'e')
    .replace(/%i\b/g, 'i');
}

/** Returns 'YYYY-MM-DD' for (today - days). */
function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-calc-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calc-stats.component.html',
})
export class CalcStatsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error   = false;
  stats: CalcStats | null = null;

  // Filter state (YYYY-MM-DD strings, empty = no limit)
  dateFrom = '';
  dateTo   = '';
  topN     = 10;
  readonly topNOptions = [10, 20, 50, 100];

  readonly typeLabel = (t: string) => CALC_TYPE_LABEL[t] ?? t;
  readonly Math = Math;

  private charts: Chart[] = [];

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  // ── Quick period shortcuts ─────────────────────────────────────────────────

  readonly quickPeriods = [
    { label: '7d',  days: 7   },
    { label: '30d', days: 30  },
    { label: '90d', days: 90  },
  ];

  setQuickPeriod(days: number): void {
    this.dateFrom = dateNDaysAgo(days);
    this.dateTo   = '';
    this.load();
  }

  clearDates(): void {
    this.dateFrom = '';
    this.dateTo   = '';
    this.load();
  }

  applyDates(): void {
    this.load();
  }

  get hasFilter(): boolean {
    return !!(this.dateFrom || this.dateTo);
  }

  /** Returns days if dateFrom matches a known shortcut (within 1 day tolerance), else null. */
  activeQuickDays(): number | null {
    if (!this.dateFrom || this.dateTo) return null;
    for (const p of this.quickPeriods) {
      if (this.dateFrom === dateNDaysAgo(p.days)) return p.days;
    }
    return null;
  }

  // ── Calculation input display ──────────────────────────────────────────────

  groupLabel(type: string): string {
    if (SERIES_TYPES.has(type))    return 'Series';
    if (TRANSFORM_TYPES.has(type)) return 'Transformadas';
    if (DFT_TYPES.has(type))       return 'DFT';
    return '';
  }

  inputSummary(entry: CalcStats['topCalcs'][number]): string {
    const inp = entry.input;
    if (!inp) return '—';

    // Inputs with segments (series, transforms, dft_function)
    const segments = inp['segments'] as
      | Array<{ expression?: string; from?: string; to?: string }>
      | undefined;

    if (segments?.length) {
      const first = segments[0];
      const expr  = fmtMaxima(first.expression ?? '?');
      const range = first.from !== undefined && first.to !== undefined
        ? ` [${fmtMaxima(first.from)}, ${fmtMaxima(first.to)}]`
        : '';
      const more   = segments.length > 1
        ? ` +${segments.length - 1} tramo${segments.length > 2 ? 's' : ''}`
        : '';
      const nStr   = inp['N'] !== undefined ? `, N=${inp['N']}` : '';
      const varStr = inp['intVar'] ? ` (var: ${inp['intVar']})` : '';
      return `${expr}${range}${more}${nStr}${varStr}`;
    }

    // DFT from points (dft_signal, dft_epicycles)
    const points = inp['points'] as unknown[] | undefined;
    if (points) {
      const n = inp['N'] !== undefined ? `, N=${inp['N']}` : '';
      return `${points.length} puntos${n}`;
    }

    return JSON.stringify(inp).slice(0, 80);
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.error   = false;
    this.destroyCharts();

    const query: { dateFrom?: string; dateTo?: string; topN?: number } = {};
    if (this.dateFrom) query.dateFrom = new Date(this.dateFrom).toISOString();
    if (this.dateTo)   query.dateTo   = new Date(this.dateTo + 'T23:59:59').toISOString();
    if (this.topN !== 10) query.topN  = this.topN;

    this.api.getCalcStats(query).subscribe({
      next: (data) => {
        this.stats = { ...data, daily: this.fillDailyGaps(data.daily) };
        this.loading = false;
        this.cdr.detectChanges();
        this.initCharts();
      },
      error: () => {
        this.error   = true;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private fillDailyGaps(
    daily: CalcStats['daily'],
  ): CalcStats['daily'] {
    if (!daily.length) return daily;

    // Determine range: dateFrom → dateTo (or today)
    const start = this.dateFrom
      ? new Date(this.dateFrom)
      : (() => { const d = new Date(daily[0].day); return d; })();
    const end = this.dateTo ? new Date(this.dateTo) : new Date();
    end.setHours(0, 0, 0, 0);

    const map = new Map(daily.map((d) => [d.day, d]));
    const result: CalcStats['daily'] = [];

    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const key = cur.toISOString().slice(0, 10);
      result.push(map.get(key) ?? { day: key, executions: 0, unique_calcs: 0 });
    }
    return result;
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private gridColor = () =>
    document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.07)';

  private textColor = () =>
    document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.55)'
      : 'rgba(0,0,0,0.55)';

  private initCharts(): void {
    if (!this.stats) return;
    const grid = this.gridColor();
    const text = this.textColor();
    this.buildGroupDonut(grid, text);
    this.buildAuthDonut(grid, text);
    this.buildSubtypeBar(grid, text);
    this.buildTrendLine(grid, text);
  }

  private buildGroupDonut(grid: string, text: string): void {
    const canvas = document.getElementById('csGroup') as HTMLCanvasElement | null;
    if (!canvas || !this.stats) return;
    const byType = this.stats.byType;
    const sum    = (types: Set<string>) =>
      byType.filter((r) => types.has(r.type)).reduce((a, r) => a + r.total_executions, 0);
    this.charts.push(
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Series de Fourier', 'Transformadas', 'DFT'],
          datasets: [{
            data: [sum(SERIES_TYPES), sum(TRANSFORM_TYPES), sum(DFT_TYPES)],
            backgroundColor: [GROUP_COLORS.series.bg, GROUP_COLORS.transforms.bg, GROUP_COLORS.dft.bg],
            borderColor:     [GROUP_COLORS.series.border, GROUP_COLORS.transforms.border, GROUP_COLORS.dft.border],
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: text, padding: 12, font: { family: 'monospace', size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const pct   = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                  return ` ${ctx.parsed.toLocaleString()} ejecuciones (${pct}%)`;
                },
              },
            },
          },
        },
      }),
    );
  }

  private buildAuthDonut(grid: string, text: string): void {
    const canvas = document.getElementById('csAuth') as HTMLCanvasElement | null;
    if (!canvas || !this.stats) return;
    const auth  = this.stats.authSplit.find((r) => r.is_authenticated);
    const anon  = this.stats.authSplit.find((r) => !r.is_authenticated);
    this.charts.push(
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Autenticados', 'Anónimos'],
          datasets: [{
            data: [auth?.executions ?? 0, anon?.executions ?? 0],
            backgroundColor: ['rgba(46,125,110,0.8)', 'rgba(100,116,139,0.7)'],
            borderColor:     ['rgb(46,125,110)',       'rgb(100,116,139)'],
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: text, padding: 12, font: { family: 'monospace', size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const pct   = total ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                  return ` ${ctx.parsed.toLocaleString()} ejecuciones (${pct}%)`;
                },
              },
            },
          },
        },
      }),
    );
  }

  private buildSubtypeBar(grid: string, text: string): void {
    const canvas = document.getElementById('csSubtype') as HTMLCanvasElement | null;
    if (!canvas || !this.stats) return;
    const rows = this.stats.byType;
    this.charts.push(
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: rows.map((r) => this.typeLabel(r.type)),
          datasets: [{
            label: 'Ejecuciones',
            data:            rows.map((r) => r.total_executions),
            backgroundColor: rows.map((r) => TYPE_COLOR[r.type]?.bg    ?? 'rgba(156,163,175,0.7)'),
            borderColor:     rows.map((r) => TYPE_COLOR[r.type]?.border ?? 'rgb(156,163,175)'),
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => ` ${(ctx.parsed.x as number).toLocaleString()} ejecuciones` },
            },
          },
          scales: {
            x: { ticks: { color: text }, grid: { color: grid } },
            y: { ticks: { color: text }, grid: { display: false } },
          },
        },
      }),
    );
  }

  private buildTrendLine(grid: string, text: string): void {
    const canvas = document.getElementById('csTrend') as HTMLCanvasElement | null;
    if (!canvas || !this.stats) return;
    this.charts.push(
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: this.stats.daily.map((r) => r.day),
          datasets: [{
            label: 'Ejecuciones',
            data:            this.stats.daily.map((r) => r.executions),
            borderColor:     TREND_COLOR.border,
            backgroundColor: TREND_COLOR.bg,
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: text, maxTicksLimit: 12 }, grid: { display: false } },
            y: { ticks: { color: text, precision: 0 }, grid: { color: grid } },
          },
        },
      }),
    );
  }
}
