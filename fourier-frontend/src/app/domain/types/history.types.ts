export interface HistoryEntry {
  id: string;
  userId: string;
  ipAddress?: string | null;
  type: string;
  input: Record<string, unknown>;
  executionMs: number;
  /** Última vez que se calculó este input (= last_calculated_at en BD). */
  createdAt: string;
  /** Primera vez que se calculó este input. */
  firstCalculatedAt: string;
  /** Cuántas veces se ha recalculado el mismo input. */
  count: number;
  isFavorite: boolean;
  favoriteName: string | null;
}

export interface HistoryListResponse {
  entries: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
  isLimited?: boolean;
  historyLimit?: { max: number; favorites: number };
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  favorites?: boolean;
}
