export type CalculationType =
  | "trigonometric"
  | "half_range"
  | "complex"
  | "fourier_transform"
  | "inverse_fourier_transform"
  | "dft_signal"
  | "dft_epicycles";

export interface HistoryRecord {
  id: string;
  userId: string;
  type: CalculationType;
  input: Record<string, unknown>;
  isFavorite: boolean;
  favoriteName: string | null;
  executionMs: number | null;
  createdAt: Date;
}

export interface IHistoryRepository {
  create(input: {
    userId: string;
    type: CalculationType;
    input: Record<string, unknown>;
    executionMs?: number;
  }): Promise<HistoryRecord>;
  findByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<HistoryRecord[]>;
  findById(id: string): Promise<HistoryRecord | null>;
  toggleFavorite(
    id: string,
    userId: string,
    name?: string,
  ): Promise<HistoryRecord>;
  delete(id: string, userId: string): Promise<void>;
  countByUser(userId: string): Promise<number>;
  findAll(
    limit: number,
    offset: number,
    filters?: {
      userId?: string;
      type?: CalculationType;
    },
  ): Promise<HistoryRecord[]>;
  countAll(filters?: {
    userId?: string;
    type?: CalculationType;
  }): Promise<number>;
}
