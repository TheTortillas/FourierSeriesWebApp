const { execMaxima, buildMaximaCommand } = require("./maxima.util");
const getMaximaRules = require("./maxima-rules.util");

/**
 * Build and execute Maxima commands for piecewise series calculations
 * @param {Object} options Configuration options
 * @param {Array} options.funcionMatrix Matrix of function pieces [[func, start, end], ...]
 * @param {string} options.intVar Integration variable
 * @param {string} options.seriesType Type of series: 'trigonometric', 'complex', or 'halfRange'
 * @returns {Promise<Object>} Results of the calculation
 */
async function calculatePiecewiseSeries({
  funcionMatrix,
  intVar = "x",
  seriesType = "trigonometric", // 'trigonometric', 'complex', or 'halfRange'
}) {
  const maximaMatrix = `matrix(${funcionMatrix
    .map((row) => `[${row.join(", ")}]`)
    .join(", ")})`;

  // Configure options based on series type
  const isComplex = seriesType === "complex";
  const isHalfRange = seriesType === "halfRange";

  // Build w0 based on series type
  const w0Definition = isHalfRange ? "w0: %pi / T$" : "w0: (2 * %pi) / T$";

  // Base code common to all types
  let maximaBaseCode = `
     func : ${maximaMatrix}$
     
     ${getMaximaRules({
       integer: true,
       trigRules: !isComplex,
       assumptions: true,
       expRules: isComplex,
     })}
   
     pieces: length(func)$
     inicio: func[1][2]$
     fin: func[pieces][3]$
     T: fin - inicio$
     ${w0Definition}
   `;

  // Add series core definitions based on type
  if (isComplex) {
    maximaBaseCode += `
       exp_core: exp(-(%i * n * w0 * ${intVar}))$
       
       c0_acum: 0$
       cn_acum: 0$
       
       for i:1 thru pieces do (
           trozo: func[i],
           f_i: trozo[1],
           a: trozo[2],
           b: trozo[3],
           
           c0: (1/T) * integrate((f_i), ${intVar}, a, b),
           c0_acum: c0_acum + c0
       )$
       
       for i:1 thru pieces do (
           trozo: func[i],
           f_i: trozo[1],
           a: trozo[2],
           b: trozo[3],
           
           cn: (1/T) * integrate((f_i)* exp_core, ${intVar}, a, b),
           cn_acum: cn_acum + cn
       )$
       
       Coeff_0: factor(fullratsimp(factor(c0_acum)))$
       Coeff_n: factor(fullratsimp(factor(cn_acum)))$
       exp_core: exp((%i * n * w0 * ${intVar}))$
     `;

    // Execute Maxima commands for complex series
    const c0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_0);`)
    );
    const cn = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_n);`)
    );
    const T = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(T);`)
    );
    const w0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(w0);`)
    );
    const series_exp_core = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(exp_core);`)
    );

    // Find indeterminate values
    const cnIndeterminateValues = await findIndeterminateValues(
      cn,
      "cn",
      "complex",
      funcionMatrix,
      intVar
    );

    // Generate LaTeX output
    const c0Tex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${c0}, false);`
      )
    );
    const cnTex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${cn}, false);`
      )
    );
    const w0Tex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${w0}, false);`
      )
    );
    const TTex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${T}, false);`
      )
    );
    const expCoreTex = await execMaxima(
      buildMaximaCommand(`tex(${series_exp_core}, false);`)
    );

    return {
      simplified: { c0, cn, w0, T, series_exp_core },
      latex: {
        c0: c0Tex,
        cn: cnTex,
        w0: w0Tex,
        T: TTex,
        series_exp_core: expCoreTex,
      },
      indeterminateValues: {
        cn: cnIndeterminateValues,
      },
    };
  } else {
    // Trigonometric series (both regular and half-range)
    const integralCoefficient = isHalfRange ? "(1 / (T/2))" : "(2/T)";
    const simplificationMethod = isHalfRange ? "ratsimp" : "fullratsimp";

    maximaBaseCode += `
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
           
           a0: ${integralCoefficient} * integrate((f_i), ${intVar}, a, b),
           an: ${integralCoefficient} * integrate((f_i)* cos_core, ${intVar}, a, b),
           bn: ${integralCoefficient} * integrate((f_i) * sin_core, ${intVar}, a, b),
           
           a0_acum: a0_acum + a0,
           an_acum: an_acum + an,
           bn_acum: bn_acum + bn
       )$
       
       Coeff_A0: factor(${simplificationMethod}(factor(a0_acum)))$
       Coeff_An: factor(${simplificationMethod}(factor(an_acum)))$
       Coeff_Bn: factor(${simplificationMethod}(factor(bn_acum)))$
     `;

    // Execute Maxima commands for trigonometric series
    const a0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_A0);`)
    );
    const an = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_An);`)
    );
    const bn = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(Coeff_Bn);`)
    );
    const T = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(T);`)
    );
    const w0 = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(w0);`)
    );
    const series_cosine_core = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(cos_core);`)
    );
    const series_sine_core = await execMaxima(
      buildMaximaCommand(`${maximaBaseCode} string(sin_core);`)
    );

    // Find indeterminate values for coefficients
    // En la parte donde calculamos indeterminaciones para series trigonométricas
    const anIndeterminateValues = await findIndeterminateValues(
      an,
      "an",
      seriesType,
      funcionMatrix,
      intVar
    );
    const bnIndeterminateValues = await findIndeterminateValues(
      bn,
      "bn",
      seriesType,
      funcionMatrix,
      intVar
    );

    // Generate LaTeX output
    const a0Tex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${a0}, false);`
      )
    );
    const anTex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${an}, false);`
      )
    );
    const bnTex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${bn}, false);`
      )
    );
    const TTex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${T}, false);`
      )
    );
    const w0Tex = await execMaxima(
      buildMaximaCommand(
        `${getMaximaRules({ displayFlags: true })} tex(${w0}, false);`
      )
    );
    const cosineCoreTex = await execMaxima(
      buildMaximaCommand(`tex(${series_cosine_core}, false);`)
    );
    const sineCoreTex = await execMaxima(
      buildMaximaCommand(`tex(${series_sine_core}, false);`)
    );

    return {
      simplified: { a0, an, bn, T, w0, series_cosine_core, series_sine_core },
      latex: {
        a0: a0Tex,
        an: anTex,
        bn: bnTex,
        T: TTex,
        w0: w0Tex,
        cosineCore: cosineCoreTex,
        sineCore: sineCoreTex,
      },
      indeterminateValues: {
        an: anIndeterminateValues,
        bn: bnIndeterminateValues,
      },
    };
  }
}

/**
 * Finds indeterminate values in a coefficient expression (only for integer values)
 * @param {string} expr The coefficient expression to analyze
 * @param {string} coefType Type of coefficient ('an', 'bn', or 'cn')
 * @param {string} seriesType Type of series ('trigonometric', 'complex', or 'halfRange')
 * @param {Array} funcionMatrix Matrix of function pieces
 * @param {string} intVar Integration variable
 * @returns {Promise<Array>} Array of objects with indeterminate points and their limits
 */
async function findIndeterminateValues(
  expr,
  coefType = "an",
  seriesType = "trigonometric",
  funcionMatrix = [],
  intVar = "x"
) {
  if (!expr || expr === "0") return [];

  try {
    // Step 1: Recalculate coefficient WITHOUT integer declaration
    const maximaMatrix = `matrix(${funcionMatrix
      .map((row) => `[${row.join(", ")}]`)
      .join(", ")})`;

    const isComplex = seriesType === "complex";
    const isHalfRange = seriesType === "halfRange";

    // Base code with NO integer declaration
    let maximaBaseCode = `
       func : ${maximaMatrix}$
       
       /* We explicitly avoid declaring n as integer */
       ${getMaximaRules({
         integer: false,
         trigRules: !isComplex,
         assumptions: true,
         expRules: isComplex,
       })}
     
       pieces: length(func)$
       inicio: func[1][2]$
       fin: func[pieces][3]$
       T: fin - inicio$
       ${isHalfRange ? "w0: %pi / T$" : "w0: (2 * %pi) / T$"}
    `;

    // Add code specific to coefficient type to calculate without integer restriction
    if (isComplex && coefType === "cn") {
      maximaBaseCode += `
         exp_core: exp(-(%i * n * w0 * ${intVar}))$
         cn_acum: 0$
         
         for i:1 thru pieces do (
             trozo: func[i],
             f_i: trozo[1],
             a: trozo[2],
             b: trozo[3],
             
             cn: (1/T) * integrate((f_i)* exp_core, ${intVar}, a, b),
             cn_acum: cn_acum + cn
         )$
         
         Coeff_n: factor(fullratsimp(factor(cn_acum)))$
      `;
    } else if (!isComplex) {
      const integralCoefficient = isHalfRange ? "(1 / (T/2))" : "(2/T)";
      const simplificationMethod = isHalfRange ? "ratsimp" : "fullratsimp";

      if (coefType === "an") {
        maximaBaseCode += `
           cos_core: cos(n * w0 * ${intVar})$
           an_acum: 0$
           
           for i:1 thru pieces do (
               trozo: func[i],
               f_i: trozo[1],
               a: trozo[2],
               b: trozo[3],
               
               an: ${integralCoefficient} * integrate((f_i)* cos_core, ${intVar}, a, b),
               an_acum: an_acum + an
           )$
           
           Coeff_An: factor(${simplificationMethod}(factor(an_acum)))$
        `;
      } else if (coefType === "bn") {
        maximaBaseCode += `
           sin_core: sin(n * w0 * ${intVar})$
           bn_acum: 0$
           
           for i:1 thru pieces do (
               trozo: func[i],
               f_i: trozo[1],
               a: trozo[2],
               b: trozo[3],
               
               bn: ${integralCoefficient} * integrate((f_i) * sin_core, ${intVar}, a, b),
               bn_acum: bn_acum + bn
           )$
           
           Coeff_Bn: factor(${simplificationMethod}(factor(bn_acum)))$
        `;
      }
    }

    // Get coefficient variable name based on coefficient type
    const coefVar =
      coefType === "an"
        ? "Coeff_An"
        : coefType === "bn"
        ? "Coeff_Bn"
        : "Coeff_n";

    // Step 2: Calculate the non-integer coefficient
    const nonIntegerCoefficientCommand = `
       ${maximaBaseCode}
       string(${coefVar});
    `;

    const nonIntegerCoefficient = await execMaxima(
      buildMaximaCommand(nonIntegerCoefficientCommand)
    );

    // Step 3: Find integer values where the denominator becomes zero using the non-integer coefficient
    const findSingularitiesCommand = `
       declare(n, integer)$
       buscar_singularidades(expr) := block(
         [d, soluciones, enteros],
         d: denom(expr),
         soluciones: solve(d = 0, n),
         enteros: [],
         for sol in soluciones do (
           if integerp(rhs(sol)) then enteros: cons(sol, enteros)
         ),
         return(enteros)
       )$
       string(buscar_singularidades(${nonIntegerCoefficient}));
     `;

    const singularitiesResult = await execMaxima(
      buildMaximaCommand(findSingularitiesCommand)
    );

    // If no singularities are found, return empty array
    if (!singularitiesResult || singularitiesResult === "[]") return [];

    // Parse singularities
    const singularitiesList = parseMaximaList(
      singularitiesResult.replace(/n\s*=\s*/g, "")
    );
    const singularities = singularitiesList.map((s) => parseInt(s.trim(), 10));

    if (singularities.length === 0) return [];

    // Step 4: Calculate limits for each singularity using the non-integer version of the coefficient
    const limitsPromises = singularities.map(async (singValue) => {
      const limitCommand = `
         ${maximaBaseCode}
         /* Calculate the limit using the non-integer version of the coefficient */
         lim_valor: limit(${coefVar}, n, ${singValue})$
         string(lim_valor);
      `;

      const limitResult = await execMaxima(buildMaximaCommand(limitCommand));

      // Get LaTeX representation of the limit for display
      const limitTexCommand = `
         ${maximaBaseCode}
         /* Calculate the limit using the non-integer version of the coefficient */
         lim_valor: limit(${coefVar}, n, ${singValue})$
         tex(lim_valor, false);
      `;

      const limitTexResult = await execMaxima(
        buildMaximaCommand(limitTexCommand)
      );

      return {
        n: singValue,
        limit: limitResult.trim(),
        limitTex: limitTexResult.trim(),
      };
    });

    return await Promise.all(limitsPromises);
  } catch (error) {
    console.error("Error finding indeterminate values:", error);
    return [];
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

/**
 * Parse a Maxima pair [a, b] into separate components
 * @param {string} pairStr String representation of a Maxima pair
 * @returns {Array} Array containing the two parts of the pair
 */
function parseMaximaPair(pairStr) {
  if (!pairStr.startsWith("[") || !pairStr.endsWith("]")) {
    return ["0", "0"];
  }

  const content = pairStr.substring(1, pairStr.length - 1).trim();

  // Find the middle comma that separates the values
  let commaPos = -1;
  let nestedLevel = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (
      (char === "[" || char === "(") &&
      (i === 0 || content[i - 1] !== "\\")
    ) {
      nestedLevel++;
    } else if (
      (char === "]" || char === ")") &&
      (i === 0 || content[i - 1] !== "\\")
    ) {
      nestedLevel--;
    } else if (char === "," && nestedLevel === 0) {
      commaPos = i;
      break;
    }
  }

  if (commaPos === -1) {
    return ["0", "0"];
  }

  return [
    content.substring(0, commaPos).trim(),
    content.substring(commaPos + 1).trim(),
  ];
}


module.exports = calculatePiecewiseSeries;
