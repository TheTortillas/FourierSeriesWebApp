import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, ChartDataset, registerables } from 'chart.js';
import { ApiService } from '../../../core/services/api/api.service';
import { CalcStats, CALC_TYPE_LABEL } from '../../../domain';
import { MathjaxDirective } from '../../../shared/directives/mathjax.directive';

Chart.register(...registerables);

// ── Color tokens ──────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { bg: string; border: string }> = {
  trigonometric:             { bg: 'rgba(59,130,246,0.75)',  border: 'rgb(59,130,246)' },
  half_range:                { bg: 'rgba(99,170,255,0.75)',  border: 'rgb(99,170,255)' },
  complex:                   { bg: 'rgba(147,197,253,0.75)', border: 'rgb(147,197,253)' },
  fourier_transform:         { bg: 'rgba(16,185,129,0.75)',  border: 'rgb(16,185,129)' },
  inverse_fourier_transform: { bg: 'rgba(52,211,153,0.75)',  border: 'rgb(52,211,153)' },
  fourier_integral:          { bg: 'rgba(132,204,22,0.75)',  border: 'rgb(132,204,22)' },
  laplace_direct:            { bg: 'rgba(249,115,22,0.75)',  border: 'rgb(249,115,22)' },
  laplace_inverse:           { bg: 'rgba(251,146,60,0.75)',  border: 'rgb(251,146,60)' },
  laplace_ode:               { bg: 'rgba(253,186,116,0.75)', border: 'rgb(253,186,116)' },
  ode_general:               { bg: 'rgba(16,185,129,0.75)',  border: 'rgb(16,185,129)' },
  ode_ivp:                   { bg: 'rgba(52,211,153,0.75)',  border: 'rgb(52,211,153)' },
  ode_bvp:                   { bg: 'rgba(20,184,166,0.75)',  border: 'rgb(20,184,166)' },
  dft_signal:                { bg: 'rgba(168,85,247,0.75)',  border: 'rgb(168,85,247)' },
  dft_function:              { bg: 'rgba(192,132,252,0.75)', border: 'rgb(192,132,252)' },
  dft_epicycles:             { bg: 'rgba(216,180,254,0.75)', border: 'rgb(216,180,254)' },
};

const GROUP_COLORS = {
  series:    { bg: 'rgba(59,130,246,0.8)',  border: 'rgb(59,130,246)' },
  integral:  { bg: 'rgba(132,204,22,0.8)',  border: 'rgb(132,204,22)' },
  transform: { bg: 'rgba(16,185,129,0.8)',  border: 'rgb(16,185,129)' },
  laplace:   { bg: 'rgba(249,115,22,0.8)',  border: 'rgb(249,115,22)' },
  ode:       { bg: 'rgba(20,184,166,0.8)',  border: 'rgb(20,184,166)' },
  dft:       { bg: 'rgba(168,85,247,0.8)',  border: 'rgb(168,85,247)' },
};

