import { HttpErrorResponse } from '@angular/common/http';

/**
 * Formats an API error into a user-friendly string.
 * Handles 429 responses enriched with retryAfterSeconds / resetsAt
 * from the backend rate limiters.
 *
 * Pass `translate` + `lang` to get i18n-aware messages; otherwise the
 * function falls back to hardcoded Spanish strings.
 */
export function formatApiError(
  e: unknown,
  fallback: string,
  translate?: (key: string, params?: Record<string, unknown>) => string,
  lang?: string,
): string {
  if (!(e instanceof HttpErrorResponse)) return fallback;

  const body = e.error as Record<string, unknown> | null;
  if (!body) return e.message || fallback;

  if (e.status === 403 && body['code'] === 'EMAIL_NOT_VERIFIED') {
    return translate
      ? translate('errors.emailNotVerified')
      : 'Debes verificar tu correo antes de hacer cálculos.';
  }

  if (e.status === 429) {
    const resetsAt = body['resetsAt'] as string | undefined;
    const retryAfterSeconds = body['retryAfterSeconds'] as number | undefined;

    // Weekly quota limit — show reset date
    if (resetsAt) {
      const date = new Date(resetsAt);
      const formatted = date.toLocaleDateString(lang ?? 'es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
      if (translate) {
        return translate('errors.weeklyLimitReached', { date: formatted });
      }
      return `Límite semanal alcanzado. Tu cuota se renueva el ${formatted}.`;
    }

    // IP rate limit — show remaining minutes
    if (retryAfterSeconds !== undefined) {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      if (translate) {
        return minutes <= 1
          ? translate('errors.tooManyRequests')
          : translate('errors.tooManyRequestsMinutes', { minutes });
      }
      return minutes <= 1
        ? 'Demasiadas solicitudes. Intenta de nuevo en un momento.'
        : `Demasiadas solicitudes. Intenta de nuevo en ${minutes} minutos.`;
    }
  }

  return (body['error'] as string | undefined) ?? e.message ?? fallback;
}
