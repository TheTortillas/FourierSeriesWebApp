import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { FeedbackRequest } from '../../../domain';
import { UserStore } from '../auth/user.store';

// 'fwc_feedback_done'  → 'true' when user submitted: never show again
// 'fwc_feedback_shown' → timestamp when dismissed without submitting: 14-day cooldown
const DONE_KEY     = 'fwc_feedback_done';
const COOLDOWN_KEY = 'fwc_feedback_shown';
const COOLDOWN_MS  = 14 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly api      = inject(ApiService);
  private readonly platform = inject(PLATFORM_ID);
  private readonly store    = inject(UserStore);

  readonly modalOpen  = signal(false);
  readonly submitting = signal(false);
  readonly submitted  = signal(false);

  canShowModal(): boolean {
    if (!isPlatformBrowser(this.platform)) return false;
    // Usuarios autenticados: la fuente de verdad es el servidor (via UserStore).
    if (this.store.isAuthenticated()) return !this.store.hasDoneFeedback();
    // Usuarios anónimos: localStorage con cooldown de 14 días.
    if (localStorage.getItem(DONE_KEY) === 'true') return false;
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > COOLDOWN_MS;
  }

  tryOpenModal(): void {
    if (this.canShowModal()) this.modalOpen.set(true);
  }

  /**
   * 'x'     → user closed without intent to return; no cooldown, modal shows again next time
   * 'later' → user wants to be asked again later; 14-day cooldown applied
   * 'done'  → called after successful submit (DONE_KEY already set); no extra storage writes
   */
  closeModal(reason: 'x' | 'later' | 'done' = 'x'): void {
    if (isPlatformBrowser(this.platform) && reason === 'later') {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    }
    this.modalOpen.set(false);
    this.submitted.set(false);
  }

  submit(req: FeedbackRequest): Observable<{ message: string }> {
    this.submitting.set(true);
    return this.api.submitFeedback(req).pipe(
      tap(() => {
        if (isPlatformBrowser(this.platform)) {
          localStorage.setItem(DONE_KEY, 'true');
          localStorage.removeItem(COOLDOWN_KEY);
        }
        // Actualiza el store inmediatamente para que canShowModal() refleje el cambio
        // en la misma sesión sin necesidad de un nuevo request al servidor.
        this.store.markFeedbackDone();
        this.submitted.set(true);
        this.submitting.set(false);
      }),
      catchError((err) => {
        this.submitting.set(false);
        return throwError(() => err);
      }),
    );
  }
}
