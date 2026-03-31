export interface TableSizes {
  calculation_history: string;
  audit_log: string;
  user_refresh_tokens: string;
}

export interface DiskStats {
  total: string;
  used: string;
  free: string;
  usedPercent: number;
}

export interface SystemStats {
  database: {
    totalSize: string;
    tables: TableSizes;
  };
  disk: DiskStats;
}

export interface ISystemRepository {
  getStats(): Promise<SystemStats>;
}
