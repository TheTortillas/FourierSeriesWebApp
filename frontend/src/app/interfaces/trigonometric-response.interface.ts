export interface TrigonometricResponse {
  success?: boolean;
  simplified?: {
    a0?: string;
    an?: string;
    bn?: string;
    T?: string;
    w0?: string;
    series_cosine_core?: string;
    series_sine_core?: string;
  };
  nonIntegerCoeffs?: {
    a0?: string;
    an?: string;
    bn?: string;
  };
  latex?: {
    a0?: string;
    an?: string;
    bn?: string;
    T?: string;
    w0?: string;
    cosineCore?: string;
    sineCore?: string;
    nonInteger?: {
      a0?: string;
      an?: string;
      bn?: string;
    }
  };
  indeterminateValues?: {
    an?: Array<{ n: number; limit: string; limitTex: string }>;
    bn?: Array<{ n: number; limit: string; limitTex: string }>;
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
        a0?: {
          isIntegrable: boolean;
          hasSpecialFunctions: boolean;
          result: string;
        };
        an?: {
          isIntegrable: boolean;
          hasSpecialFunctions: boolean;
          result: string;
        };
        bn?: {
          isIntegrable: boolean;
          hasSpecialFunctions: boolean;
          result: string;
        };
      };
    }>;
    a0?: {
      isIntegrable: boolean;
      hasSpecialFunctions: boolean;
      result: string;
    };
    an?: {
      isIntegrable: boolean;
      hasSpecialFunctions: boolean;
      result: string;
    };
    bn?: {
      isIntegrable: boolean;
      hasSpecialFunctions: boolean;
      result: string;
    };
  };
}