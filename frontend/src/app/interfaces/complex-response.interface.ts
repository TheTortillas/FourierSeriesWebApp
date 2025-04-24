export interface ComplexResponse {
  success?: boolean;
  simplified?: {
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    series_exp_core?: string;
  };
  latex?: {
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    series_exp_core?: string;
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
  coefficients?: {
    cnPositive?: Array<string>;
    cnNegative?: Array<string>;
    termsList?: Array<string>;
    demoivreSeries?: Array<string>;
    amplitudePhase?: Array<{ n: number; amplitude: string; phase: string }>;
  };
  latexCoefficients?: {
    cnPositive?: Array<string>;
    cnNegative?: Array<string>;
    termsList?: Array<string>;
    demoivreSeries?: Array<string>;
  };
}