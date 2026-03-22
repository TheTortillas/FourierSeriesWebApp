import { UserRole, UserTier } from './common.types';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tier: UserTier;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface AdminUsersQuery {
  limit?: number;
  offset?: number;
  role?: UserRole;
  tier?: UserTier;
  isActive?: boolean;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditQuery {
  limit?: number;
  offset?: number;
}

export interface AdminHistoryQuery {
  limit?: number;
  offset?: number;
  userId?: string;
  type?: string;
}
