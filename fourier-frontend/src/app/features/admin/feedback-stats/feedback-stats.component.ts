import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../core/services/api/api.service';
import { FeedbackStats, UnifiedCommentsResponse } from '../../../domain';

Chart.register(...registerables);

const ACCENT = 'rgba(46,125,110,0.75)';
const ACCENT_B = 'rgb(46,125,110)';
const PALETTE = [
  ACCENT,
  'rgba(59,130,246,0.75)',
  'rgba(245,158,11,0.75)',
  'rgba(239,68,68,0.75)',
  'rgba(168,85,247,0.75)',
];
const PALETTE_B = PALETTE.map((c) => c.replace('0.75)', '1)'));

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Error / Bug',
  suggestion: 'Sugerencia',
  question: 'Pregunta',
  other: 'Otro',
  rating: 'Solo calificación',
};

@Component({
  selector: 'app-feedback-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback-stats.component.html',
})
export class FeedbackStatsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error = false;
  stats: FeedbackStats | null = null;

  loadingComments = false;
  errorComments = false;
  commentsList: UnifiedCommentsResponse | null = null;

  private charts: Chart[] = [];
  readonly Math = Math;

  ngOnInit(): void {
    this.api.getFeedbackStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.detectChanges();
        this.initCharts();
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });

    this.loadComments();
  }

  ngOnDestroy(): void {
    this.charts.forEach((chart) => chart.destroy());
  }

  loadNextComments(): void {
    if (!this.commentsList) return;
    this.loadComments(this.commentsList.limit, this.commentsList.offset + this.commentsList.limit);
  }

  loadPreviousComments(): void {
    if (!this.commentsList) return;
    this.loadComments(
      this.commentsList.limit,
      Math.max(0, this.commentsList.offset - this.commentsList.limit),
    );
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  private loadComments(limit: number = 50, offset: number = 0): void {
    this.loadingComments = true;
    this.errorComments = false;
    this.api.getAllComments(limit, offset).subscribe({
      next: (data) => {
        this.commentsList = data;
        this.loadingComments = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorComments = true;
        this.loadingComments = false;
        this.cdr.detectChanges();
      },
    });
  }

  private gridColor(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.07)';
  }

  private textColor(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.55)'
      : 'rgba(0,0,0,0.55)';
  }

  private initCharts(): void {
    if (!this.stats) return;
    const grid = this.gridColor();
    const text = this.textColor();

    const catCanvas = document.getElementById('fbCat') as HTMLCanvasElement | null;
    if (catCanvas) {
      const labels = this.stats.byCategory.map((r) => CATEGORY_LABEL[r.category] ?? r.category);
      const data = this.stats.byCategory.map((r) => r.count);
      this.charts.push(
        new Chart(catCanvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ data, backgroundColor: PALETTE, borderColor: PALETTE_B, borderWidth: 1 }],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: text }, grid: { color: grid } },
              y: { ticks: { color: text }, grid: { display: false } },
            },
          },
        }),
      );
    }

    const ratingCanvas = document.getElementById('fbRating') as HTMLCanvasElement | null;
    if (ratingCanvas) {
      const allRatings = [1, 2, 3, 4, 5];
      const countMap = Object.fromEntries(this.stats.byRating.map((r) => [r.rating, r.count]));
      this.charts.push(
        new Chart(ratingCanvas, {
          type: 'bar',
          data: {
            labels: allRatings.map((r) => '★'.repeat(r)),
            datasets: [
              {
                data: allRatings.map((r) => countMap[r] ?? 0),
                backgroundColor: PALETTE.slice(0, 5),
                borderColor: PALETTE_B.slice(0, 5),
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: text }, grid: { display: false } },
              y: { ticks: { color: text, precision: 0 }, grid: { color: grid } },
            },
          },
        }),
      );
    }

    const dayCanvas = document.getElementById('fbDay') as HTMLCanvasElement | null;
    if (dayCanvas) {
      this.charts.push(
        new Chart(dayCanvas, {
          type: 'line',
          data: {
            labels: this.stats.byDay.map((r) => r.day),
            datasets: [
              {
                label: 'Envíos',
                data: this.stats.byDay.map((r) => r.count),
                borderColor: ACCENT_B,
                backgroundColor: ACCENT,
                tension: 0.3,
                fill: true,
                pointRadius: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: text, maxTicksLimit: 10 }, grid: { display: false } },
              y: { ticks: { color: text, precision: 0 }, grid: { color: grid } },
            },
          },
        }),
      );
    }
  }
}
