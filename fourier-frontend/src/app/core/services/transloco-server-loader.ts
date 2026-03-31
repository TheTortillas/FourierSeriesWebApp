import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loader para el contexto SSR.
 * Lee los archivos JSON directamente del filesystem de Node.js en lugar
 * de hacer una petición HTTP, que no tiene sentido cuando el servidor
 * se llama a sí mismo.
 *
 * Prueba dos rutas en orden:
 *  1. dist/fourier-frontend/browser/assets/i18n/{lang}.json
 *     → usada durante `ng build` y prerendering (los assets ya están copiados)
 *  2. src/assets/i18n/{lang}.json
 *     → usada durante desarrollo con SSR (`ng serve --ssr`)
 */
@Injectable()
export class TranslocoServerLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const candidates = [
      join(process.cwd(), `dist/fourier-frontend/browser/assets/i18n/${lang}.json`),
      join(process.cwd(), `src/assets/i18n/${lang}.json`),
    ];

    for (const filePath of candidates) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        return of(JSON.parse(content) as Translation);
      } catch {
        // Prueba el siguiente candidato
      }
    }

    // Nunca debería llegar aquí en producción
    return of({});
  }
}
