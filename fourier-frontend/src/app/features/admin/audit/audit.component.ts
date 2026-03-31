import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { AuditEntry } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';
import { auditBadgeClass } from '../../../shared/utils/audit.utils';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-audit',
  templateUrl: './audit.component.html',
  imports: [FormsModule, AdminDatePipe],
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

  readonly badgeClass = auditBadgeClass;

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

  metaString(meta: Record<string, unknown> | undefined): string {
    if (!meta || Object.keys(meta).length === 0) return '';
    return JSON.stringify(meta);
  }
}
