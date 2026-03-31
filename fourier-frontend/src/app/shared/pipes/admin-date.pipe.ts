import { Pipe, PipeTransform } from '@angular/core';

type AdminDateFormat = 'short' | 'seconds' | 'date';

/**
 * Formatea fechas ISO en el panel admin.
 *
 * - 'short'   (default): dd MMM HH:mm          — dashboard, historial
 * - 'seconds': dd MMM HH:mm:ss                  — audit log
 * - 'date':    dd MMM yyyy (sin hora)            — fechas de registro
 */
@Pipe({ name: 'adminDate', standalone: true })
export class AdminDatePipe implements PipeTransform {
  transform(value: string | Date | undefined | null, format: AdminDateFormat = 'short'): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';

    if (format === 'date') {
      return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return d.toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      ...(format === 'seconds' ? { second: '2-digit' } : {}),
    });
  }
}
