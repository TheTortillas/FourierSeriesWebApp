import { promises as fs } from "fs";
import { db } from "../database/db";
import type {
  ISystemRepository,
  SystemStats,
} from "../../domain/interfaces/repositories/ISystemRepository";

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export class SystemRepository implements ISystemRepository {
  async getStats(): Promise<SystemStats> {
    const [dbSizeResult, tableSizesResult, diskStats] = await Promise.all([
      db.query<{ db_size: string }>(
        `SELECT pg_size_pretty(pg_database_size('fourier_db')) AS db_size`,
      ),
      db.query<{ table_name: string; pretty_size: string }>(
        `SELECT
           t.table_name,
           pg_size_pretty(pg_relation_size(t.table_name::regclass)) AS pretty_size
         FROM (VALUES
           ('calculations'),
           ('calculation_events'),
           ('audit_log'),
           ('user_refresh_tokens')
         ) AS t(table_name)`,
      ),
      fs.statfs("/"),
    ]);

    const tableSizeMap: Record<string, string> = {};
    for (const row of tableSizesResult.rows) {
      tableSizeMap[row.table_name] = row.pretty_size;
    }

    const blockSize  = diskStats.bsize;
    const totalBytes = diskStats.blocks  * blockSize;
    const freeBytes  = diskStats.bfree   * blockSize;
    const usedBytes  = totalBytes - freeBytes;

    return {
      database: {
        totalSize: dbSizeResult.rows[0]!.db_size,
        tables: {
          calculations:         tableSizeMap["calculations"]         ?? "0 bytes",
          calculation_events:   tableSizeMap["calculation_events"]   ?? "0 bytes",
          audit_log:            tableSizeMap["audit_log"]            ?? "0 bytes",
          user_refresh_tokens:  tableSizeMap["user_refresh_tokens"]  ?? "0 bytes",
        },
      },
      disk: {
        total:       formatBytes(totalBytes),
        used:        formatBytes(usedBytes),
        free:        formatBytes(freeBytes),
        usedPercent: Math.round((usedBytes / totalBytes) * 100),
      },
    };
  }
}