const SERIES_TYPES    = new Set(['trigonometric', 'half_range', 'complex']);
const TRANSFORM_TYPES = new Set(['fourier_transform', 'inverse_fourier_transform']);
const INTEGRAL_TYPES  = new Set(['fourier_integral']);
const LAPLACE_TYPES   = new Set(['laplace_direct', 'laplace_inverse']);
const ODE_TYPES       = new Set(['ode_general', 'ode_ivp', 'ode_bvp', 'laplace_ode']);
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
  imports: [CommonModule, FormsModule, MathjaxDirective],
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

  // Trend chart view mode
  trendGranularity: 'day' | 'week' = 'day';

  // Day-of-week filter (0=Sun … 6=Sat). Empty set = show all.
  readonly DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  trendDowFilter = new Set<number>();

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
    if (INTEGRAL_TYPES.has(type))  return 'Integral';
    if (TRANSFORM_TYPES.has(type)) return 'T. Fourier';
    if (LAPLACE_TYPES.has(type))   return 'Laplace';
    if (ODE_TYPES.has(type))       return 'EDO';
    if (DFT_TYPES.has(type))       return 'DFT';
    return '';
  }

  inputLatex(entry: CalcStats['topCalcs'][number]): string {
    const inp = entry.input;
    if (!inp) return '';

    type Seg = { expressionTex?: string; expression?: string; fromTex?: string; from?: string; toTex?: string; to?: string };
    const segments = inp['segments'] as Seg[] | undefined;
    const v = (inp['intVar'] as string | undefined) ?? (inp['timeVar'] as string | undefined) ?? 'x';

    if (segments?.length) {
      if (segments.length === 1) {
        const s = segments[0];
        const e = s.expressionTex ?? s.expression ?? '?';
        const f = s.fromTex ?? s.from ?? '';
        const t = s.toTex ?? s.to ?? '';
        const nStr = inp['N'] !== undefined ? `,\\; N=${inp['N']}` : '';
        return `\\(${e},\\; ${v} \\in [${f},\\,${t}]${nStr}\\)`;
      }
      const cases = segments
        .map((s) => {
          const e = s.expressionTex ?? s.expression ?? '?';
          const f = s.fromTex ?? s.from ?? '';
          const t = s.toTex ?? s.to ?? '';
          return `${e} & ${v} \\in [${f},\\,${t}]`;
        })
        .join(' \\\\ ');
      return `\\(\\begin{cases}${cases}\\end{cases}\\)`;
    }

    // Single expression (transforms, Laplace)
    const exprTex = inp['expressionTex'] as string | undefined;
    const expr    = inp['expression']    as string | undefined;
    if (exprTex || expr) return `\\(${exprTex ?? expr}\\)`;

    // ODE
    const eqTex = inp['equationTex'] as string | undefined;
    const eq    = inp['equation']    as string | undefined;
    if (eqTex || eq) return `\\(${eqTex ?? eq}\\)`;

    // DFT from points — no LaTeX, return empty (fallback handled in template)
    return '';
  }

  inputSummaryFallback(entry: CalcStats['topCalcs'][number]): string {
    const inp = entry.input;
    if (!inp) return '—';
    const points = inp['points'] as unknown[] | undefined;
    if (points) {
      const n = inp['N'] !== undefined ? `, N=${inp['N']}` : '';
      return `${points.length} puntos${n}`;
    }
    return JSON.stringify(inp).slice(0, 80);
  }

  // ── Trend granularity ─────────────────────────────────────────────────────

  setTrendGranularity(g: 'day' | 'week'): void {
    this.trendGranularity = g;
    if (g === 'week') this.trendDowFilter = new Set(); // DOW filter only makes sense daily
    this.rebuildTrendChart();
  }


  /** Collapses daily rows into ISO-week buckets (Mon–Sun). */
  private aggregateWeekly(daily: CalcStats['daily']): { day: string; executions: number }[] {
    const map = new Map<string, number>();
    for (const row of daily) {
      const d = new Date(row.day + 'T00:00:00');
      const dow = d.getDay(); // 0=Sun
      const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
      const mon = new Date(d);
      mon.setDate(d.getDate() + offset);
      const key = mon.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + row.executions);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, executions]) => ({ day, executions }));
  }

  /** 7-day simple moving average over daily data. */
  private movingAverage(data: number[], window = 7): (number | null)[] {
    return data.map((_, i) => {
      if (i < window - 1) return null;
      const slice = data.slice(i - window + 1, i + 1);
      return Math.round(slice.reduce((a, b) => a + b, 0) / window);
    });
  }

  /** Average executions per day in the current period. */
  get avgPerDay(): number | null {
    if (!this.stats?.daily.length) return null;
    const total = this.stats.daily.reduce((s, r) => s + r.executions, 0);
    return Math.round((total / this.stats.daily.length) * 10) / 10;
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.error   = false;
    this.destroyCharts();

    const query: { dateFrom?: string; dateTo?: string; topN?: number; tz?: string } = {};
    if (this.dateFrom) query.dateFrom = new Date(this.dateFrom + 'T00:00:00').toISOString();
    if (this.dateTo)   query.dateTo   = new Date(this.dateTo   + 'T23:59:59').toISOString();
    if (this.topN !== 10) query.topN  = this.topN;
    query.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

    const groups = [
      { label: 'Series de Fourier',    value: sum(SERIES_TYPES),    ...GROUP_COLORS.series    },
      { label: 'Integral de Fourier',  value: sum(INTEGRAL_TYPES),  ...GROUP_COLORS.integral  },
      { label: 'T. Fourier',           value: sum(TRANSFORM_TYPES), ...GROUP_COLORS.transform },
      { label: 'Laplace',              value: sum(LAPLACE_TYPES),   ...GROUP_COLORS.laplace   },
      { label: 'EDO',                  value: sum(ODE_TYPES),       ...GROUP_COLORS.ode       },
      { label: 'DFT',                  value: sum(DFT_TYPES),       ...GROUP_COLORS.dft       },
    ].filter((g) => g.value > 0);

    this.charts.push(
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels:   groups.map((g) => g.label),
          datasets: [{
            data:            groups.map((g) => g.value),
            backgroundColor: groups.map((g) => g.bg),
            borderColor:     groups.map((g) => g.border),
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
              callbacks: {
                label: (ctx) => ` ${(ctx.parsed.x as number).toLocaleString()} ejecuciones`,
                afterLabel: (ctx) => {
                  const row = rows[ctx.dataIndex];
                  if (row?.avg_execution_ms != null) return ` ⏱ ${row.avg_execution_ms.toLocaleString()} ms promedio`;
                  return '';
                },
              },
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

  /** Destroys and rebuilds only the trend chart (used when toggling granularity). */
  private rebuildTrendChart(): void {
    const idx = this.charts.findIndex((c) => (c.canvas as HTMLCanvasElement).id === 'csTrend');
    if (idx !== -1) { this.charts[idx].destroy(); this.charts.splice(idx, 1); }
    const grid = this.gridColor();
    const text = this.textColor();
    this.buildTrendLine(grid, text);
  }

  private buildTrendLine(grid: string, text: string): void {
    const canvas = document.getElementById('csTrend') as HTMLCanvasElement | null;
    if (!canvas || !this.stats) return;

    const isWeekly = this.trendGranularity === 'week';
    let rows = isWeekly ? this.aggregateWeekly(this.stats.daily) : this.stats.daily;

    // Apply day-of-week filter (daily mode only)
    if (!isWeekly && this.trendDowFilter.size > 0) {
      rows = rows.filter((r) => {
        const dow = new Date(r.day + 'T00:00:00').getDay();
        return this.trendDowFilter.has(dow);
      });
    }

    const labels = rows.map((r) => r.day);
    const values = rows.map((r) => r.executions);

    // Peak & valley (valley ignores zero-fill gaps)
    const maxVal = values.length ? Math.max(...values) : 0;
    const maxIdx = values.indexOf(maxVal);
    const nonZero = values.filter((v) => v > 0);
    const minVal = nonZero.length > 1 ? Math.min(...nonZero) : -1; // need >1 active point for valley to be meaningful
    const minIdx = minVal >= 0 && minVal !== maxVal ? values.indexOf(minVal) : -1;

    const defaultR = isWeekly ? 4 : 2;
    const pointRadii = values.map((_, i) =>
      i === maxIdx || i === minIdx ? 6 : defaultR,
    );
    const pointColors = values.map((_, i) => {
      if (i === maxIdx) return 'rgb(245,158,11)';   // amber — peak
      if (i === minIdx) return 'rgb(99,102,241)';   // indigo — valley
      return TREND_COLOR.border;
    });

    // Moving average (only for daily; weekly already smooths naturally)
    const maValues = isWeekly ? [] : this.movingAverage(values, 7);

    const datasets: ChartDataset<'line'>[] = [
      {
        label: isWeekly ? 'Ejecuciones (semana)' : 'Ejecuciones',
        data:            values,
        borderColor:     TREND_COLOR.border,
        backgroundColor: TREND_COLOR.bg,
        tension: 0.3,
        fill: true,
        pointRadius:      pointRadii,
        pointHoverRadius: pointRadii.map((r) => r + 2),
        pointBackgroundColor: pointColors,
        pointBorderColor:     pointColors,
      },
    ];

    if (!isWeekly) {
      datasets.push({
        label: 'Media 7 días',
        data:        maValues,
        borderColor: 'rgba(168,85,247,0.75)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 3],
        tension: 0.4,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: false,
      });
    }

    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !isWeekly,
            labels: { color: text, font: { family: 'monospace', size: 11 }, boxWidth: 24, padding: 10 },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const row = idx !== undefined ? rows[idx] : undefined;
                if (!row) return '';
                const d = new Date(row.day + 'T00:00:00');
                const fmt = (date: Date) => {
                  const dd = String(date.getDate()).padStart(2, '0');
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const yyyy = date.getFullYear();
                  return `${dd}/${mm}/${yyyy}`;
                };
                if (isWeekly) {
                  // row.day is Monday of the week; calculate Sunday
                  const sun = new Date(d);
                  sun.setDate(d.getDate() + 6);
                  return `Semana ${fmt(d)} – ${fmt(sun)}`;
                }
                const DOW_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                return `${DOW_FULL[d.getDay()]}, ${fmt(d)}`;
              },
              label: (ctx) => ` ${(ctx.parsed.y as number).toLocaleString('es-MX')} ejecuciones`,
              afterLabel: (items) => {
                const i = items.dataIndex;
                if (i === maxIdx) return '⚑ Pico máximo del período';
                if (i === minIdx) return '▼ Valle mínimo del período';
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: text,
              maxTicksLimit: isWeekly ? 14 : 12,
              callback: (_val, idx) => {
                const row = rows[idx];
                if (!row) return '';
                const d = new Date(row.day + 'T00:00:00');
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                if (isWeekly) return `${dd}/${mm}`;
                return `${dd}/${mm}`;
              },
            },
            grid: { display: false },
          },
          y: { ticks: { color: text, precision: 0 }, grid: { color: grid }, beginAtZero: true },
        },
      },
    });
    this.charts.push(chart);
  }
}
