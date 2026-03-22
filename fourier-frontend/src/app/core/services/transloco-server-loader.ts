import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

/**
 * Loader estático para el contexto SSR.
 * Retorna un objeto vacío para evitar peticiones HTTP durante la
 * extracción de rutas y el renderizado en el servidor.
 * El cliente usa TranslocoHttpLoader para cargar las traducciones reales.
 */
@Injectable()
export class TranslocoServerLoader implements TranslocoLoader {
  getTranslation(_lang: string): Observable<Translation> {
    return of({});
  }
}
