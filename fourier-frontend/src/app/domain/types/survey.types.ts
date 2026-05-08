export type SurveyRole = 'student' | 'teacher' | 'graduate' | 'other';
export type AcademicLevel = 'licenciatura' | 'maestria' | 'doctorado' | 'other';
export type SurveyPurpose = 'problem' | 'learning' | 'teaching' | 'exploration' | 'other';
export type SurveyImprovement = 'ui' | 'features' | 'speed' | 'results_clarity' | 'other';
export type SurveyFeature =
  | 'trigonometric'
  | 'half_range'
  | 'complex'
  | 'fourier_transform'
  | 'inverse_fourier_transform'
  | 'dft_signal'
  | 'dft_function'
  | 'dft_epicycles'
  | 'none';
export type SurveyDevice = 'phone' | 'computer';
export type HowFound = 'search' | 'recommendation_peer' | 'recommendation_teacher' | 'social' | 'other';

export interface SurveyRequest {
  role: SurveyRole;
  roleOther?: string;

  // Step 2 — Academic details
  academicLevel: AcademicLevel;
  academicLevelOther?: string;
  institution?: string;
  career?: string;
  country: string;

  // Step 3 — Experience
  howFound: HowFound;
  howFoundOther?: string;
  purpose: SurveyPurpose[];
  purposeOther?: string;
  featuresUsed: SurveyFeature[];
  device: SurveyDevice[];

  // Step 4 — Previous version
  usedPrevious: boolean;
  improvements?: SurveyImprovement[];
  improvementsOther?: string;
  regressions?: string;

  // Step 5 — Ratings
  usefulnessRating: number;
  easeOfUseRating: number;
  vsOtherToolsRating: number;
  recommendRating: number;

  // Step 5 — Open
  bugDescription?: string;
  generalComments?: string;
}
