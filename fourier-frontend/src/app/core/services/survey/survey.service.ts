import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SurveyRequest } from '../../../domain';
import { UserStore } from '../auth/user.store';

const DONE_KEY = 'fwc_survey_done';

@Injectable({ providedIn: 'root' })
export class SurveyService {
  private readonly http      = inject(HttpClient);
  private readonly platform  = inject(PLATFORM_ID);
  private readonly store     = inject(UserStore);
  private readonly base      = environment.apiUrl;

  readonly promptOpen  = signal(false);
  readonly submitting  = signal(false);
  readonly submitted   = signal(false);

  constructor() {
    // Re-evaluate visibility whenever auth state changes (login or logout).
    effect(() => {
      if (!this.store.initialized()) return;
      if (!this.store.isAuthenticated()) {
        this.promptOpen.set(false);
        this.submitted.set(false);
      } else if (this.store.hasDoneSurvey()) {
        this.promptOpen.set(false);
        // Don't reset submitted here — markSurveyDone() triggers this effect
        // immediately after a successful POST, which would wipe the success state.
      }
    });
  }

  hasDone(): boolean {
    if (!isPlatformBrowser(this.platform)) return true;
    // Usuarios autenticados: la fuente de verdad es el servidor (via UserStore).
    if (this.store.isAuthenticated()) return this.store.hasDoneSurvey();
    // Usuarios anónimos: localStorage es el único mecanismo disponible.
    return localStorage.getItem(DONE_KEY) === 'true';
  }

  tryPrompt(): void {
    if (!this.hasDone()) this.promptOpen.set(true);
  }

  dismissPrompt(): void {
    this.promptOpen.set(false);
  }

  submit(req: SurveyRequest): Observable<{ message: string }> {
    if (this.submitting() || this.submitted()) {
      return new Observable((obs) => obs.complete());
    }
    this.submitting.set(true);
    return this.http.post<{ message: string }>(`${this.base}/survey`, req).pipe(
      tap(() => {
        if (isPlatformBrowser(this.platform)) {
          localStorage.setItem(DONE_KEY, 'true');
        }
        this.store.markSurveyDone();
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
