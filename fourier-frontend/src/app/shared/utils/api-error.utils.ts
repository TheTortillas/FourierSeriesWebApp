import { HttpErrorResponse } from '@angular/common/http';

/**
 * Formats an API error into a user-friendly string.
 * Handles 429 responses enriched with retryAfterSeconds / resetsAt
 * from the backend rate limiters.
 */
export function formatApiError(e: unknown, fallback: string): string {
  if (!(e instanceof HttpErrorResponse)) return fallback;

  const body = e.error as Record<string, unknown> | null;
  if (!body) return e.message || fallback;

  if (e.status === 429) {
    const resetsAt = body['resetsAt'] as string | undefined;
    const retryAfterSeconds = body['retryAfterSeconds'] as number | undefined;

    // Weekly quota limit — show reset date
    if (resetsAt) {
      const date = new Date(resetsAt);
      const formatted = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
      const upgradeAvailable = body['upgradeAvailable'] as boolean | undefined;
      const suffix = upgradeAvailable
        ? ' Considera mejorar tu plan para más cálculos.'
        : '';
      return `Límite semanal alcanzado. Tu cuota se renueva el ${formatted}.${suffix}`;
    }

    // IP rate limit — show remaining minutes
    if (retryAfterSeconds !== undefined) {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      return minutes <= 1
        ? 'Demasiadas solicitudes. Intenta de nuevo en un momento.'
        : `Demasiadas solicitudes. Intenta de nuevo en ${minutes} minutos.`;
    }
  }

  return (body['error'] as string | undefined) ?? e.message ?? fallback;
}
