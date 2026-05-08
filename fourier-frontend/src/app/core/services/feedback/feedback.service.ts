import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { FeedbackRequest } from '../../../domain';

// 'fwc_feedback_done'  → 'true' when user submitted: never show again
// 'fwc_feedback_shown' → timestamp when dismissed without submitting: 14-day cooldown
const DONE_KEY     = 'fwc_feedback_done';
const COOLDOWN_KEY = 'fwc_feedback_shown';
const COOLDOWN_MS  = 14 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly api = inject(ApiService);
  private readonly platform = inject(PLATFORM_ID);

  readonly modalOpen  = signal(false);
  readonly submitting = signal(false);
  readonly submitted  = signal(false);

  canShowModal(): boolean {
    if (!isPlatformBrowser(this.platform)) return false;
    if (localStorage.getItem(DONE_KEY) === 'true') return false;
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > COOLDOWN_MS;
  }

  tryOpenModal(): void {
    if (this.canShowModal()) this.modalOpen.set(true);
  }

  closeModal(): void {
    if (isPlatformBrowser(this.platform)) {
      if (this.submitted()) {
        // Submitted → permanent block, remove the temporary cooldown entry
        localStorage.setItem(DONE_KEY, 'true');
        localStorage.removeItem(COOLDOWN_KEY);
      } else {
        // Dismissed without submitting → 14-day cooldown
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      }
    }
    this.modalOpen.set(false);
    this.submitted.set(false);
  }

  submit(req: FeedbackRequest): Observable<{ message: string }> {
    this.submitting.set(true);
    return this.api.submitFeedback(req).pipe(
      tap(() => {
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
