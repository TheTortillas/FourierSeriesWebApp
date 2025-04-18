export interface FourierResponse {
  success?: boolean;
  simplified?: {
    a0?: string;
    an?: string;
    bn?: string;
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    series_cosine_core?: string;
    series_sine_core?: string;
    series_exp_core?: string;
  };
  latex?: {
    a0?: string;
    an?: string;
    bn?: string;
    c0?: string;
    cn?: string;
    T?: string;
    w0?: string;
    cosineCore?: string;
    sineCore?: string;
    series_exp_core?: string;
  };
  indeterminateValues?: {
    an?: Array<{ n: number; limit: string; limitTex: string }>;
    bn?: Array<{ n: number; limit: string; limitTex: string }>;
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
}
