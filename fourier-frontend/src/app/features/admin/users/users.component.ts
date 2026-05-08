import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../../core/services/api/api.service';
import { AdminUser, AdminUsersQuery } from '../../../domain';
import { AdminDatePipe } from '../../../shared/pipes/admin-date.pipe';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-admin-users',
  templateUrl: './users.component.html',
  imports: [FormsModule, AdminDatePipe],
})
export class UsersComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading   = signal(false);
  readonly users     = signal<AdminUser[]>([]);
  readonly total     = signal(0);
  readonly offset    = signal(0);
  readonly pageSize  = PAGE_SIZE;

  // Filters — tipos estrictos para evitar casts al construir la query
  filterRole:   'user' | 'admin' | ''            = '';
  filterTier:   'free' | 'premium' | ''          = '';
  filterActive: 'true' | 'false' | ''            = '';

  // Optimistic action feedback
  readonly loadError      = signal(false);
  readonly actionMsg      = signal<{ id: string; msg: string } | null>(null);
  readonly actionErr      = signal<string | null>(null);
  readonly pendingDeactivate = signal<string | null>(null);

  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const query: AdminUsersQuery = { limit: this.pageSize, offset: this.offset() };
    if (this.filterRole)          query.role     = this.filterRole;
    if (this.filterTier)          query.tier     = this.filterTier;
    if (this.filterActive !== '') query.isActive = this.filterActive === 'true';

    this.api.getAdminUsers(query).subscribe({
      next: (res) => { this.users.set(res.entries); this.total.set(res.total); this.loading.set(false); },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  applyFilters(): void { this.offset.set(0); this.load(); }
  clearFilters(): void { this.filterRole = ''; this.filterTier = ''; this.filterActive = ''; this.applyFilters(); }
  prevPage(): void { this.offset.set(Math.max(0, this.offset() - this.pageSize)); this.load(); }
  nextPage(): void { this.offset.set(this.offset() + this.pageSize); this.load(); }

  changeTier(user: AdminUser): void {
    const newTier = user.tier === 'premium' ? 'free' : 'premium';
    this.api.updateUserTier(user.id, newTier).subscribe({
      next: () => {
        this.users.update((list) => list.map((u) => u.id === user.id ? { ...u, tier: newTier } : u));
        this.flash(user.id, `Tier → ${newTier}`);
      },
      error: () => this.flashErr('No se pudo cambiar el tier'),
    });
  }

  toggleActive(user: AdminUser): void {
    // Activar no requiere confirmación — es acción reversible y no destructiva
    if (!user.isActive) {
      this.api.activateUser(user.id).subscribe({
        next: () => {
          this.users.update((list) => list.map((u) => u.id === user.id ? { ...u, isActive: true } : u));
          this.flash(user.id, 'Activado');
        },
        error: () => this.flashErr('No se pudo activar el usuario'),
      });
      return;
    }

    // Desactivar: requiere doble clic para confirmar
    if (this.pendingDeactivate() !== user.id) {
      this.pendingDeactivate.set(user.id);
      setTimeout(() => {
        if (this.pendingDeactivate() === user.id) this.pendingDeactivate.set(null);
      }, 3000);
      return;
    }

    this.pendingDeactivate.set(null);
    this.api.deactivateUser(user.id).subscribe({
      next: () => {
        this.users.update((list) => list.map((u) => u.id === user.id ? { ...u, isActive: false } : u));
        this.flash(user.id, 'Desactivado');
      },
      error: () => this.flashErr('No se pudo desactivar el usuario'),
    });
  }

  private flash(id: string, msg: string): void {
    this.actionMsg.set({ id, msg });
    setTimeout(() => this.actionMsg.set(null), 2500);
  }

  private flashErr(msg: string): void {
    this.actionErr.set(msg);
    setTimeout(() => this.actionErr.set(null), 3000);
  }

  readonly copiedId = signal<string | null>(null);

  copyId(id: string): void {
    navigator.clipboard.writeText(id).then(() => {
      this.copiedId.set(id);
      setTimeout(() => this.copiedId.set(null), 1500);
    });
  }
}
