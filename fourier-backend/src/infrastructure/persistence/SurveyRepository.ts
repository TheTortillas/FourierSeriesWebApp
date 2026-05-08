import { db } from "../database/db";

export interface SurveyInput {
  userId?:               string;
  ipAddress?:            string;
  // Paso 1
  role:                  string;
  roleOther?:            string;
  // Paso 2
  academicLevel:         string;
  academicLevelOther?:   string;
  institution?:          string;
  career?:               string;
  country:               string;
  // Paso 3
  howFound:              string;
  howFoundOther?:        string;
  purpose:               string[];
  purposeOther?:         string;
  featuresUsed:          string[];
  device:                string[];
  // Paso 4
  usedPrevious:          boolean;
  improvements?:         string[];
  improvementsOther?:    string;
  regressions?:          string;
  // Paso 5
  usefulnessRating:      number;
  easeOfUseRating:       number;
  vsOtherToolsRating:    number;
  recommendRating:       number;
  // Paso 6
  bugDescription?:       string;
  generalComments?:      string;
}

export class SurveyRepository {
  async create(input: SurveyInput): Promise<string> {
    const result = await db.query<{ id: string }>(
      `INSERT INTO survey_responses (
         user_id, ip_address,
         role, role_other,
         academic_level, academic_level_other, institution, career, country,
         how_found, how_found_other,
         purpose, purpose_other, features_used, device,
         used_previous, improvements, improvements_other, regressions,
         usefulness_rating, ease_of_use_rating, vs_other_tools_rating, recommend_rating,
         bug_description, general_comments
       ) VALUES (
         $1,  $2,
         $3,  $4,
         $5,  $6,  $7,  $8,  $9,
         $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20, $21, $22, $23,
         $24, $25
       ) RETURNING id`,
      [
        input.userId             ?? null,
        input.ipAddress          ?? null,
        input.role,
        input.roleOther          ?? null,
        input.academicLevel,
        input.academicLevelOther ?? null,
        input.institution        ?? null,
        input.career             ?? null,
        input.country,
        input.howFound,
        input.howFoundOther      ?? null,
        input.purpose,
        input.purposeOther       ?? null,
        input.featuresUsed,
        input.device,
        input.usedPrevious,
        input.improvements       ?? null,
        input.improvementsOther  ?? null,
        input.regressions        ?? null,
        input.usefulnessRating,
        input.easeOfUseRating,
        input.vsOtherToolsRating,
        input.recommendRating,
        input.bugDescription     ?? null,
        input.generalComments    ?? null,
      ],
    );
    return result.rows[0].id;
  }
}
