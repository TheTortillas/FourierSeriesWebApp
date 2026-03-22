declare module 'tex2max' {
  interface Tex2MaxOptions {
    onlySingleVariables?: boolean;
    addTimesSign?: boolean;
    onlyGreekName?: boolean;
    onlyGreekSymbol?: boolean;
    disallowDecimalPoints?: boolean;
    disallowDecimalCommas?: boolean;
    handleEquation?: boolean;
    debugging?: boolean;
  }

  class Tex2Max {
    constructor(options?: Tex2MaxOptions);
    toMaxima(latex: string): string;
  }

  export default Tex2Max;
}
