import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/services/api/api.service';
import { AuditEntry, HistoryEntry, CALC_TYPE_LABEL, SystemStats } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';
import { auditBadgeClass } from '../../../shared/utils/audit.utils';

interface Stats {
  total: number;
  premium: number;
  free: number;
  inactive: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink, AdminDatePipe],
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly stats = signal<Stats | null>(null);
  readonly systemStats = signal<SystemStats | null>(null);
  readonly recentAudit = signal<AuditEntry[]>([]);
  readonly recentCalcs = signal<HistoryEntry[]>([]);

  readonly auditBadgeClass = auditBadgeClass;
  readonly calcLabel = (type: string) => CALC_TYPE_LABEL[type] ?? type;

  ngOnInit(): void {
    forkJoin({
      stats: this.api.getAdminStats(),
      system: this.api.getSystemStats(),
      audit: this.api.getAuditLog({ limit: 6 }),
      history: this.api.getAdminHistory({ limit: 6 }),
    }).subscribe({
      next: ({ stats, system, audit, history }) => {
        this.stats.set(stats);
        this.systemStats.set(system);
        this.recentAudit.set(audit.entries);
        this.recentCalcs.set(history.entries);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
