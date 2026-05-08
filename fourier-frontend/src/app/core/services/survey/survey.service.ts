import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SurveyRequest } from '../../../domain';

const DONE_KEY = 'fwc_survey_done';

@Injectable({ providedIn: 'root' })
export class SurveyService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PLATFORM_ID);
  private readonly base = environment.apiUrl;

  readonly promptOpen  = signal(false);
  readonly submitting  = signal(false);
  readonly submitted   = signal(false);

  hasDone(): boolean {
    if (!isPlatformBrowser(this.platform)) return true;
    return localStorage.getItem(DONE_KEY) === 'true';
  }

  tryPrompt(): void {
    if (!this.hasDone()) this.promptOpen.set(true);
  }

  dismissPrompt(): void {
    this.promptOpen.set(false);
  }

  submit(req: SurveyRequest): Observable<{ message: string }> {
    this.submitting.set(true);
    return this.http.post<{ message: string }>(`${this.base}/survey`, req).pipe(
      tap(() => {
        if (isPlatformBrowser(this.platform)) {
          localStorage.setItem(DONE_KEY, 'true');
        }
        this.submitted.set(true);
        this.submitting.set(false);
        this.promptOpen.set(false);
      }),
      catchError((err) => {
        this.submitting.set(false);
        return throwError(() => err);
      }),
    );
  }
}
