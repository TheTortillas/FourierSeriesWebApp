/**
 * Represents a mathematical expression returned by the backend,
 * always in two formats: LaTeX (for display) and Maxima (for computation).
 */
export interface SymbolicExpression {
  tex: string;
  maxima: string;
}

/**
 * A single piece of a piecewise function sent to the backend.
 * All values must be in Maxima syntax (not LaTeX).
 */
export interface Segment {
  expression: string;
  from: string;
  to: string;
}

/**
 * Generic paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Standard error response from the backend.
 */
export interface ApiError {
  error: string;
}

export type UserRole = 'user' | 'admin';
export type UserTier = 'free' | 'premium';
