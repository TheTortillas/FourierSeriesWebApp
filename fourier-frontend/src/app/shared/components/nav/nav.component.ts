import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { filter, map, startWith } from 'rxjs';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { UserStore } from '../../../core/services/auth/user.store';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PlatformService } from '../../../core/services/platform/platform.service';
import { SurveyService } from '../../../core/services/survey/survey.service';
import { FeedbackService } from '../../../core/services/feedback/feedback.service';
import { LANGUAGES, SUPPORTED_LANG_CODES, saveLang } from '../../../core/config/languages';

const BETA_BANNER_KEY = 'fwc_beta_banner_dismissed';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  templateUrl: './nav.component.html',
})
export class NavComponent {
  readonly theme     = inject(ThemeService);
  readonly userStore = inject(UserStore);
  readonly auth      = inject(AuthService);

  private readonly transloco    = inject(TranslocoService);
  private readonly router       = inject(Router);
  private readonly platform     = inject(PlatformService);
  private readonly surveySvc    = inject(SurveyService);
  private readonly feedbackSvc  = inject(FeedbackService);

  /** True while either the survey or the feedback hasn't been completed yet. */
  readonly hasEngagementPending = computed(() => {
    this.surveySvc.submitted();
    this.feedbackSvc.submitted();
    return !this.surveySvc.hasDone() || this.feedbackSvc.canShowModal();
  });

  readonly betaBannerVisible = signal(
    this.platform.getLocalStorageItem(BETA_BANNER_KEY) !== 'true',
  );

  dismissBetaBanner(): void {
    this.platform.setLocalStorageItem(BETA_BANNER_KEY, 'true');
    this.betaBannerVisible.set(false);
  }

  /** Active language as a reactive signal. */
  readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** All available languages — drives the dropdown list. */
  readonly languages = LANGUAGES;

  /** Controls the language dropdown visibility. */
  readonly langMenuOpen = signal(false);

  /** Controls the Fourier analysis dropdown visibility. */
  readonly fourierMenuOpen = signal(false);

  /** Controls the community/meta dropdown (feedback + survey). */
  readonly moreMenuOpen = signal(false);

  /** Regex to match the leading /:lang segment in the current URL. */
  private readonly langSegmentRe = new RegExp(
    `^\\/(${SUPPORTED_LANG_CODES.join('|')})(\\\/|$)`,
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { requireSync: true },
  );

  /** True when the active route belongs to the Fourier analysis section. */
  readonly isAnalysisActive = computed(() => {
    const url = this.currentUrl();
    return url.includes('/calculator') || url.includes('/transforms');
  });

  switchToLang(code: string): void {
    this.langMenuOpen.set(false);
    if (code === this.lang()) return;
    saveLang(code);
    const url = this.router.url.replace(this.langSegmentRe, `/${code}$2`);
    void this.router.navigateByUrl(url);
  }

  onLangMenuFocusOut(e: FocusEvent): void {
    const wrapper = e.currentTarget as HTMLElement;
    if (!e.relatedTarget || !wrapper.contains(e.relatedTarget as Node)) {
      this.langMenuOpen.set(false);
    }
  }

  onFourierMenuFocusOut(e: FocusEvent): void {
    const wrapper = e.currentTarget as HTMLElement;
    if (!e.relatedTarget || !wrapper.contains(e.relatedTarget as Node)) {
      this.fourierMenuOpen.set(false);
    }
  }

  onMoreMenuFocusOut(e: FocusEvent): void {
    const wrapper = e.currentTarget as HTMLElement;
    if (!e.relatedTarget || !wrapper.contains(e.relatedTarget as Node)) {
      this.moreMenuOpen.set(false);
    }
  }
}
