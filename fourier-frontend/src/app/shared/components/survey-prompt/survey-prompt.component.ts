import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SurveyService } from '../../../core/services/survey/survey.service';

@Component({
  selector: 'app-survey-prompt',
  imports: [TranslocoPipe],
  template: `
    @if (survey.promptOpen()) {
      <div
        [class]="closing()
          ? 'fixed bottom-4 left-4 z-50 w-80 rounded-lg border border-border dark:border-dark-border bg-paper dark:bg-dark-bg shadow-xl animate-slide-down'
          : 'fixed bottom-4 left-4 z-50 w-80 rounded-lg border border-border dark:border-dark-border bg-paper dark:bg-dark-bg shadow-xl animate-slide-up'"
        role="dialog"
        [attr.aria-label]="'survey.prompt.title' | transloco"
      >
        <div class="p-4 flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-mono font-medium text-ink dark:text-dark-ink leading-snug">
                {{ 'survey.prompt.title' | transloco }}
              </p>
              <p class="text-[11px] font-mono text-muted dark:text-dark-muted mt-0.5">
                {{ 'survey.prompt.subtitle' | transloco }}
              </p>
            </div>
            <button
              type="button"
              (click)="dismiss()"
              [attr.aria-label]="'common.close' | transloco"
              class="shrink-0 p-1 rounded text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="dismiss()"
              class="px-2.5 py-1 rounded text-[11px] font-mono text-muted dark:text-dark-muted hover:text-ink dark:hover:text-dark-ink hover:bg-paper2 dark:hover:bg-dark-surface transition-colors cursor-pointer"
            >
              {{ 'survey.prompt.later' | transloco }}
            </button>
            <button
              type="button"
              (click)="goToSurvey()"
              class="px-3 py-1 rounded bg-accent text-white text-[11px] font-mono hover:bg-accent/90 transition-colors cursor-pointer"
            >
              {{ 'survey.prompt.start' | transloco }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-down {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(14px); }
    }
    .animate-slide-up   { animation: slide-up   0.2s ease-out forwards; }
    .animate-slide-down { animation: slide-down 0.2s ease-in  forwards; }
  `],
})
export class SurveyPromptComponent {
  readonly survey   = inject(SurveyService);
  private readonly router   = inject(Router);
  private readonly transloco = inject(TranslocoService);

  readonly closing = signal(false);

  private triggerClose(then?: () => void): void {
    if (this.closing()) return;
    this.closing.set(true);
    setTimeout(() => {
      this.closing.set(false);
      this.survey.dismissPrompt();
      then?.();
    }, 200);
  }

  dismiss(): void {
    this.triggerClose();
  }

  goToSurvey(): void {
    this.triggerClose(() => {
      void this.router.navigate(['/', this.transloco.getActiveLang(), 'survey']);
    });
  }
}
