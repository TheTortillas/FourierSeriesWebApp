export interface ComplexResponse {
  success?: boolean;
  simplified?: {
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    series_exp_core?: string;
    series_exp_core_pos?: string;
    series_exp_core_neg?: string;
    coefficientList?: string;
    amplitudePhaseList?: string;
    seriesTerms?: string;
    demoivreTerms?: string;
  };
  latex?: {
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    series_exp_core?: string;
    series_exp_core_pos?: string;
    series_exp_core_neg?: string;
    terms?: string | string[]; // Updated to handle both formats
    demoivreTerms?: string | string[]; // Updated to handle both formats
  };
  indeterminateValues?: {
    cn?: Array<{ n: number; limit: string; limitTex: string }>;
  };
  error?: string;
  message?: string;
  validationDetails?: {
    isValid: boolean;
    pieces?: Array<{
      index: number;
      function: string;
      start: string;
      end: string;
      validation: {
        isValid: boolean;
        c0?: {
          isIntegrable: boolean;
          hasSpecialFunctions: boolean;
          result: string;
        };
        cn?: {
          isIntegrable: boolean;
          hasSpecialFunctions: boolean;
          result: string;
        };
      };
    }>;
    c0?: {
      isIntegrable: boolean;
      hasSpecialFunctions: boolean;
      result: string;
    };
    cn?: {
      isIntegrable: boolean;
      hasSpecialFunctions: boolean;
      result: string;
    };
  };
  seriesExpansionLatex?: {
    terms?: { [key: string]: string };
    demoivreTerms?: { [key: string]: string };
  };
}
