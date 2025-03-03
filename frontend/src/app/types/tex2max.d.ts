declare module 'tex2max' {
    interface TeX2MaxOptions {
      onlySingleVariables?: boolean;
      handleEquation?: boolean;
      addTimesSign?: boolean;
      disallowDecimalPoints?: boolean;
      disallowllowDecimalCommas?: boolean;
      onlyGreekName?: boolean;
      onlyGreekSymbol?: boolean;
      debugging?: boolean;
    }
  
    class TeX2Max {
      constructor(options: TeX2MaxOptions);
      toMaxima(latexInput: string): string;
    }
  
    export = TeX2Max;
  }