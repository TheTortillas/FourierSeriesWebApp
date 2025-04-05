const execMaxima = require("../utils/maxima.util");
const getMaximaRules = require("../utils/maxima-rules.util");
const calculatePiecewiseSeries = require("../utils/piecewise-series.util");

// Helper function to build Maxima commands
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

exports.computeTrigonometricSeries = async (funcion, periodo, intVar) => {
  try {
    // Define common expressions including core functions
    const commonExprPart = `
      ${getMaximaRules({
        integer: true,
        trigRules: true,
        assumptions: true,
      })}
      w0: (2*(%pi))/(${periodo})$          
      series_cosine_core: cos(n*w0*${intVar})$
      series_sine_core: sin(n*w0*${intVar})$
  `;

    // Primero obtenemos w0
    const w0Expression = `
      ${commonExprPart}
      string(w0);
    `;

    const cosineCoreExpression = `
      ${commonExprPart}
      string(series_cosine_core);
    `;

    const sineCoreExpression = `
      ${commonExprPart}
      string(series_sine_core);
    `;

    // Define expressions for a0, an, and bn
    const a0Expression = `
      ${commonExprPart}
      string(factor(fullratsimp(factor(
        (2/((${periodo}))) * integrate(${funcion}, ${intVar}, -((${periodo})/2), (${periodo})/2)
    ))));
    `;
    const anExpression = `
      ${commonExprPart}
      string(factor(fullratsimp(factor(
        (2/((${periodo}))) * integrate(((${funcion}) * series_cosine_core), ${intVar}, -((${periodo})/2), (${periodo})/2)
    ))));
    `;
    const bnExpression = `
      ${commonExprPart}
      string(factor(fullratsimp(factor(
        (2/((${periodo}))) * integrate(((${funcion}) * series_sine_core), ${intVar}, -((${periodo})/2), (${periodo})/2)
      ))));
    `;

    // First, calculate the coefficients
    const [a0, an, bn, w0, series_cosine_core, series_sine_core] =
      await Promise.all([
        execMaxima(buildMaximaCommand(a0Expression)),
        execMaxima(buildMaximaCommand(anExpression)),
        execMaxima(buildMaximaCommand(bnExpression)),
        execMaxima(buildMaximaCommand(w0Expression)),
        execMaxima(buildMaximaCommand(cosineCoreExpression)),
        execMaxima(buildMaximaCommand(sineCoreExpression)),
      ]);

    // Then convert them to LaTeX
    const [a0Tex, anTex, bnTex, w0Tex, cosineCoreTex, sineCoreTex] =
      await Promise.all([
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({ displayFlags: true })} tex(${a0}, false);`
          )
        ),
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({ displayFlags: true })} tex(${an}, false);`
          )
        ),
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({ displayFlags: true })} tex(${bn}, false);`
          )
        ),
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({ displayFlags: true })} tex(${w0}, false);`
          )
        ),
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({
              displayFlags: true,
            })} tex(${series_cosine_core}, false);`
          )
        ),
        execMaxima(
          buildMaximaCommand(
            `${getMaximaRules({
              displayFlags: true,
            })} tex(${series_sine_core}, false);`
          )
        ),
      ]);

    return {
      simplified: { a0, an, bn, w0, series_cosine_core, series_sine_core },
      latex: {
        a0: a0Tex,
        an: anTex,
        bn: bnTex,
        w0: w0Tex,
        series_cosine_core: cosineCoreTex,
        series_sine_core: sineCoreTex,
      },
    };
  } catch (error) {
    throw new Error(`Error computing trigonometric series: ${error.message}`);
  }
};

exports.computeComplexSeries = async (funcion, periodo, intVar) => {
  try {
    // Define common expressions including core functions
    const commonExprPart = `
      ${getMaximaRules({
        integer: true,
        trigRules: true,
        assumptions: true,
        expRules: true,
      })}
      w0: (2*(%pi))/(${periodo})$     
      series_exp_core: exp(-(%i*n*w0*${intVar}))$
    `;

    // Obtener w0
    const w0Expression = `
     ${commonExprPart}
     string(w0);
   `;

    const seriesExpCoreExpression = `
      ${commonExprPart}
      string(exp((%i * n * w0 * ${intVar})));
    `;

    // Define expressions for c0 and cn
    const c0Expression = `
      ${commonExprPart}
      string(factor(fullratsimp(factor(
        (1/(${periodo})) * integrate((${funcion}), ${intVar}, -((${periodo})/2), (${periodo})/2)
      ))));
    `;
    const cnExpression = `
      ${commonExprPart}
      string(factor(fullratsimp(factor(
        (1/(${periodo})) * integrate(((${funcion}) * series_exp_core), ${intVar}, -((${periodo})/2), (${periodo})/2)
      ))));
    `;

    const [c0, cn, w0, series_exp_core] = await Promise.all([
      execMaxima(buildMaximaCommand(c0Expression)),
      execMaxima(buildMaximaCommand(cnExpression)),
      execMaxima(buildMaximaCommand(w0Expression)),
      execMaxima(buildMaximaCommand(seriesExpCoreExpression)),
    ]);

    const [c0Tex, cnTex, w0Tex, expCoreTex] = await Promise.all([
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${c0}, false);`
        )
      ),
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${cn}, false);`
        )
      ),
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${w0}, false);`
        )
      ),
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({
            displayFlags: true,
          })} tex(${series_exp_core}, false);`
        )
      ),
    ]);

    return {
      simplified: { c0, cn, w0, series_exp_core },
      latex: { c0: c0Tex, cn: cnTex, w0: w0Tex, series_exp_core: expCoreTex },
    };
  } catch (error) {
    throw new Error(`Error computing complex series: ${error.message}`);
  }
};

exports.computeTrigonometricSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    return await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "trigonometric",
    });
  } catch (error) {
    throw new Error(
      `Error computing piecewise trigonometric series: ${error.message}`
    );
  }
};

exports.computeComplexSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    return await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "complex",
    });
  } catch (error) {
    throw new Error(
      `Error computing piecewise complex series: ${error.message}`
    );
  }
};

exports.computeHalfRangeSeries = async (funcionMatrix, intVar = "x") => {
  try {
    return await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "halfRange",
    });
  } catch (error) {
    throw new Error(`Error computing half-range series: ${error.message}`);
  }
};
