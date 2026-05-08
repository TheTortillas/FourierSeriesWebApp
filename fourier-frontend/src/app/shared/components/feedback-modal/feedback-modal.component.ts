import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { FeedbackService } from '../../../core/services/feedback/feedback.service';

@Component({
  selector: 'app-feedback-modal',
  imports: [FormsModule, TranslocoPipe],
  template: `
    @if (feedback.modalOpen()) {
      <div
        class="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-border dark:border-dark-border bg-paper dark:bg-dark-bg shadow-xl animate-slide-up"
        role="dialog"
        [attr.aria-label]="'feedback.modal.title' | transloco"
      >
        @if (!feedback.submitted()) {
          <div class="p-4 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-mono font-medium text-ink dark:text-dark-ink leading-snug">
                  {{ 'feedback.modal.title' | transloco }}
                </p>
                <p class="text-[11px] font-mono text-muted dark:text-dark-muted mt-0.5">
                  {{ 'feedback.modal.subtitle' | transloco }}
                </p>
              </div>
              <button
                type="button"
                (click)="feedback.closeModal()"
                [attr.aria-label]="'common.close' | transloco"
                class="shrink-0 p-1 rounded text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Stars -->
            <div class="flex items-center gap-1" [attr.aria-label]="'feedback.modal.ratingLabel' | transloco">
              @for (i of [1,2,3,4,5]; track i) {
                <button
                  type="button"
                  (click)="rating.set(i)"
                  (mouseenter)="hovered.set(i)"
                  (mouseleave)="hovered.set(0)"
                  class="text-xl transition-transform hover:scale-110 cursor-pointer leading-none"
                  [attr.aria-label]="i + ' / 5'"
                >
                  <span [class]="(hovered() || rating()) >= i ? 'text-yellow-400' : 'text-border dark:text-dark-border'">★</span>
                </button>
              }
            </div>

            <!-- Comment -->
            <textarea
              [(ngModel)]="comment"
              [placeholder]="'feedback.modal.placeholder' | transloco"
              maxlength="200"
              rows="2"
              class="w-full resize-none rounded border border-border dark:border-dark-border bg-paper2 dark:bg-dark-surface px-2.5 py-1.5 text-xs font-mono text-ink dark:text-dark-ink placeholder:text-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
            ></textarea>

            <!-- Actions -->
            <div class="flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="feedback.closeModal()"
                class="px-2.5 py-1 rounded text-[11px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface transition-colors cursor-pointer"
              >
                {{ 'feedback.modal.skip' | transloco }}
              </button>
              <button
                type="button"
                (click)="submit()"
                [disabled]="!rating() || feedback.submitting()"
                class="px-3 py-1 rounded bg-accent text-white text-[11px] font-mono hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {{ feedback.submitting() ? ('feedback.modal.submitting' | transloco) : ('feedback.modal.submit' | transloco) }}
              </button>
            </div>
          </div>
        } @else {
          <div class="p-4 flex flex-col items-center gap-2 text-center">
            <span class="text-2xl">✓</span>
            <p class="text-sm font-mono font-medium text-ink dark:text-dark-ink">
              {{ 'feedback.modal.successTitle' | transloco }}
            </p>
            <p class="text-[11px] font-mono text-muted dark:text-dark-muted">
              {{ 'feedback.modal.successMessage' | transloco }}
            </p>
            <button
              type="button"
              (click)="feedback.closeModal()"
              class="mt-1 px-3 py-1 rounded bg-paper2 dark:bg-dark-surface text-[11px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink transition-colors cursor-pointer"
            >
              {{ 'common.close' | transloco }}
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-slide-up { animation: slide-up 0.2s ease-out; }
  `],
})
export class FeedbackModalComponent {
  readonly feedback = inject(FeedbackService);

  readonly rating = signal(0);
  readonly hovered = signal(0);
  comment = '';

  submit(): void {
    if (!this.rating()) return;
    this.feedback
      .submit({
        category: 'rating',
        rating: this.rating(),
        message: this.comment.trim() || undefined,
      })
      .subscribe();
  }
}
