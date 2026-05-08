import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { SurveyService } from '../../core/services/survey/survey.service';
import { SeoService } from '../../core/services/seo/seo.service';
import {
  SurveyRole, AcademicLevel, SurveyPurpose, SurveyFeature, SurveyDevice, HowFound,
  SurveyImprovement,
} from '../../domain';

const TOTAL_STEPS = 6;

@Component({
  selector: 'app-survey',
  imports: [NavComponent, FormsModule, TranslocoPipe, DecimalPipe],
  templateUrl: './survey.component.html',
})
export class SurveyComponent {
  private readonly seo       = inject(SeoService);
  private readonly router    = inject(Router);
  private readonly transloco = inject(TranslocoService);
  readonly surveySvc         = inject(SurveyService);

  readonly step       = signal(1);
  readonly totalSteps = TOTAL_STEPS;
  readonly progress   = computed(() => (this.step() / TOTAL_STEPS) * 100);
  readonly error      = signal('');

  // Step 1 — Role
  role: SurveyRole | '' = '';
  roleOther = '';

  // Step 2 — Academic details
  academicLevel: AcademicLevel | '' = '';
  academicLevelOther = '';
  institution = '';
  career = '';
  country = '';

  // Step 3 — Experience
  howFound: HowFound | '' = '';
  howFoundOther = '';
  purposesUsed: SurveyPurpose[] = [];
  purposeOther = '';
  featuresUsed: SurveyFeature[] = [];
  devicesUsed: SurveyDevice[] = [];

  // Step 4 — Previous version
  usedPrevious: boolean | null = null;
  improvements: SurveyImprovement[] = [];
  improvementsOther = '';
  regressions = '';

  // Step 5 — Ratings
  usefulnessRating  = 0;
  easeOfUseRating   = 0;
  vsOtherToolsRating = 0;
  recommendRating   = 0;

  // Step 6 — Open
  bugDescription  = '';
  generalComments = '';

  constructor() {
    this.seo.setNoIndex();
  }

  get lang(): string { return this.transloco.getActiveLang(); }

  canAdvance(): boolean {
    switch (this.step()) {
      case 1:
        return this.role !== '' && (this.role !== 'other' || this.roleOther.trim() !== '');
      case 2:
        return this.academicLevel !== '' &&
          (this.academicLevel !== 'other' || this.academicLevelOther.trim() !== '') &&
          this.country.trim() !== '';
      case 3:
        return this.howFound !== '' &&
          (this.howFound !== 'other' || this.howFoundOther.trim() !== '') &&
          this.purposesUsed.length > 0 &&
          (!this.purposesUsed.includes('other') || this.purposeOther.trim() !== '') &&
          this.featuresUsed.length > 0 &&
          this.devicesUsed.length > 0;
      case 4:
        return this.usedPrevious !== null;
      case 5:
        return this.getRating('usefulness') > 0 && this.getRating('ease') > 0 &&
          this.getRating('vsOther') > 0 && this.getRating('recommend') > 0;
      default: return true;
    }
  }

