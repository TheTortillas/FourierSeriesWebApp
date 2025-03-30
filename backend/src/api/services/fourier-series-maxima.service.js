const execMaxima = require("../utils/maxima.util");

// Helper function to build Maxima commands
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

exports.computeTrigonometricSeries = async (funcion, periodo, intVar) => {
  try {
    // Define common expressions including core functions
    const commonExprPart = `
      declare(n, integer)$
      w0: (2*(%pi))/(${periodo})$          
      series_cosine_core: cos(n*w0*${intVar})$
      series_sine_core: sin(n*w0*${intVar})$
    `;

    // Define expressions for a0, an, and bn
    const a0Expression = `
      ${commonExprPart}
      string(factor(ratsimp(
        (1/((${periodo})/2)) * integrate(${funcion}, ${intVar}, -(${periodo}/2), ${periodo}/2)
      )));
    `;
    const anExpression = `
      ${commonExprPart}
      string(factor(ratsimp(
        (1/((${periodo})/2)) * integrate((${funcion} * series_cosine_core), ${intVar}, -(${periodo}/2), ${periodo}/2)
      )));
    `;
    const bnExpression = `
      ${commonExprPart}
      string(factor(ratsimp(
        (1/((${periodo})/2)) * integrate((${funcion} * series_sine_core), ${intVar}, -(${periodo}/2), ${periodo}/2)
      )));
    `;

    // First, calculate the coefficients
    const [a0, an, bn] = await Promise.all([
      execMaxima(buildMaximaCommand(a0Expression)),
      execMaxima(buildMaximaCommand(anExpression)),
      execMaxima(buildMaximaCommand(bnExpression)),
    ]);

    // Then convert them to LaTeX
    const [a0Tex, anTex, bnTex] = await Promise.all([
      execMaxima(buildMaximaCommand(`tex(${a0}, false);`)),
      execMaxima(buildMaximaCommand(`tex(${an}, false);`)),
      execMaxima(buildMaximaCommand(`tex(${bn}, false);`)),
    ]);

    return {
      simplified: { a0, an, bn },
      latex: { a0: a0Tex, an: anTex, bn: bnTex },
    };
  } catch (error) {
    throw new Error(`Error computing trigonometric series: ${error.message}`);
  }
};

exports.computeComplexSeries = async (funcion, periodo, intVar) => {
  try {
    // Define common expressions including core functions
    const commonExprPart = `
      declare(n, integer)$
      w0: (2*(%pi))/(${periodo})$     
      series_exp_core: exp(-(%i*n*w0*${intVar}))$
      tellsimpafter(exp(%i*%pi*n), (-1)**n)$
      tellsimpafter(exp(%i*2*%pi*n), 1)$
    `;

    // Define expressions for c0 and cn
    const c0Expression = `
      ${commonExprPart}
      string(factor(ratsimp(
        (1/${periodo}) * integrate(${funcion}, ${intVar}, -(${periodo}/2), ${periodo}/2)
      )));
    `;
    const cnExpression = `
      ${commonExprPart}
      string(factor(ratsimp(
        (1/${periodo}) * integrate((${funcion} * series_exp_core), ${intVar}, -(${periodo}/2), ${periodo}/2)
      )));
    `;

    const [c0, cn] = await Promise.all([
      execMaxima(buildMaximaCommand(c0Expression)),
      execMaxima(buildMaximaCommand(cnExpression)),
    ]);

    const [c0Tex, cnTex] = await Promise.all([
      execMaxima(buildMaximaCommand(`tex(${c0}, false);`)),
      execMaxima(buildMaximaCommand(`tex(${cn}, false);`)),
    ]);

    return {
      simplified: { c0, cn },
      latex: { c0: c0Tex, cn: cnTex },
    };
  } catch (error) {
    throw new Error(`Error computing complex series: ${error.message}`);
  }
};

