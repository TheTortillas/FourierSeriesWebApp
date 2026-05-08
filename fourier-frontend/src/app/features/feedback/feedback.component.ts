import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { FeedbackService } from '../../core/services/feedback/feedback.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { UserStore } from '../../core/services/auth/user.store';
import { FeedbackCategory } from '../../domain';

interface CategoryOption {
  value: FeedbackCategory;
  labelKey: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'bug',        labelKey: 'feedback.page.categories.bug',        icon: '🐛' },
  { value: 'suggestion', labelKey: 'feedback.page.categories.suggestion',  icon: '💡' },
  { value: 'question',   labelKey: 'feedback.page.categories.question',    icon: '❓' },
  { value: 'other',      labelKey: 'feedback.page.categories.other',       icon: '📝' },
];

@Component({
  selector: 'app-feedback',
  imports: [NavComponent, FormsModule, TranslocoPipe],
  template: `
    <app-nav />
    <main class="min-h-[calc(100vh-3rem)] flex items-start justify-center px-4 py-12">
      <div class="w-full max-w-lg">

        @if (!submitted()) {
          <div class="mb-8">
            <h1 class="font-display text-2xl text-ink dark:text-dark-ink">
              {{ 'feedback.page.title' | transloco }}
            </h1>
            <p class="mt-1 text-sm font-mono text-muted dark:text-dark-muted">
              {{ 'feedback.page.subtitle' | transloco }}
            </p>
          </div>

          <form (ngSubmit)="submit()" class="flex flex-col gap-5">

            <!-- Category -->
            <fieldset>
              <legend class="text-xs font-mono text-muted dark:text-dark-muted mb-2">
                {{ 'feedback.page.category' | transloco }}
              </legend>
              <div class="grid grid-cols-2 gap-2">
                @for (cat of categories; track cat.value) {
                  <button
                    type="button"
                    (click)="category.set(cat.value)"
                    [class]="category() === cat.value
                      ? 'flex items-center gap-2 px-3 py-2 rounded border border-accent bg-accent/8 text-accent text-xs font-mono transition-colors cursor-pointer'
                      : 'flex items-center gap-2 px-3 py-2 rounded border border-border dark:border-dark-border text-muted dark:text-dark-muted text-xs font-mono hover:border-accent/50 hover:text-ink dark:hover:text-dark-ink transition-colors cursor-pointer'"
                  >
                    <span>{{ cat.icon }}</span>
                    <span>{{ cat.labelKey | transloco }}</span>
                  </button>
                }
              </div>
            </fieldset>

            <!-- Rating (optional) -->
            <div>
              <p class="text-xs font-mono text-muted dark:text-dark-muted mb-2">
                {{ 'feedback.page.rating' | transloco }}
              </p>
              <div class="flex items-center gap-1">
                @for (i of [1,2,3,4,5]; track i) {
                  <button
                    type="button"
                    (click)="rating.set(rating() === i ? 0 : i)"
                    (mouseenter)="hovered.set(i)"
                    (mouseleave)="hovered.set(0)"
                    class="text-2xl transition-transform hover:scale-110 cursor-pointer leading-none"
                    [attr.aria-label]="i + ' / 5'"
                  >
                    <span [class]="(hovered() || rating()) >= i ? 'text-yellow-400' : 'text-border dark:text-dark-border'">★</span>
                  </button>
                }
                @if (rating()) {
                  <button
                    type="button"
                    (click)="rating.set(0)"
                    class="ml-2 text-[11px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                }
              </div>
            </div>

            <!-- Message -->
            <div>
              <label class="text-xs font-mono text-muted dark:text-dark-muted mb-1.5 block">
                {{ 'feedback.page.message' | transloco }}
                <span class="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                [(ngModel)]="message"
                name="message"
                required
                minlength="5"
                maxlength="2000"
                rows="5"
                [placeholder]="'feedback.page.messagePlaceholder' | transloco"
                class="w-full resize-none rounded border border-border dark:border-dark-border bg-paper2 dark:bg-dark-surface px-3 py-2 text-sm font-mono text-ink dark:text-dark-ink placeholder:text-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
              ></textarea>
              <p class="text-right text-[10px] font-mono text-muted dark:text-dark-muted mt-0.5">
                {{ message.length }} / 2000
              </p>
            </div>

            <!-- Email (optional) -->
            <div>
              <label class="text-xs font-mono text-muted dark:text-dark-muted mb-1.5 block">
                {{ 'feedback.page.email' | transloco }}
              </label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                [placeholder]="'feedback.page.emailPlaceholder' | transloco"
                class="w-full rounded border border-border dark:border-dark-border bg-paper2 dark:bg-dark-surface px-3 py-2 text-sm font-mono text-ink dark:text-dark-ink placeholder:text-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>

            @if (error()) {
              <p class="text-xs font-mono text-red-500">{{ error() }}</p>
            }

            <!-- Submit -->
            <button
              type="submit"
              [disabled]="!message.trim() || message.length < 5 || feedbackSvc.submitting()"
              class="w-full py-2.5 rounded bg-accent text-white text-sm font-mono hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {{ feedbackSvc.submitting()
                ? ('feedback.page.submitting' | transloco)
                : ('feedback.page.submit' | transloco) }}
            </button>

          </form>
        } @else {
          <div class="flex flex-col items-center gap-4 py-16 text-center">
            <span class="text-5xl">✓</span>
            <h2 class="font-display text-xl text-ink dark:text-dark-ink">
              {{ 'feedback.page.successTitle' | transloco }}
            </h2>
            <p class="text-sm font-mono text-muted dark:text-dark-muted max-w-xs">
              {{ 'feedback.page.successMessage' | transloco }}
            </p>
            <button
              type="button"
              (click)="reset()"
              class="mt-4 px-4 py-2 rounded border border-border dark:border-dark-border text-sm font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface transition-colors cursor-pointer"
            >
              {{ 'feedback.page.newFeedback' | transloco }}
            </button>
          </div>
        }

      </div>
    </main>
  `,
})
export class FeedbackComponent {
  private readonly seo = inject(SeoService);
  readonly feedbackSvc = inject(FeedbackService);
  private readonly userStore = inject(UserStore);

  readonly categories = CATEGORIES;
  readonly category = signal<FeedbackCategory>('suggestion');
  readonly rating = signal(0);
  readonly hovered = signal(0);
  readonly submitted = signal(false);
  readonly error = signal('');

  message = '';
  email = this.userStore.user()?.email ?? '';

  constructor() {
    this.seo.setNoIndex();
  }

  submit(): void {
    if (!this.message.trim() || this.message.length < 5) return;
    this.error.set('');

    this.feedbackSvc
      .submit({
        category: this.category(),
        rating: this.rating() || undefined,
        message: this.message.trim(),
        email: this.email.trim() || undefined,
      })
      .subscribe({
        next: () => this.submitted.set(true),
        error: () => this.error.set('errors.generic'),
      });
  }

  reset(): void {
    this.submitted.set(false);
    this.feedbackSvc.submitted.set(false);
    this.message = '';
    this.rating.set(0);
    this.category.set('suggestion');
  }
}
