export type CalculationType =
  | "trigonometric"
  | "half_range"
  | "complex"
  | "fourier_transform"
  | "inverse_fourier_transform"
  | "dft_signal"
  | "dft_function"
  | "dft_epicycles";

/**
 * Representa un evento de cálculo tal como lo ve el dominio.
 *
 * - `id`                → calculation_events.id  (el ID que usa el cliente)
 * - `createdAt`         → last_calculated_at      (la vez más reciente)
 * - `firstCalculatedAt` → primera vez que se calculó este input
 * - `count`             → cuántas veces se ha recalculado el mismo input
 */
export interface HistoryRecord {
  id: string;
  userId: string | null;
  ipAddress: string | null;
  type: CalculationType;
  input: Record<string, unknown>;
  isFavorite: boolean;
  favoriteName: string | null;
  executionMs: number | null;
  count: number;
  createdAt: Date;           // = last_calculated_at
  firstCalculatedAt: Date;
}

export interface IHistoryRepository {
  /**
   * Registra un cálculo.  Si el mismo usuario/IP ya calculó este input
   * anteriormente, incrementa el contador y actualiza la fecha en lugar
   * de insertar una fila duplicada.
   */
  create(input: {
    userId?: string;
    ipAddress?: string;
    type: CalculationType;
    input: Record<string, unknown>;
    executionMs?: number;
  }): Promise<HistoryRecord>;

  findByUser(
    userId: string,
    limit: number,
    offset: number,
    favoritesOnly?: boolean,
  ): Promise<HistoryRecord[]>;

  findById(id: string): Promise<HistoryRecord | null>;

  toggleFavorite(
    id: string,
    userId: string,
    name?: string,
  ): Promise<HistoryRecord>;

  delete(id: string, userId: string): Promise<void>;

  countByUser(userId: string, favoritesOnly?: boolean): Promise<number>;

  findAll(
    limit: number,
    offset: number,
    filters?: {
      userId?: string;
      type?: CalculationType;
      anonymousOnly?: boolean;
      favoritesOnly?: boolean;
      dateFrom?: Date;
      dateTo?: Date;
      minExecutionMs?: number;
    },
  ): Promise<HistoryRecord[]>;

  countAll(filters?: {
    userId?: string;
    type?: CalculationType;
    anonymousOnly?: boolean;
    favoritesOnly?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    minExecutionMs?: number;
  }): Promise<number>;
}
