export interface FourierResponse {
  latex?: {
    a0?: string;
    an?: string;
    bn?: string;
    c0?: string;
    cn?: string;
    w0?: string;
  };
  numeric?: {
    a0?: number;
    a?: number[];
    b?: number[];
    c0?: number;
    c?: number[];
    w0?: number;
  };
  cores?: {
    trigonometric?: string;
    complex?: string;
    halfRangeCosine?: string;
    halfRangeSine?: string;
  };
  period?: number;
  error?: string;
}
