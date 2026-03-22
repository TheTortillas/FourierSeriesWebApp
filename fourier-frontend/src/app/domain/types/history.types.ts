export interface HistoryEntry {
  id: string;
  userId: string;
  type: string;
  input: Record<string, unknown>;
  executionMs: number;
  createdAt: string;
  isFavorite: boolean;
  name?: string;
}

export interface HistoryListResponse {
  entries: HistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  favorites?: boolean;
}
