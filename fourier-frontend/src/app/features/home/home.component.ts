import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/services/theme/theme.service';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

interface Waveform {
  name: string;
  maxN: number;
  eval: (x: number, n: number) => number;
  harmonic: (x: number, k: number) => number;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, NavComponent, FooterComponent, TranslocoPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnDestroy {
  readonly theme = inject(ThemeService);

  private readonly transloco = inject(TranslocoService);
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('heroCanvas');
  private animId = 0;
  private startTime = 0;
  private lastCycleIndex = -1;
  private currentWaveformIdx = 0;

  private readonly waveforms: Waveform[] = [
    {
      name: 'cuadrada',
      maxN: 13,
      eval: (x, n) => {
        let y = 0;
        for (let k = 0; k < n; k++) {
          const m = 2 * k + 1;
          y += Math.sin(m * x) / m;
        }
        return (4 / Math.PI) * y;
      },
      harmonic: (x, k) => {
        const m = 2 * k + 1;
        return ((4 / Math.PI) * Math.sin(m * x)) / m;
      },
    },
    {
      name: 'sierra',
      maxN: 16,
      eval: (x, n) => {
        let y = 0;
        for (let k = 1; k <= n; k++) y += ((k % 2 !== 0 ? 1 : -1) * Math.sin(k * x)) / k;
        return (2 / Math.PI) * y;
      },
      harmonic: (x, k) => {
        const n = k + 1;
        return ((2 / Math.PI) * (n % 2 !== 0 ? 1 : -1) * Math.sin(n * x)) / n;
      },
    },
    {
      name: 'triangular',
      maxN: 10,
      eval: (x, n) => {
        let y = 0;
        for (let k = 0; k < n; k++) {
          const m = 2 * k + 1;
          y += ((k % 2 === 0 ? 1 : -1) * Math.sin(m * x)) / (m * m);
        }
        return (8 / (Math.PI * Math.PI)) * y;
      },
      harmonic: (x, k) => {
        const m = 2 * k + 1;
        return ((8 / (Math.PI * Math.PI)) * (k % 2 === 0 ? 1 : -1) * Math.sin(m * x)) / (m * m);
      },
    },
  ];

  constructor() {
    afterNextRender(() => this.startAnimation());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
  }

  private startAnimation(): void {
    const el = this.canvasRef()?.nativeElement;
    if (!el) return;
    this.startTime = performance.now();
    const loop = (now: number): void => {
      this.drawFrame(el, now - this.startTime);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  private pickNextWaveform(): void {
    let next = Math.floor(Math.random() * this.waveforms.length);
    while (next === this.currentWaveformIdx && this.waveforms.length > 1) {
      next = Math.floor(Math.random() * this.waveforms.length);
    }
    this.currentWaveformIdx = next;
  }

  private drawFrame(canvas: HTMLCanvasElement, elapsed: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect cycle change → switch waveform
    const cycleDuration = 11000;
    const cycleIdx = Math.floor(elapsed / cycleDuration);
    if (cycleIdx !== this.lastCycleIndex) {
      if (this.lastCycleIndex >= 0) this.pickNextWaveform();
      this.lastCycleIndex = cycleIdx;
    }

    const waveform = this.waveforms[this.currentWaveformIdx];
    const t = elapsed % cycleDuration;
    const maxN = waveform.maxN;

    // Build phase: 0–8s → N grows 1→maxN; hold 8–11s
    const buildTime = 8000;
    const N = t < buildTime ? Math.max(1, Math.round((t / buildTime) * maxN)) : maxN;

    // HiDPI setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.scale(dpr, dpr);
    }
    ctx.clearRect(0, 0, W, H);

    const isDark = this.theme.isDark;
    const isNeutral = this.theme.isNeutral;
    const ampColor = isNeutral
      ? isDark
        ? [96, 165, 250]
        : [59, 130, 246]
      : isDark
        ? [200, 140, 70]
        : [139, 37, 0];
    const harmColor = isNeutral
      ? isDark
        ? [120, 160, 220]
        : [80, 125, 210]
      : isDark
        ? [180, 130, 80]
        : [120, 40, 0];

    const amplitude = H * 0.28;
    const centerY = H * 0.5;
    const xRange = 3 * Math.PI;

    // Individual harmonics — slightly visible
    for (let k = 0; k < N; k++) {
      const alpha = isDark ? 0.14 : 0.11;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${harmColor[0]},${harmColor[1]},${harmColor[2]},${alpha})`;
      ctx.lineWidth = 1;
      for (let px = 0; px <= W; px++) {
        const x = (px / W) * xRange * 2 - xRange;
        const y = centerY - amplitude * waveform.harmonic(x, k);
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
    }

    // Partial sum — main curve
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${ampColor[0]},${ampColor[1]},${ampColor[2]},${isDark ? 0.55 : 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    for (let px = 0; px <= W; px++) {
      const x = (px / W) * xRange * 2 - xRange;
      const y = centerY - amplitude * waveform.eval(x, N);
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();

    // Corner label
    ctx.font = '500 11px ui-monospace, monospace';
    ctx.fillStyle = `rgba(${ampColor[0]},${ampColor[1]},${ampColor[2]},${isDark ? 0.5 : 0.4})`;
    ctx.textAlign = 'right';
    ctx.fillText(`${waveform.name}  N = ${N}`, W - 12, 20);
  }
}
