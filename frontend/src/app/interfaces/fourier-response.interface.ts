export interface FourierResponse {
  simplified?: {
    a0?: string;
    an?: string;
    bn?: string;
    T?: string;
    w0?: string;
    series_cosine_core?: string;
    series_sine_core?: string;
  };
  latex?: {
    a0?: string;
    an?: string;
    bn?: string;
    T?: string;
    w0?: string;
    cosineCore?: string;
    sineCore?: string;
  };
  indeterminateValues?: {
    an?: Array<{ n: number; limit: string }>;
    bn?: Array<{ n: number; limit: string }>;
  };
  error?: string;
}
