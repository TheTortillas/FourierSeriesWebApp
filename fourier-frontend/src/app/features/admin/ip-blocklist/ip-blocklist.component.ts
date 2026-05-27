import { Component, inject, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { IpBlockEntry, IpBlockListResponse } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-ip-blocklist',
  templateUrl: './ip-blocklist.component.html',
  standalone: true,
  imports: [NgClass, FormsModule, AdminDatePipe],
})
export class IpBlocklistComponent implements OnInit {
  private readonly api = inject(ApiService);

  // ── Estado de la lista activa (cards superiores) ──────────────────────────
  readonly activeLoading = signal(true);
  readonly activeError   = signal(false);
  readonly activeBlocks  = signal<IpBlockEntry[]>([]);

  // ── Estado del historial paginado ─────────────────────────────────────────
  readonly histLoading  = signal(false);
  readonly histError    = signal(false);
  readonly history      = signal<IpBlockEntry[]>([]);
  readonly histTotal    = signal(0);
  readonly histOffset   = signal(0);
  readonly histPageSize = PAGE_SIZE;

  // ── Filtros del historial ─────────────────────────────────────────────────
  filterIp        = '';
  filterBlockedBy = '';

  // ── Formulario de bloqueo manual ──────────────────────────────────────────
  readonly showForm    = signal(false);
  readonly formLoading = signal(false);
  readonly formError   = signal('');
  readonly formSuccess = signal('');
  formIp            = '';
  formReason        = '';
  formDurationHours: number | null = 24;

  // ── Confirm unblock ───────────────────────────────────────────────────────
  readonly confirmingIp   = signal<string | null>(null);
  readonly unblockLoading = signal(false);
  readonly unblockError   = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly histTotalPages  = () => Math.ceil(this.histTotal() / this.histPageSize);
  readonly histCurrentPage = () => Math.floor(this.histOffset() / this.histPageSize) + 1;

  ngOnInit(): void {
    this.loadActive();
    this.loadHistory();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  loadActive(): void {
    this.activeLoading.set(true);
    this.activeError.set(false);
    this.api.getIpBlocksActive().subscribe({
      next: (r) => { this.activeBlocks.set(r.entries); this.activeLoading.set(false); },
      error: () => { this.activeError.set(true); this.activeLoading.set(false); },
    });
  }

  loadHistory(): void {
    this.histLoading.set(true);
    this.histError.set(false);
    this.api.getIpBlocks({
      limit:      this.histPageSize,
      offset:     this.histOffset(),
      ip:         this.filterIp.trim()       || undefined,
      blockedBy:  this.filterBlockedBy       || undefined,
    }).subscribe({
      next: (r: IpBlockListResponse) => {
        this.history.set(r.entries);
        this.histTotal.set(r.total);
        this.histLoading.set(false);
      },
      error: () => { this.histError.set(true); this.histLoading.set(false); },
    });
  }

  refresh(): void { this.loadActive(); this.histOffset.set(0); this.loadHistory(); }

  // ── Filtros ───────────────────────────────────────────────────────────────

  applyFilters(): void  { this.histOffset.set(0); this.loadHistory(); }
  clearFilters(): void  { this.filterIp = ''; this.filterBlockedBy = ''; this.applyFilters(); }
  prevPage(): void      { this.histOffset.set(Math.max(0, this.histOffset() - this.histPageSize)); this.loadHistory(); }
  nextPage(): void      { this.histOffset.set(this.histOffset() + this.histPageSize); this.loadHistory(); }

  filterByIp(ip: string): void { this.filterIp = ip; this.applyFilters(); }

  // ── Bloqueo manual ────────────────────────────────────────────────────────

  toggleForm(): void {
    this.showForm.update((v) => !v);
    this.formError.set('');
    this.formSuccess.set('');
    this.formIp = '';
    this.formReason = '';
    this.formDurationHours = 24;
  }

  submitBlock(): void {
    const ip     = this.formIp.trim();
    const reason = this.formReason.trim();

    if (!ip)           { this.formError.set('La IP es obligatoria.');           return; }
    if (!reason)       { this.formError.set('La razón es obligatoria.');         return; }
    if (reason.length < 5) { this.formError.set('La razón debe tener al menos 5 caracteres.'); return; }

    this.formLoading.set(true);
    this.formError.set('');
    this.formSuccess.set('');

    this.api.blockIp(ip, reason, this.formDurationHours ?? undefined).subscribe({
      next: () => {
        this.formLoading.set(false);
        this.formSuccess.set(`IP ${ip} bloqueada correctamente.`);
        this.formIp = '';
        this.formReason = '';
        this.formDurationHours = 24;
        this.refresh();
      },
      error: (err) => {
        this.formLoading.set(false);
        const msg = err?.error?.error;
        if (msg === 'This IP already has an active block') {
          this.formError.set('Esta IP ya tiene un bloqueo activo.');
        } else {
          this.formError.set('Error al bloquear la IP. Intenta de nuevo.');
        }
      },
    });
  }

  // ── Desbloqueo ────────────────────────────────────────────────────────────

  requestUnblock(ip: string): void {
    this.confirmingIp.set(ip);
    this.unblockError.set('');
  }

  cancelUnblock(): void {
    this.confirmingIp.set(null);
    this.unblockError.set('');
  }

  confirmUnblock(): void {
    const ip = this.confirmingIp();
    if (!ip) return;

    this.unblockLoading.set(true);
    this.unblockError.set('');

    this.api.unblockIp(ip).subscribe({
      next: () => {
        this.unblockLoading.set(false);
        this.confirmingIp.set(null);
        this.refresh();
      },
      error: (err) => {
        this.unblockLoading.set(false);
        const msg = err?.error?.error;
        if (msg === 'No active block found for this IP') {
          this.unblockError.set('No hay un bloqueo activo para esta IP.');
        } else {
          this.unblockError.set('Error al desbloquear. Intenta de nuevo.');
        }
      },
    });
  }

  // ── Helpers de presentación ───────────────────────────────────────────────

  blockedByClass(blockedBy: string): string {
    return blockedBy === 'auto'
      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
  }

  releasedByClass(releasedBy: string | null): string {
    if (releasedBy === 'expired') {
      return 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
    if (releasedBy === 'admin') {
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    }
    return '';
  }

  permanentLabel(entry: IpBlockEntry): string {
    if (!entry.blocked_until) return '∞ Permanente';
    return '';
  }
}