exports.computeTrigonometricSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    // Convertimos la matriz JS a una cadena para Maxima
    const maximaMatrix = `matrix(${funcionMatrix
      .map((row) => `[${row.join(", ")}]`)
      .join(", ")})`;

    const maximaBaseCode = `
      func : ${maximaMatrix}$
    
      pieces: length(func)$
      inicio: func[1][2]$
      fin: func[pieces][3]$
      T: fin - inicio$
      w0: 2 * %pi / T$
    
      declare(n, integer)$
    
      cos_core: cos(n * w0 * ${intVar})$
      sin_core: sin(n * w0 * ${intVar})$
    
      a0_acum: 0$
      an_acum: 0$
      bn_acum: 0$
    
      for i:1 thru pieces do (
          trozo: func[i],
          f_i: trozo[1],
          a: trozo[2],
          b: trozo[3],
    
          a0: (2/T) * integrate(f_i, ${intVar}, a, b),
          an: (2/T) * integrate(f_i * cos_core, ${intVar}, a, b),
          bn: (2/T) * integrate(f_i * sin_core, ${intVar}, a, b),
    
          a0_acum: a0_acum + a0,
          an_acum: an_acum + an,
          bn_acum: bn_acum + bn
      )$
    
      Coeff_A0: factor(ratsimp(a0_acum / 2))$
      Coeff_An: factor(ratsimp(an_acum))$
      Coeff_Bn: factor(ratsimp(bn_acum))$
    `;

    const a0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_A0);`)
    );
    const an = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_An);`)
    );
    const bn = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_Bn);`)
    );

    const a0Tex = await execMaxima(buildMaximaCommand(`tex(${a0}, false);`));
    const anTex = await execMaxima(buildMaximaCommand(`tex(${an}, false);`));
    const bnTex = await execMaxima(buildMaximaCommand(`tex(${bn}, false);`));

    return {
      simplified: { a0, an, bn },
      latex: { a0: a0Tex, an: anTex, bn: bnTex },
    };
  } catch (error) {
    throw new Error(
      `Error computing piecewise trigonometric series: ${error.message}`
    );
  }
};

exports.computeComplexSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    const maximaMatrix = `matrix(${funcionMatrix
      .map((row) => `[${row.join(", ")}]`)
      .join(", ")})`;

    const maximaBaseCode = `
      func : ${maximaMatrix}$

      pieces: length(func)$
      inicio: func[1][2]$
      fin: func[pieces][3]$
      T: fin - inicio$
      w0: 2 * %pi / T$

      declare(n, integer)$

      c0_acum: 0$
      cn_acum: 0$

      for i:1 thru pieces do (
          trozo: func[i],
          f_i: trozo[1],
          a: trozo[2],
          b: trozo[3],

          c0: (1/T) * integrate(f_i, ${intVar}, a, b),
          c0_acum: c0_acum + c0
      )$

      for i:1 thru pieces do (
          trozo: func[i],
          f_i: trozo[1],
          a: trozo[2],
          b: trozo[3],

          cn: (1/T) * integrate(f_i * exp(-%i * n * w0 * ${intVar}), ${intVar}, a, b),
          cn_acum: cn_acum + cn
      )$

      tellsimpafter(exp(%i * %pi * n), (-1)^n)$
      tellsimpafter(exp(%i * 2 * %pi * n), 1)$

      Coeff_0: factor(ratsimp(c0_acum))$
      Coeff_n: factor(ratsimp(cn_acum))$
    `;

    const c0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_0);`)
    );
    const cn = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_n);`)
    );

    const c0Tex = await execMaxima(buildMaximaCommand(`tex(${c0}, false);`));
    const cnTex = await execMaxima(buildMaximaCommand(`tex(${cn}, false);`));

    return {
      simplified: { c0, cn },
      latex: { c0: c0Tex, cn: cnTex },
    };
  } catch (error) {
    throw new Error(
      `Error computing piecewise complex series: ${error.message}`
    );
  }
};

exports.computeHalfRangeSeries = async (funcionMatrix, intVar = "x") => {
  try {
    const maximaMatrix = `matrix(${funcionMatrix
      .map((row) => `[${row.join(", ")}]`)
      .join(", ")})`;

    const maximaBaseCode = `
      func : ${maximaMatrix}$

      pieces: length(func)$
      inicio: func[1][2]$
      fin: func[pieces][3]$
      T: fin - inicio$
      w0: %pi / T$

      declare(n, integer)$

      cos_core: cos(n * w0 * ${intVar})$
      sin_core: sin(n * w0 * ${intVar})$

      a0_acum: 0$
      an_acum: 0$
      bn_acum: 0$

      for i:1 thru pieces do (
          trozo: func[i],
          f_i: trozo[1],
          a: trozo[2],
          b: trozo[3],

          a0: (1 / (T/2)) * integrate(f_i, ${intVar}, a, b),
          an: (1 / (T/2)) * integrate(f_i * cos_core, ${intVar}, a, b),
          bn: (1 / (T/2)) * integrate(f_i * sin_core, ${intVar}, a, b),

          a0_acum: a0_acum + a0,
          an_acum: an_acum + an,
          bn_acum: bn_acum + bn
      )$

      Coeff_A0: factor(ratsimp(a0_acum / 2))$
      Coeff_An: factor(ratsimp(an_acum))$
      Coeff_Bn: factor(ratsimp(bn_acum))$
    `;

    const a0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_A0);`)
    );
    const an = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_An);`)
    );
    const bn = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_Bn);`)
    );

    const a0Tex = await execMaxima(buildMaximaCommand(`tex(${a0}, false);`));
    const anTex = await execMaxima(buildMaximaCommand(`tex(${an}, false);`));
    const bnTex = await execMaxima(buildMaximaCommand(`tex(${bn}, false);`));

    return {
      simplified: { a0, an, bn },
      latex: { a0: a0Tex, an: anTex, bn: bnTex },
    };
  } catch (error) {
    throw new Error(`Error computing half-range series: ${error.message}`);
  }
};
