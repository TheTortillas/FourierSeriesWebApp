export type AuditAction =
  | "login"
  | "logout"
  | "register"
  | "password_change"
  | "google_linked"
  | "google_unlinked"
  | "account_recovery_initiated"
  | "account_recovery_completed"
  | "calculation_performed"
  | "calculation_failed"
  | "transform_performed"
  | "transform_failed"
  | "user_deactivated"
  | "user_activated"
  | "tier_changed"
  | "audit_log_cleared";

export interface AuditLogInput {
  id?: string;
  userId?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt?: Date;
}

export interface IAuditRepository {
  log(input: AuditLogInput): Promise<void>;
  findByUser(userId: string, limit?: number): Promise<AuditLogInput[]>;
  findAll(limit?: number, offset?: number): Promise<AuditLogInput[]>;
  countAll(): Promise<number>;
  clearByAction(action: AuditAction, olderThanDays: number): Promise<number>;
}
