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
  error?: string;
}