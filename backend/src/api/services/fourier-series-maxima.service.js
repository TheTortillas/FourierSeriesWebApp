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
