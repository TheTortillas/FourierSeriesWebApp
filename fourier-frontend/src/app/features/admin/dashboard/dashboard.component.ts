import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/services/api/api.service';
import { AuditEntry, AdminUser } from '../../../domain';
import { HistoryEntry } from '../../../domain';

interface Stats {
  total: number;
  premium: number;
  free: number;
  inactive: number;
}

const CALC_TYPE_LABEL: Record<string, string> = {
  trigonometric:              'Trigonométrica',
  half_range:                 'Medio rango',
  complex:                    'Compleja',
  fourier_transform:          'Transformada',
  inverse_fourier_transform:  'T. Inversa',
  dft_signal:                 'DFT señal',
  dft_epicycles:              'DFT epiciclos',
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink],
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading       = signal(true);
  readonly stats         = signal<Stats | null>(null);
  readonly recentAudit   = signal<AuditEntry[]>([]);
  readonly recentCalcs   = signal<HistoryEntry[]>([]);

  readonly calcLabel = (type: string) => CALC_TYPE_LABEL[type] ?? type;

  ngOnInit(): void {
    forkJoin({
      total:    this.api.getAdminUsers({ limit: 1 }),
      premium:  this.api.getAdminUsers({ limit: 1, tier: 'premium' }),
      inactive: this.api.getAdminUsers({ limit: 1, isActive: false }),
      audit:    this.api.getAuditLog({ limit: 6 }),
      history:  this.api.getAdminHistory({ limit: 6 }),
    }).subscribe({
      next: ({ total, premium, inactive, audit, history }) => {
        const t = total.total;
        const p = premium.total;
        this.stats.set({ total: t, premium: p, free: t - p, inactive: inactive.total });
        this.recentAudit.set(audit.entries);
        this.recentCalcs.set(history.entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  auditBadgeClass(action: string): string {
    if (action.includes('login') || action.includes('register'))
      return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
    if (action.includes('deactivat') || action.includes('fail') || action.includes('clear'))
      return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
    if (action.includes('tier') || action.includes('activat'))
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (action.includes('calculat') || action.includes('transform') || action.includes('perform'))
      return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    return 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
  }
}
