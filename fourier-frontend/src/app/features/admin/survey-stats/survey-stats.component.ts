import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../core/services/api/api.service';
import { SurveyStats } from '../../../domain';

Chart.register(...registerables);

const ACCENT   = 'rgba(46,125,110,0.75)';
const ACCENT_B = 'rgb(46,125,110)';
const PALETTE  = [
  ACCENT,
  'rgba(59,130,246,0.75)',
  'rgba(245,158,11,0.75)',
  'rgba(239,68,68,0.75)',
  'rgba(168,85,247,0.75)',
  'rgba(20,184,166,0.75)',
  'rgba(251,146,60,0.75)',
  'rgba(100,116,139,0.75)',
  'rgba(236,72,153,0.75)',
  'rgba(234,179,8,0.75)',
];
const PALETTE_B = PALETTE.map((c) => c.replace('0.75)', '1)'));

const ROLE_LABEL: Record<string, string> = {
  student: 'Estudiante', teacher: 'Docente', graduate: 'Egresado', other: 'Otro',
};
const HOW_FOUND_LABEL: Record<string, string> = {
  search: 'Buscador', recommendation_peer: 'Rec. (par)',
  recommendation_teacher: 'Rec. (docente)', social: 'Redes sociales', other: 'Otro',
};
const PURPOSE_LABEL: Record<string, string> = {
  problem: 'Resolver problema', learning: 'Aprender',
  teaching: 'Enseñar', exploration: 'Exploración', other: 'Otro',
};
const FEATURE_LABEL: Record<string, string> = {
  trigonometric: 'Trigonométrica', half_range: 'Medio rango', complex: 'Compleja',
  fourier_transform: 'Transformada', inverse_fourier_transform: 'T. Inversa',
  dft_signal: 'DFT señal', dft_function: 'DFT función',
  dft_epicycles: 'DFT epiciclos', none: 'Ninguna',
};
const DEVICE_LABEL: Record<string, string> = { phone: 'Teléfono', computer: 'Computadora' };
const IMPROVE_LABEL: Record<string, string> = {
  ui: 'Interfaz', features: 'Funcionalidades', speed: 'Velocidad',
  results_clarity: 'Claridad de resultados', other: 'Otro',
};

@Component({
  selector: 'app-survey-stats',
  templateUrl: './survey-stats.component.html',
  imports: [DecimalPipe],
})
export class SurveyStatsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error   = false;
  stats: SurveyStats | null = null;

  private charts: Chart[] = [];

  ngOnInit(): void {
    this.api.getSurveyStats().subscribe({
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

  private grid(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  }
  private text(): string {
    return document.documentElement.classList.contains('dark')
      ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  }

  private hBar(canvasId: string, labels: string[], data: number[]): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, data.length),
          borderColor:     PALETTE_B.slice(0, data.length),
          borderWidth: 1,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: this.text() }, grid: { color: this.grid() } },
          y: { ticks: { color: this.text() }, grid: { display: false } },
        },
      },
    }));
  }

  private doughnut(canvasId: string, labels: string[], data: number[]): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.slice(0, data.length),
          borderColor:     PALETTE_B.slice(0, data.length),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: this.text(), font: { size: 11 }, padding: 12 },
          },
        },
      },
    }));
  }

  private initCharts(): void {
    if (!this.stats) return;
    const s = this.stats;

    // 1 — Role
    this.hBar('svRole',
      s.byRole.map((r) => ROLE_LABEL[r.role] ?? r.role),
      s.byRole.map((r) => r.count));

    // 2 — How found
    this.hBar('svHowFound',
      s.byHowFound.map((r) => HOW_FOUND_LABEL[r.how_found] ?? r.how_found),
      s.byHowFound.map((r) => r.count));

    // 3 — Top countries
    this.hBar('svCountry',
      s.topCountries.map((r) => r.country),
      s.topCountries.map((r) => r.count));

    // 4 — Purpose (multi-select)
    this.hBar('svPurpose',
      s.byPurpose.map((r) => PURPOSE_LABEL[r.purpose] ?? r.purpose),
      s.byPurpose.map((r) => r.count));

    // 5 — Features used (multi-select)
    this.hBar('svFeature',
      s.byFeature.map((r) => FEATURE_LABEL[r.feature] ?? r.feature),
      s.byFeature.map((r) => r.count));

    // 6 — Device (doughnut)
    this.doughnut('svDevice',
      s.byDevice.map((r) => DEVICE_LABEL[r.device] ?? r.device),
      s.byDevice.map((r) => r.count));

    // 7 — Used previous (doughnut)
    this.doughnut('svUsedPrev',
      s.usedPrevious.map((r) => r.used_previous ? 'Sí' : 'No'),
      s.usedPrevious.map((r) => r.count));

    // 8 — Improvements (multi-select) — only if data present
    if (s.improvements.length > 0) {
      this.hBar('svImprove',
        s.improvements.map((r) => IMPROVE_LABEL[r.improvement] ?? r.improvement),
        s.improvements.map((r) => r.count));
    }

    // 9 — Avg ratings (horizontal bar, scale 1–5)
    const ratingsCanvas = document.getElementById('svRatings') as HTMLCanvasElement | null;
    if (ratingsCanvas) {
      const rLabels = ['Utilidad', 'Facilidad de uso', 'vs Otras herramientas', 'Recomendaría'];
      const rData   = [
        s.avgRatings.usefulness, s.avgRatings.ease,
        s.avgRatings.vs_other,   s.avgRatings.recommend,
      ];
      this.charts.push(new Chart(ratingsCanvas, {
        type: 'bar',
        data: {
          labels: rLabels,
          datasets: [{
            data: rData,
            backgroundColor: PALETTE.slice(0, 4),
            borderColor:     PALETTE_B.slice(0, 4),
            borderWidth: 1,
          }],
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              min: 0, max: 5,
              ticks: { color: this.text(), stepSize: 1 },
              grid:  { color: this.grid() },
            },
            y: { ticks: { color: this.text() }, grid: { display: false } },
          },
        },
      }));
    }

    // 10 — Daily trend (line)
    const dayCanvas = document.getElementById('svDay') as HTMLCanvasElement | null;
    if (dayCanvas) {
      this.charts.push(new Chart(dayCanvas, {
        type: 'line',
        data: {
          labels:   s.byDay.map((r) => r.day),
          datasets: [{
            label: 'Respuestas',
            data:  s.byDay.map((r) => r.count),
            borderColor: ACCENT_B, backgroundColor: ACCENT,
            tension: 0.3, fill: true, pointRadius: 3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: this.text(), maxTicksLimit: 10 }, grid: { display: false } },
            y: { ticks: { color: this.text(), precision: 0 } as never, grid: { color: this.grid() } },
          },
        },
      }));
    }
  }
}
