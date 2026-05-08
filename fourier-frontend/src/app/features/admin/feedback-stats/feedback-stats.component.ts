import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../core/services/api/api.service';
import { FeedbackStats } from '../../../domain';

Chart.register(...registerables);

const ACCENT   = 'rgba(46,125,110,0.75)';
const ACCENT_B = 'rgb(46,125,110)';
const PALETTE  = [
  ACCENT,
  'rgba(59,130,246,0.75)',
  'rgba(245,158,11,0.75)',
  'rgba(239,68,68,0.75)',
  'rgba(168,85,247,0.75)',
];
const PALETTE_B = PALETTE.map((c) => c.replace('0.75)', '1)'));

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Error / Bug', suggestion: 'Sugerencia', question: 'Pregunta',
  other: 'Otro', rating: 'Solo calificación',
};

@Component({
  selector: 'app-feedback-stats',
  templateUrl: './feedback-stats.component.html',
})
export class FeedbackStatsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading  = true;
  error    = false;
  stats: FeedbackStats | null = null;

  private charts: Chart[] = [];

  ngOnInit(): void {
    this.api.getFeedbackStats().subscribe({
      next: (data) => {
        this.stats   = data;
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

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
  }

  private gridColor(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  }
  private textColor(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  }

  private initCharts(): void {
    if (!this.stats) return;
    const grid = this.gridColor();
    const text = this.textColor();

    // 1 — By category (horizontal bar)
    const catCanvas = document.getElementById('fbCat') as HTMLCanvasElement | null;
    if (catCanvas) {
      const labels = this.stats.byCategory.map((r) => CATEGORY_LABEL[r.category] ?? r.category);
      const data   = this.stats.byCategory.map((r) => r.count);
      this.charts.push(new Chart(catCanvas, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderColor: PALETTE_B, borderWidth: 1 }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: text }, grid: { color: grid } },
            y: { ticks: { color: text }, grid: { display: false } },
          },
        },
      }));
    }

    // 2 — Rating distribution (bar)
    const ratingCanvas = document.getElementById('fbRating') as HTMLCanvasElement | null;
    if (ratingCanvas) {
      const allRatings = [1, 2, 3, 4, 5];
      const countMap   = Object.fromEntries(this.stats.byRating.map((r) => [r.rating, r.count]));
      this.charts.push(new Chart(ratingCanvas, {
        type: 'bar',
        data: {
          labels: allRatings.map((r) => '★'.repeat(r)),
          datasets: [{
            data: allRatings.map((r) => countMap[r] ?? 0),
            backgroundColor: PALETTE.slice(0, 5),
            borderColor: PALETTE_B.slice(0, 5),
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: text }, grid: { display: false } },
            y: { ticks: { color: text, precision: 0 }, grid: { color: grid } },
          },
        },
      }));
    }

    // 3 — Submissions over 30 days (line)
    const dayCanvas = document.getElementById('fbDay') as HTMLCanvasElement | null;
    if (dayCanvas) {
      this.charts.push(new Chart(dayCanvas, {
        type: 'line',
        data: {
          labels:   this.stats.byDay.map((r) => r.day),
          datasets: [{
            label: 'Envíos',
            data:  this.stats.byDay.map((r) => r.count),
            borderColor: ACCENT_B, backgroundColor: ACCENT,
            tension: 0.3, fill: true, pointRadius: 3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: text, maxTicksLimit: 10 }, grid: { display: false } },
            y: { ticks: { color: text, precision: 0 }, grid: { color: grid } },
          },
        },
      }));
    }
  }
}