  next(): void {
    if (!this.canAdvance()) return;
    this.error.set('');
    this.step.update((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  back(): void {
    this.error.set('');
    this.step.update((s) => Math.max(s - 1, 1));
  }

  toggleFeature(f: SurveyFeature): void {
    const none: SurveyFeature = 'none';
    if (f === none) {
      this.featuresUsed = this.featuresUsed.includes(none) ? [] : [none];
      return;
    }
    const idx = this.featuresUsed.indexOf(f);
    if (idx === -1) {
      this.featuresUsed = [...this.featuresUsed.filter((x) => x !== none), f];
    } else {
      this.featuresUsed = this.featuresUsed.filter((x) => x !== f);
    }
  }

  hasFeature(f: SurveyFeature): boolean { return this.featuresUsed.includes(f); }

  togglePurpose(p: SurveyPurpose): void {
    const idx = this.purposesUsed.indexOf(p);
    this.purposesUsed = idx === -1
      ? [...this.purposesUsed, p]
      : this.purposesUsed.filter((x) => x !== p);
  }
  hasPurpose(p: SurveyPurpose): boolean { return this.purposesUsed.includes(p); }

  toggleDevice(d: SurveyDevice): void {
    const idx = this.devicesUsed.indexOf(d);
    this.devicesUsed = idx === -1
      ? [...this.devicesUsed, d]
      : this.devicesUsed.filter((x) => x !== d);
  }
  hasDevice(d: SurveyDevice): boolean { return this.devicesUsed.includes(d); }

  toggleImprovement(i: SurveyImprovement): void {
    const idx = this.improvements.indexOf(i);
    this.improvements = idx === -1
      ? [...this.improvements, i]
      : this.improvements.filter((x) => x !== i);
  }
  hasImprovement(i: SurveyImprovement): boolean { return this.improvements.includes(i); }

  submit(): void {
    if (this.surveySvc.submitting()) return;
    this.error.set('');
    this.syncRatings();

    const levelOther = this.academicLevel === 'other' ? this.academicLevelOther.trim() : undefined;

    this.surveySvc.submit({
      role: this.role as SurveyRole,
      roleOther: this.role === 'other' ? this.roleOther.trim() : undefined,
      academicLevel: this.academicLevel as AcademicLevel,
      academicLevelOther: levelOther,
      institution: this.institution.trim() || undefined,
      career: this.career.trim() || undefined,
      country: this.country.trim(),
      howFound: this.howFound as HowFound,
      howFoundOther: this.howFound === 'other' ? this.howFoundOther.trim() : undefined,
      purpose: this.purposesUsed,
      purposeOther: this.purposesUsed.includes('other') ? this.purposeOther.trim() : undefined,
      featuresUsed: this.featuresUsed,
      device: this.devicesUsed,
      usedPrevious: this.usedPrevious as boolean,
      improvements: this.usedPrevious && this.improvements.length > 0 ? this.improvements : undefined,
      improvementsOther: this.usedPrevious && this.improvements.includes('other') ? this.improvementsOther.trim() || undefined : undefined,
      regressions: this.usedPrevious && this.regressions.trim() ? this.regressions.trim() : undefined,
      usefulnessRating:   this.usefulnessRating,
      easeOfUseRating:    this.easeOfUseRating,
      vsOtherToolsRating: this.vsOtherToolsRating,
      recommendRating:    this.recommendRating,
      bugDescription:    this.bugDescription.trim() || undefined,
      generalComments:   this.generalComments.trim() || undefined,
    }).subscribe({
      error: () => this.error.set(this.transloco.translate('errors.generic')),
    });
  }

  goHome(): void { void this.router.navigate(['/', this.lang, 'home']); }

  readonly roles: SurveyRole[]       = ['student', 'teacher', 'graduate', 'other'];
  readonly levels: AcademicLevel[]   = ['licenciatura', 'maestria', 'doctorado', 'other'];
  readonly howFoundOptions: HowFound[] = ['search', 'recommendation_peer', 'recommendation_teacher', 'social', 'other'];
  readonly purposes: SurveyPurpose[] = ['problem', 'learning', 'teaching', 'exploration', 'other'];

  // Grouped for clarity in the template
  readonly featuresSeries: SurveyFeature[]    = ['trigonometric', 'half_range', 'complex'];
  readonly featuresCont: SurveyFeature[]      = ['fourier_transform', 'inverse_fourier_transform'];
  readonly featuresDft: SurveyFeature[]       = ['dft_signal', 'dft_function', 'dft_epicycles'];
  readonly featuresNone: SurveyFeature[]      = ['none'];

  readonly devices: SurveyDevice[] = ['phone', 'computer'];
  readonly stars = [1, 2, 3, 4, 5];

  readonly improvementOptions: SurveyImprovement[] = ['ui', 'features', 'speed', 'results_clarity', 'other'];

  readonly ratingConfigs = [
    { key: 'usefulness',  label: 'survey.s5.usefulnessLabel',   hint: 'survey.s5.usefulnessHint' },
    { key: 'ease',        label: 'survey.s5.easeLabel',         hint: 'survey.s5.easeHint' },
    { key: 'vsOther',     label: 'survey.s5.vsOtherLabel',      hint: 'survey.s5.vsOtherHint' },
    { key: 'recommend',   label: 'survey.s5.recommendLabel',    hint: 'survey.s5.recommendHint' },
  ] as const;

  private ratingValues: Record<string, number> = { usefulness: 0, ease: 0, vsOther: 0, recommend: 0 };
  private hoverValues:  Record<string, number> = { usefulness: 0, ease: 0, vsOther: 0, recommend: 0 };

  getRating(key: string): number  { return this.ratingValues[key] ?? 0; }
  getHover(key: string): number   { return this.hoverValues[key] ?? 0; }
  setRating(key: string, v: number): void { this.ratingValues[key] = v; }
  setHover(key: string, v: number): void  { this.hoverValues[key] = v; }

  // Sync rating maps back to typed fields before submit
  private syncRatings(): void {
    this.usefulnessRating   = this.ratingValues['usefulness'] ?? 0;
    this.easeOfUseRating    = this.ratingValues['ease'] ?? 0;
    this.vsOtherToolsRating = this.ratingValues['vsOther'] ?? 0;
    this.recommendRating    = this.ratingValues['recommend'] ?? 0;
  }
}
