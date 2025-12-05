const { execMaxima, buildMaximaCommand } = require("../utils/maxima.util");
const getMaximaRules = require("../utils/maxima-rules.util");
const calculatePiecewiseSeries = require("../utils/piecewise-series.util");
const {
  validateFourierSeries,
  validatePiecewiseFourierSeries,
} = require("../utils/fourier-validation.util");

/* ----------------------------- helpers ----------------------------- */

/** Normaliza la salida de Maxima (sin líneas nuevas, espacios duplicados, …) */
function cleanMaximaOutput(output = "") {
  return output
    .replace(/\\\n/g, "")
    .replace(/\n/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve true si la salida contiene texto típico de error */
function containsError(out = "") {
  const patterns = [
    /error/i,
    /division by zero/i,
    /división por cero/i,
    /log: encountered/i,
    /is not of type/i,
    /argument cannot be/i,
    /unexpected condition/i,
  ];
  return patterns.some((re) => re.test(out));
}

/** Intenta sacar un mensaje de error “humano” de la salida cruda */
function extractErrorMessage(out = "") {
  const first =
    out.match(/log: encountered ([^.]+)/) ||
    out.match(/([^:]+: [^.]+\.)/) ||
    out.match(/(is not of type [^:]+)/) ||
    out.match(/(argument cannot be [^;]+)/);
  return first && first[1]
    ? `Error matemático: ${first[1]}`
    : "Error matemático en la evaluación de la función";
}

/* ------------------ servicio optimizado: 1 sola llamada ------------------ */

exports.computeTrigonometricSeries = async (funcion, periodo, intVar = "x") => {
  try {
    /* 1 . Validación previa — igual que antes -------------------------- */
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

    /* 2 . Script único de Maxima --------------------------------------- */
    const maximaScript = `
      /* Reglas y flags */
      ${getMaximaRules({
        integer: true,
        trigRules: true,
        assumptions: true,
        displayFlags: true /* para que tex() salga en una sola línea */,
      })}

      /* Parámetros */
      P   : (${periodo})$
      w0  : (2*%pi)/P$
      f   : (${funcion})$

      /* Coeficientes */
      a0  : fullratsimp(factor((2/P)*integrate((f),${intVar}, -P/2, P/2)))$
      a0over2 : fullratsimp(a0/2)$
      an  : fullratsimp(factor((2/P)*integrate((f)*cos(n*w0*${intVar}), ${intVar}, -P/2, P/2)))$
      bn  : fullratsimp(factor((2/P)*integrate((f)*sin(n*w0*${intVar}), ${intVar}, -P/2, P/2)))$

      /* Núcleos */
      core_cos : cos(n*w0*${intVar})$
      core_sin : sin(n*w0*${intVar})$

      /* Salida: 7 simplificados + 7 en TeX */
      resultados : [
        string(a0),   string(a0over2), string(an),   string(bn),
        string(w0),   string(core_cos), string(core_sin),
        tex(a0,false), tex(a0over2,false), tex(an,false), tex(bn,false),
        tex(w0,false), tex(core_cos,false), tex(core_sin,false)
      ]$
      string(resultados);
    `;

    /* 3 . Ejecución única ---------------------------------------------- */
    const raw = await execMaxima(buildMaximaCommand(maximaScript));
    const cleaned = cleanMaximaOutput(raw);

    if (containsError(cleaned)) {
      return {
        success: false,
        message: extractErrorMessage(cleaned),
        details: cleaned,
      };
    }

    /* 4 . Parseo genérico ---------------------------------------------- */
    // cleaned será algo tipo ["a0str","anstr",...,"tex(core_sin)"]
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return {
        success: false,
        message: "No se pudo parsear la salida de Maxima",
        details: cleaned,
      };
    }

    if (!Array.isArray(parsed) || parsed.length !== 14) {
      return {
        success: false,
        message: "La salida de Maxima no tiene el formato esperado",
        details: cleaned,
      };
    }

    const [
      a0,
      a0over2,
      an,
      bn,
      w0,
      series_cosine_core,
      series_sine_core,
      a0Tex,
      a0over2Tex,
      anTex,
      bnTex,
      w0Tex,
      cosineCoreTex,
      sineCoreTex,
    ] = parsed;

    /* 5 . Respuesta ----------------------------------------------------- */
    return {
      success: true,
      simplified: {
        a0,
        a0over2,
        an,
        bn,
        w0,
        series_cosine_core,
        series_sine_core,
      },
      latex: {
        a0: a0Tex,
        a0over2: a0over2Tex,
        an: anTex,
        bn: bnTex,
        w0: w0Tex,
        series_cosine_core: cosineCoreTex,
        series_sine_core: sineCoreTex,
      },
    };
  } catch (err) {
    /* Cualquier fallo Node/exec general */
    return {
      success: false,
      message: `Error computing trigonometric series: ${err.message}`,
    };
  }
};

exports.computeComplexSeries = async (funcion, periodo, intVar = "x") => {
  try {
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

    const maximaScript = `
      ${getMaximaRules({
        integer: true,
        trigRules: true,
        expRules: true,
        assumptions: true,
        displayFlags: true,
      })}

      P  : (${periodo})$
      w0 : (2*%pi)/P$
      f  : (${funcion})$

      /* Coeficientes complejos */
      c0 : (fullratsimp(factor((1/P)*integrate(f, ${intVar}, -P/2, P/2))))$
      cn : (fullratsimp(factor((1/P)*integrate(f*exp(-%i*n*w0*${intVar}), ${intVar}, -P/2, P/2))))$

      core_exp : exp(%i*n*w0*${intVar})$

      resultados : [
        string(c0), string(cn), string(w0), string(core_exp),
        tex(c0,false), tex(cn,false), tex(w0,false), tex(core_exp,false)
      ]$
      string(resultados);
    `;

    const raw = await execMaxima(buildMaximaCommand(maximaScript));
    const cleaned = cleanMaximaOutput(raw);

    if (containsError(cleaned)) {
      return {
        success: false,
        message: extractErrorMessage(cleaned),
        details: cleaned,
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return {
        success: false,
        message: "No se pudo parsear la salida de Maxima",
        details: cleaned,
      };
    }

    if (!Array.isArray(parsed) || parsed.length !== 8) {
      return {
        success: false,
        message: "La salida de Maxima no tiene el formato esperado",
        details: cleaned,
      };
    }

    const [c0, cn, w0, series_exp_core, c0Tex, cnTex, w0Tex, expCoreTex] =
      parsed;

    return {
      success: true,
      simplified: { c0, cn, w0, series_exp_core },
      latex: { c0: c0Tex, cn: cnTex, w0: w0Tex, series_exp_core: expCoreTex },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error computing complex series: ${error.message}`,
    };
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

    // Calculamos el periodo solo para pasarlo al util
    const pieces = funcionMatrix.length;
    const firstLimit = funcionMatrix[0][1];
    const lastLimit = funcionMatrix[pieces - 1][2];
    const period = `(${lastLimit}) - (${firstLimit})`;

    // Ejecutamos el cálculo completo y centralizado
    const result = await calculatePiecewiseSeries({
      funcionMatrix,
      intVar,
      seriesType: "complex",
      period,
    });

    return {
      success: true,
      ...result, // ← ya incluye simplified y latex con w0 y núcleos
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
