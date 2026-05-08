import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NavComponent } from '../../shared/components/nav/nav.component';
import { SurveyService } from '../../core/services/survey/survey.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { UserStore } from '../../core/services/auth/user.store';
import {
  SurveyRole, AcademicLevel, SurveyPurpose, SurveyFeature, SurveyDevice
} from '../../domain';

const TOTAL_STEPS = 5;

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
  readonly userStore         = inject(UserStore);

  readonly step      = signal(1);
  readonly totalSteps = TOTAL_STEPS;
  readonly progress  = computed(() => (this.step() / TOTAL_STEPS) * 100);
  readonly error     = signal('');

  // Step 1 — Role
  role: SurveyRole | '' = '';
  roleOther = '';

  // Step 2 — Role-specific fields (reused across roles)
  academicLevel: AcademicLevel | '' = '';
  academicLevelOther = '';
  career = '';
  institution = '';

  // Step 3 — Experience
  purpose: SurveyPurpose | '' = '';
  purposeOther = '';
  featuresUsed: SurveyFeature[] = [];
  device: SurveyDevice | '' = '';
  usefulnessRating = 0;
  usefulnessHovered = 0;
  easeOfUseRating = 0;
  easeHovered = 0;

  // Step 4 — Comparison
  vsOtherToolsRating = 0;
  vsHovered = 0;
  recommendRating = 0;
  recommendHovered = 0;

  // Step 5 — Problems & comments
  bugDescription = '';
  generalComments = '';

  constructor() {
    this.seo.setNoIndex();
  }

  get lang(): string {
    return this.transloco.getActiveLang();
  }

  canAdvance(): boolean {
    switch (this.step()) {
      case 1: return this.role !== '' && (this.role !== 'other' || this.roleOther.trim() !== '');
      case 2: return this.academicLevel !== '' &&
                     (this.academicLevel !== 'other' || this.academicLevelOther.trim() !== '') &&
                     this.institution.trim() !== '';
      case 3: return this.purpose !== '' &&
                     (this.purpose !== 'other' || this.purposeOther.trim() !== '') &&
                     this.featuresUsed.length > 0 &&
                     this.device !== '' &&
                     this.usefulnessRating > 0 &&
                     this.easeOfUseRating > 0;
      case 4: return this.vsOtherToolsRating > 0 && this.recommendRating > 0;
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

  hasFeature(f: SurveyFeature): boolean {
    return this.featuresUsed.includes(f);
  }

  submit(): void {
    if (this.surveySvc.submitting()) return;
    this.error.set('');

    const base = {
      role: this.role as SurveyRole,
      roleOther: this.role === 'other' ? this.roleOther.trim() : undefined,
      purpose: this.purpose as SurveyPurpose,
      purposeOther: this.purpose === 'other' ? this.purposeOther.trim() : undefined,
      featuresUsed: this.featuresUsed,
      device: this.device as SurveyDevice,
      usefulnessRating: this.usefulnessRating,
      easeOfUseRating: this.easeOfUseRating,
      vsOtherToolsRating: this.vsOtherToolsRating,
      recommendRating: this.recommendRating,
      bugDescription: this.bugDescription.trim() || undefined,
      generalComments: this.generalComments.trim() || undefined,
    };

    const level = this.academicLevel as AcademicLevel;
    const levelOther = this.academicLevel === 'other' ? this.academicLevelOther.trim() : undefined;

    const roleFields = this.role === 'student'
      ? { studentLevel: level, studentLevelOther: levelOther, studentCareer: this.career.trim(), studentInstitution: this.institution.trim() }
      : this.role === 'teacher'
      ? { teacherLevel: level, teacherLevelOther: levelOther, teacherInstitution: this.institution.trim() }
      : this.role === 'graduate'
      ? { graduateLevel: level, graduateLevelOther: levelOther, graduateInstitution: this.institution.trim(), graduateCareer: this.career.trim() }
      : {};

    this.surveySvc.submit({ ...base, ...roleFields }).subscribe({
      error: () => this.error.set(this.transloco.translate('errors.generic')),
    });
  }

  goHome(): void {
    void this.router.navigate(['/', this.lang, 'home']);
  }

  readonly roles: SurveyRole[] = ['student', 'teacher', 'graduate', 'other'];
  readonly levels: AcademicLevel[] = ['licenciatura', 'maestria', 'doctorado', 'other'];
  readonly purposes: SurveyPurpose[] = ['problem', 'learning', 'teaching', 'exploration', 'other'];
  readonly features: SurveyFeature[] = ['trigonometric', 'half_range', 'complex', 'dft', 'none'];
  readonly devices: SurveyDevice[] = ['phone', 'computer'];
  readonly stars = [1, 2, 3, 4, 5];
}
