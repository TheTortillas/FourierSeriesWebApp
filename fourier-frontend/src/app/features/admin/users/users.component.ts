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
  readonly actionMsg = signal<{ id: string; msg: string } | null>(null);

  readonly totalPages  = computed(() => Math.ceil(this.total() / this.pageSize));
  readonly currentPage = computed(() => Math.floor(this.offset() / this.pageSize) + 1);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const query: AdminUsersQuery = { limit: this.pageSize, offset: this.offset() };
    if (this.filterRole)          query.role     = this.filterRole;
    if (this.filterTier)          query.tier     = this.filterTier;
    if (this.filterActive !== '') query.isActive = this.filterActive === 'true';

    this.api.getAdminUsers(query).subscribe({
      next: (res) => { this.users.set(res.entries); this.total.set(res.total); this.loading.set(false); },
      error: () => this.loading.set(false),
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
    });
  }

  toggleActive(user: AdminUser): void {
    const action$ = user.isActive ? this.api.deactivateUser(user.id) : this.api.activateUser(user.id);
    action$.subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
        this.flash(user.id, user.isActive ? 'Desactivado' : 'Activado');
      },
    });
  }

  private flash(id: string, msg: string): void {
    this.actionMsg.set({ id, msg });
    setTimeout(() => this.actionMsg.set(null), 2500);
  }

  copyId(id: string): void { navigator.clipboard.writeText(id); }
}
