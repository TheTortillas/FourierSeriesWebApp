import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { AuditEntry, AuditQuery } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';
import { auditBadgeClass } from '../../../shared/utils/audit.utils';

const PAGE_SIZE = 30;

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-audit',
  templateUrl: './audit.component.html',
  imports: [NgClass, FormsModule, AdminDatePipe],
})
export class AuditComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading  = signal(false);
  readonly entries  = signal<AuditEntry[]>([]);
  readonly total    = signal(0);
  readonly offset   = signal(0);
  readonly pageSize = PAGE_SIZE;

  // Filters
  filterAction      = '';
  filterUserId      = '';
  filterIp          = '';
  filterDateFrom    = '';
  filterDateTo      = '';
  filterAnonymous   = false;

  // Clear old entries panel
  clearAction   = '';
  clearDays     = 30;
  readonly clearMsg     = signal<string | null>(null);
  readonly clearLoading = signal(false);

  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);
  readonly hasFilters  = computed(() =>
    !!(this.filterAction || this.filterUserId || this.filterIp || this.filterDateFrom || this.filterDateTo || this.filterAnonymous)
  );

  readonly quickPeriods = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }];

  setQuickPeriod(days: number): void {
    this.filterDateFrom = dateNDaysAgo(days);
    this.filterDateTo   = '';
    this.applyFilters();
  }

  clearDateFilters(): void {
    this.filterDateFrom = '';
    this.filterDateTo   = '';
    this.applyFilters();
  }

  activeQuickDays(): number | null {
    if (!this.filterDateFrom || this.filterDateTo) return null;
    for (const p of this.quickPeriods) {
      if (this.filterDateFrom === dateNDaysAgo(p.days)) return p.days;
    }
    return null;
  }

  readonly badgeClass = auditBadgeClass;

  readonly AUDIT_ACTIONS = [
    'login', 'logout', 'register', 'password_change',
    'google_linked', 'google_unlinked',
    'account_recovery_initiated', 'account_recovery_completed',
    'calculation_performed', 'calculation_failed',
    'transform_performed', 'transform_failed',
    'user_deactivated', 'user_activated',
    'tier_changed', 'audit_log_cleared',
    'rate_limit_blocked',
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const query: AuditQuery = { limit: this.pageSize, offset: this.offset() };
    if (this.filterAction)    query.action        = this.filterAction;
    if (this.filterUserId)    query.userId        = this.filterUserId.trim();
    if (this.filterIp)        query.ip            = this.filterIp.trim();
    if (this.filterDateFrom)  query.dateFrom      = this.filterDateFrom;
    if (this.filterDateTo)    query.dateTo        = this.filterDateTo;
    if (this.filterAnonymous) query.anonymousOnly = true;

    this.api.getAuditLog(query).subscribe({
      next: (res) => { this.entries.set(res.entries); this.total.set(res.total ?? 0); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.offset.set(0); this.load(); }

  clearFilters(): void {
    this.filterAction    = '';
    this.filterUserId    = '';
    this.filterIp        = '';
    this.filterDateFrom  = '';
    this.filterDateTo    = '';
    this.filterAnonymous = false;
    this.applyFilters();
  }

  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  clearOldEntries(): void {
    if (!this.clearAction || this.clearDays < 1) return;
    if (!confirm(`¿Eliminar entradas de "${this.clearAction}" con más de ${this.clearDays} días? Esta acción no se puede deshacer.`)) return;
    this.clearLoading.set(true);
    this.api.clearAuditLog(this.clearAction, this.clearDays).subscribe({
      next: (res: { message: string }) => {
        this.clearMsg.set(res.message);
        this.clearLoading.set(false);
        this.load();
        setTimeout(() => this.clearMsg.set(null), 3000);
      },
      error: () => this.clearLoading.set(false),
    });
  }

  metaString(meta: Record<string, unknown> | undefined): string {
    if (!meta || Object.keys(meta).length === 0) return '';
    return JSON.stringify(meta);
  }
}
