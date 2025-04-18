const execMaxima = require("./maxima.util");
const getMaximaRules = require("./maxima-rules.util");

/**
 * Helper function to build Maxima commands
 */
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

/**
 * Validates if an integral can be computed and if the result contains special functions
 * @param {string} func Function to integrate
 * @param {string} intVar Integration variable
 * @param {string} lowerLimit Lower limit of integration
 * @param {string} upperLimit Upper limit of integration
 * @param {string} kernel Optional kernel function to multiply the integrand (e.g., sin, cos)
 * @returns {Promise<Object>} Validation result object
 */
async function validateIntegrability(
  func,
  intVar,
  lowerLimit,
  upperLimit,
  kernel = ""
) {
  try {
    // Create the integrand with or without kernel
    const integrand = kernel ? `(${func}) * ${kernel}` : func;

    // Command to check if the function is integrable
    const validationCommand = `
      /* Check if function is integrable */
      contiene_funcion_especial(expr) := block(
        [funciones_especiales : ['erf, 'erfi, 'gamma, 'gamma_incomplete, 'bessel_j, 'bessel_y, 
                               'airy_ai, 'airy_bi, 'hypergeometric, 'elliptic_e, 'elliptic_f]],
        some(lambda([f], freeof(f, expr) = false), funciones_especiales)
      )$
      
      /* Try to integrate the function */
      resultado_integral: integrate(${integrand}, ${intVar}, ${lowerLimit}, ${upperLimit})$
      
      /* Check if the result still contains an integrate symbol or special functions */
      tiene_integral: not(freeof('integrate, resultado_integral))$
      tiene_funciones_especiales: contiene_funcion_especial(resultado_integral)$
      
      /* Create a structured result */
      resultado: [tiene_integral, tiene_funciones_especiales, string(resultado_integral)]$
      string(resultado);
    `;

    const result = await execMaxima(buildMaximaCommand(validationCommand));

    // Parse the result
    const resultList = parseMaximaList(result);
    if (resultList.length < 3) {
      return {
        isIntegrable: false,
        hasSpecialFunctions: false,
        result: "Error validating integration",
      };
    }

    return {
      isIntegrable: resultList[0].trim() !== "true",
      hasSpecialFunctions: resultList[1].trim() === "true",
      result: resultList[2].trim(),
    };
  } catch (error) {
    console.error("Error validating integrability:", error);
    return {
      isIntegrable: false,
      hasSpecialFunctions: false,
      result: `Error: ${error.message}`,
    };
  }
}

/**
 * Validates all components of a Fourier series
 * @param {Object} options - Configuration options
 * @param {string} options.func - Function to analyze
 * @param {string} options.intVar - Integration variable
 * @param {string} options.lowerLimit - Lower limit of integration
 * @param {string} options.upperLimit - Upper limit of integration
 * @param {string} options.seriesType - Type of series: 'trigonometric', 'complex', or 'halfRange'
 * @param {string} options.w0 - Angular frequency formula
 * @returns {Promise<Object>} Validation results for each coefficient
 */
async function validateFourierSeries({
  func,
  intVar = "x",
  lowerLimit,
  upperLimit,
  seriesType = "trigonometric",
  w0 = "2*%pi/T",
}) {
  const isComplex = seriesType === "complex";
  const validations = {};

  try {
    // Validate the base function integration (for a0/c0)
    const baseValidation = await validateIntegrability(
      func,
      intVar,
      lowerLimit,
      upperLimit
    );

    if (isComplex) {
      validations.c0 = baseValidation;

      // Validate cn with exp kernel
      const expKernel = `exp(-(%i * n * ${w0} * ${intVar}))`;
      validations.cn = await validateIntegrability(
        func,
        intVar,
        lowerLimit,
        upperLimit,
        expKernel
      );
    } else {
      validations.a0 = baseValidation;

      // Validate an with cosine kernel
      const cosKernel = `cos(n * ${w0} * ${intVar})`;
      validations.an = await validateIntegrability(
        func,
        intVar,
        lowerLimit,
        upperLimit,
        cosKernel
      );

      // Validate bn with sine kernel
      const sinKernel = `sin(n * ${w0} * ${intVar})`;
      validations.bn = await validateIntegrability(
        func,
        intVar,
        lowerLimit,
        upperLimit,
        sinKernel
      );
    }

    // Overall validation result
    validations.isValid = isComplex
      ? validations.c0.isIntegrable &&
        validations.cn.isIntegrable &&
        !validations.c0.hasSpecialFunctions &&
        !validations.cn.hasSpecialFunctions
      : validations.a0.isIntegrable &&
        validations.an.isIntegrable &&
        validations.bn.isIntegrable &&
        !validations.a0.hasSpecialFunctions &&
        !validations.an.hasSpecialFunctions &&
        !validations.bn.hasSpecialFunctions;

    return validations;
  } catch (error) {
    console.error("Error in Fourier series validation:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * Validates a piecewise Fourier series
 * @param {Array} funcionMatrix - Matrix of function pieces [[func, start, end], ...]
 * @param {string} intVar - Integration variable
 * @param {string} seriesType - Type of series: 'trigonometric', 'complex', or 'halfRange'
 * @returns {Promise<Object>} Validation results for the piecewise function
 */
async function validatePiecewiseFourierSeries(
  funcionMatrix,
  intVar = "x",
  seriesType = "trigonometric"
) {
  try {
    const isComplex = seriesType === "complex";
    const isHalfRange = seriesType === "halfRange";
    const w0Formula = isHalfRange ? "%pi/T" : "2*%pi/T";

    const validations = {
      pieces: [],
    };

    for (let i = 0; i < funcionMatrix.length; i++) {
      const [func, start, end] = funcionMatrix[i];

      const pieceValidation = await validateFourierSeries({
        func,
        intVar,
        lowerLimit: start,
        upperLimit: end,
        seriesType,
        w0: w0Formula,
      });

      validations.pieces.push({
        index: i,
        function: func,
        start,
        end,
        validation: pieceValidation,
      });
    }

    // Check if all pieces are valid
    validations.isValid = validations.pieces.every(
      (piece) => piece.validation.isValid
    );

    return validations;
  } catch (error) {
    console.error("Error in piecewise Fourier series validation:", error);
    return {
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * Parse a Maxima list string into an array
 * @param {string} listStr String representation of a Maxima list
 * @returns {Array} Array of list items
 */
function parseMaximaList(listStr) {
  if (!listStr.startsWith("[") || !listStr.endsWith("]")) {
    return [];
  }

  const content = listStr.substring(1, listStr.length - 1).trim();
  if (!content) return [];

  // Simplified parsing for comma-separated list items
  // This is a basic implementation and might need enhancement for complex nested structures
  const items = [];
  let currentItem = "";
  let nestedLevel = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (
      (char === "[" || char === "(") &&
      (i === 0 || content[i - 1] !== "\\")
    ) {
      nestedLevel++;
      currentItem += char;
    } else if (
      (char === "]" || char === ")") &&
      (i === 0 || content[i - 1] !== "\\")
    ) {
      nestedLevel--;
      currentItem += char;
    } else if (char === "," && nestedLevel === 0) {
      items.push(currentItem.trim());
      currentItem = "";
    } else {
      currentItem += char;
    }
  }

  if (currentItem) {
    items.push(currentItem.trim());
  }

  return items;
}

module.exports = {
  validateIntegrability,
  validateFourierSeries,
  validatePiecewiseFourierSeries,
};
