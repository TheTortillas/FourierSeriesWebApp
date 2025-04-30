const { execMaxima, buildMaximaCommand } = require("../utils/maxima.util");
const getMaximaRules = require("../utils/maxima-rules.util");
const calculatePiecewiseSeries = require("../utils/piecewise-series.util");
const {
  validateFourierSeries,
  validatePiecewiseFourierSeries,
} = require("../utils/fourier-validation.util");

exports.computeTrigonometricSeries = async (funcion, periodo, intVar) => {
  try {
    // First, validate the integrability of the function
    const validation = await validateFourierSeries({
      func: funcion,
      intVar,
      lowerLimit: `-((${periodo})/2)`,
      upperLimit: `(${periodo})/2`,
      seriesType: "trigonometric",
      w0: `(2*(%pi))/(${periodo})`,
    });

    if (!validation.isValid) {
      return {
        success: false,
        message:
          "La función no puede ser integrada correctamente o contiene funciones especiales",
        validationDetails: validation,
      };
    }

    // Continue with the calculation if validation passed
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
      success: true,
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
    // First, validate the integrability of the function
    const validation = await validateFourierSeries({
      func: funcion,
      intVar,
      lowerLimit: `-((${periodo})/2)`,
      upperLimit: `(${periodo})/2`,
      seriesType: "complex",
      w0: `(2*(%pi))/(${periodo})`,
    });

    if (!validation.isValid) {
      return {
        success: false,
        message:
          "La función no puede ser integrada correctamente o contiene funciones especiales",
        validationDetails: validation,
      };
    }

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
      success: true,
      simplified: { c0, cn, w0, series_exp_core },
      latex: { c0: c0Tex, cn: cnTex, w0: w0Tex, series_exp_core: expCoreTex },
    };
  } catch (error) {
    throw new Error(`Error computing complex series: ${error.message}`);
  }
};

exports.computeTrigonometricSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    // First, validate the piecewise function
    const validation = await validatePiecewiseFourierSeries(
      funcionMatrix,
      intVar,
      "trigonometric"
    );

    if (!validation.isValid) {
      return {
        success: false,
        message:
          "La función a trozos no puede ser integrada correctamente o contiene funciones especiales",
        validationDetails: validation,
      };
    }

    // Continue with calculation if validation passed
    const result = await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "trigonometric",
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    throw new Error(
      `Error computing piecewise trigonometric series: ${error.message}`
    );
  }
};

exports.computeComplexSeriesPiecewise = async (funcionMatrix, intVar) => {
  try {
    // First, validate the piecewise function
    const validation = await validatePiecewiseFourierSeries(
      funcionMatrix,
      intVar,
      "complex"
    );

    if (!validation.isValid) {
      return {
        success: false,
        message:
          "La función a trozos no puede ser integrada correctamente o contiene funciones especiales",
        validationDetails: validation,
      };
    }

    // Calculate period T as the difference between last and first boundary
    const pieces = funcionMatrix.length;
    const firstLimit = funcionMatrix[0][1];
    const lastLimit = funcionMatrix[pieces - 1][2];
    const period = `(${lastLimit}) - (${firstLimit})`;

    // Define common expressions including core functions with negative exponent
    const commonExprPart = `
      ${getMaximaRules({
        integer: true,
        trigRules: true,
        assumptions: true,
        expRules: true,
      })}
      T: ${period}$
      w0: (2*(%pi))/(T)$     
      series_exp_core_pos: exp((%i*n*w0*${intVar}))$
      series_exp_core_neg: exp(-(%i*n*w0*${intVar}))$
    `;

    // Get w0 and exponents
    const w0Expression = `
      ${commonExprPart}
      string(w0);
    `;

    const expCorePosExpression = `
      ${commonExprPart}
      string(series_exp_core_pos);
    `;

    const expCoreNegExpression = `
      ${commonExprPart}
      string(series_exp_core_neg);
    `;

    // Continue with calculation if validation passed
    const result = await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "complex",
      period,
    });

    // Get the fundamental frequency and exponential cores
    const [w0, expCorePos, expCoreNeg] = await Promise.all([
      execMaxima(buildMaximaCommand(w0Expression)),
      execMaxima(buildMaximaCommand(expCorePosExpression)),
      execMaxima(buildMaximaCommand(expCoreNegExpression)),
    ]);

    // Convert to LaTeX
    const [w0Tex, expCorePosTex, expCoreNegTex] = await Promise.all([
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${w0}, false);`
        )
      ),
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${expCorePos}, false);`
        )
      ),
      execMaxima(
        buildMaximaCommand(
          `${getMaximaRules({ displayFlags: true })} tex(${expCoreNeg}, false);`
        )
      ),
    ]);

    // Add the additional data to the result
    return {
      success: true,
      ...result,
      simplified: {
        ...result.simplified,
        w0,
        series_exp_core_pos: expCorePos,
        series_exp_core_neg: expCoreNeg,
      },
      latex: {
        ...result.latex,
        w0: w0Tex,
        series_exp_core_pos: expCorePosTex,
        series_exp_core_neg: expCoreNegTex,
      },
    };
  } catch (error) {
    throw new Error(
      `Error computing piecewise complex series: ${error.message}`
    );
  }
};

exports.computeHalfRangeSeries = async (funcionMatrix, intVar = "x") => {
  try {
    // First, validate the piecewise function
    const validation = await validatePiecewiseFourierSeries(
      funcionMatrix,
      intVar,
      "halfRange"
    );

    if (!validation.isValid) {
      return {
        success: false,
        message:
          "La función a trozos no puede ser integrada correctamente o contiene funciones especiales",
        validationDetails: validation,
      };
    }

    // Continue with calculation if validation passed
    const result = await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "halfRange",
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    throw new Error(`Error computing half-range series: ${error.message}`);
  }
};
