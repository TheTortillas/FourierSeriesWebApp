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
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  anonymousOnly?: boolean;
}

export interface AdminHistoryQuery {
  limit?: number;
  offset?: number;
  userId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  favoritesOnly?: boolean;
  anonymousOnly?: boolean;
  minExecutionMs?: number;
}

export interface SystemTableSizes {
  calculations: string;
  calculation_events: string;
  audit_log: string;
  user_refresh_tokens: string;
}

export interface SystemDiskStats {
  total: string;
  used: string;
  free: string;
  usedPercent: number;
}

export interface SystemStats {
  database: {
    totalSize: string;
    tables: SystemTableSizes;
  };
  disk: SystemDiskStats;
}

export interface RateLimitMetricsSnapshot {
  startedAt: string;
  requestsByBucket: {
    compute: number;
    parse: number;
    auth: number;
  };
  blockedByBucket: {
    compute: number;
    parse: number;
    auth: number;
  };
  requestsByEndpoint: Record<string, number>;
  blockedByEndpoint: Record<string, number>;
  blockedByLimiter: Record<string, number>;
  ratios: {
    compute: number;
    parse: number;
    auth: number;
  };
}

export interface CacheStats {
  backend: 'redis' | 'lru';
  connected: boolean;
  size: number;
  /** -1 means Redis (unbounded by entry count) */
  max: number;
  ttlDays: number;
  version: string;
}

export interface FeedbackStats {
  total:      number;
  byCategory: { category: string; count: number }[];
  byRating:   { rating: number;   count: number }[];
  byDay:      { day: string;      count: number }[];
}

export interface SurveyStats {
  total:        number;
  byRole:       { role: string;        count: number }[];
  topCountries: { country: string;     count: number }[];
  byHowFound:   { how_found: string;   count: number }[];
  byPurpose:    { purpose: string;     count: number }[];
  byFeature:    { feature: string;     count: number }[];
  byDevice:     { device: string;      count: number }[];
  usedPrevious: { used_previous: boolean; count: number }[];
  improvements: { improvement: string; count: number }[];
  avgRatings:   { usefulness: number; ease: number; vs_other: number; recommend: number };
  byDay:        { day: string;         count: number }[];
}

export const CALC_TYPE_LABEL: Record<string, string> = {
  trigonometric: 'Trigonométrica',
  half_range: 'Medio rango',
  complex: 'Compleja',
  fourier_transform: 'Transformada',
  inverse_fourier_transform: 'T. Inversa',
  dft_signal: 'DFT señal',
  dft_epicycles: 'DFT epiciclos',
};
