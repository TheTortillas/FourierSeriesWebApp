import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { AuditEntry } from '../../../domain';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-audit',
  templateUrl: './audit.component.html',
  imports: [FormsModule],
})
export class AuditComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading  = signal(false);
  readonly entries  = signal<AuditEntry[]>([]);
  readonly total    = signal(0);
  readonly offset   = signal(0);
  readonly pageSize = PAGE_SIZE;

  // Clear old entries panel
  clearAction   = '';
  clearDays     = 30;
  readonly clearMsg     = signal<string | null>(null);
  readonly clearLoading = signal(false);

  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  readonly AUDIT_ACTIONS = [
    'login', 'logout', 'register', 'password_change',
    'google_linked', 'google_unlinked',
    'account_recovery_initiated', 'account_recovery_completed',
    'calculation_performed', 'calculation_failed',
    'transform_performed', 'transform_failed',
    'user_deactivated', 'user_activated',
    'tier_changed', 'audit_log_cleared',
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getAuditLog({ limit: this.pageSize, offset: this.offset() }).subscribe({
      next: (res) => { this.entries.set(res.entries); this.total.set(res.total ?? 0); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  clearOldEntries(): void {
    if (!this.clearAction || this.clearDays < 1) return;
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

  badgeClass(action: string): string {
    if (action.includes('login') || action.includes('register'))
      return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
    if (action.includes('deactivat') || action.includes('fail') || action.includes('clear'))
      return 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800';
    if (action.includes('tier') || action.includes('activat'))
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    if (action.includes('calculat') || action.includes('transform') || action.includes('perform'))
      return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    if (action.includes('password') || action.includes('recovery'))
      return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
    return 'bg-paper dark:bg-dark-bg text-muted dark:text-dark-muted border-border dark:border-dark-border';
  }

  formatDate(value: string | Date | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('es', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  metaString(meta: Record<string, unknown> | undefined): string {
    if (!meta || Object.keys(meta).length === 0) return '';
    return JSON.stringify(meta);
  }
}
