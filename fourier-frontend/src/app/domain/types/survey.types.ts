export type SurveyRole = 'student' | 'teacher' | 'graduate' | 'other';
export type AcademicLevel = 'licenciatura' | 'maestria' | 'doctorado' | 'other';
export type SurveyPurpose = 'problem' | 'learning' | 'teaching' | 'exploration' | 'other';
export type SurveyFeature = 'trigonometric' | 'half_range' | 'complex' | 'dft' | 'none';
export type SurveyDevice = 'phone' | 'computer';

export interface SurveyRequest {
  role: SurveyRole;
  roleOther?: string;

  // Student
  studentLevel?: AcademicLevel;
  studentLevelOther?: string;
  studentCareer?: string;
  studentInstitution?: string;

  // Teacher
  teacherLevel?: AcademicLevel;
  teacherLevelOther?: string;
  teacherInstitution?: string;

  // Graduate
  graduateLevel?: AcademicLevel;
  graduateLevelOther?: string;
  graduateInstitution?: string;
  graduateCareer?: string;

  // Experience
  purpose: SurveyPurpose;
  purposeOther?: string;
  featuresUsed: SurveyFeature[];
  device: SurveyDevice;
  usefulnessRating: number;
  easeOfUseRating: number;

  // Comparison
  vsOtherToolsRating: number;
  recommendRating: number;

  // Problems & comments
  bugDescription?: string;
  generalComments?: string;
}
