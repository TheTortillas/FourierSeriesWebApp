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
  period = null,
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
       displayFlags: false,
     })}
   
     pieces: length(func)$
     inicio: func[1][2]$
     fin: func[pieces][3]$
     T: ${period || "fin - inicio"}$
     ${w0Definition}
     
     /* Convert matrix to list of lists for easier iteration */
     tramos: makelist([func[i][1], func[i][2], func[i][3]], i, 1, pieces)$
   `;

  async function parseListItems(listStr) {
    if (!listStr || !listStr.startsWith("[") || !listStr.endsWith("]"))
      return [];
    const content = listStr.slice(1, -1).trim();
    if (!content) return [];
    const result = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === "[" || char === "(") depth++;
      if (char === "]" || char === ")") depth--;
      if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current) result.push(current.trim());
    return result;
  }

  // Add series core definitions based on type
  if (isComplex) {
    const N = 100; // coeficientes de −N … N
    const N_terms = 100; // términos que expandiremos en la serie

    const maximaScript = `
      ${maximaBaseCode}
  
      /* Núcleos exponenciales */
      series_exp_core_pos : exp(%i*n*w0*${intVar})$
      series_exp_core_neg : exp(-%i*n*w0*${intVar})$
  
      /* Coeficiente general cₙ (función) */
      c_n(n) := block([c:0],
        for tr in tramos do
          c : c + (1/T)*integrate(tr[1]*exp(-%i*n*w0*${intVar}), ${intVar}, tr[2], tr[3]),
        return(ratsimp(c)))$
  
      c0      : c_n(0)$
      expr_cn : ratsimp(c_n(n))$
  
      /* Listas de coeficientes, amplitud y fase */
      N : ${N}$
      lista_cn        : makelist([k, ratsimp(c_n(k))          ], k, -N, N)$
      lista_amp_fase  : makelist([k, cabs(c_n(k)), carg(c_n(k))], k, -N, N)$
  
      /* Construcción de términos Σ */
      term(n) := block(
        if n = 0 then c_n(0)
        else c_n(n)*exp(%i*n*w0*${intVar}) + c_n(-n)*exp(-%i*n*w0*${intVar})
      )$
  
      N_terms        : ${N_terms}$
      lista_terminos : makelist(term(k), k, 0, N_terms)$
      serie_demoivre : ratsimp(demoivre(lista_terminos))$
  
      /* Devolver listas de TeX como listas normales */
      tex_lista_terminos      : map(lambda([z], tex(z,false)), lista_terminos)$
      tex_demoivre_terminos   : map(lambda([z], tex(z,false)), serie_demoivre)$

      resultados : [
        string(c0), string(expr_cn), string(T), string(w0),
        string(series_exp_core_pos), string(series_exp_core_neg),
        string(lista_cn), string(lista_amp_fase),
        string(lista_terminos), string(serie_demoivre),
        tex_lista_terminos, tex_demoivre_terminos,
        tex(c0,false), tex(expr_cn,false), tex(T,false), tex(w0,false),
        tex(series_exp_core_pos,false), tex(series_exp_core_neg,false)
      ]$
      string(resultados);
    `;

    /* ─── 1 · Ejecutar Maxima una sola vez ─── */
    const raw = await execMaxima(buildMaximaCommand(maximaScript));
    const cleaned = raw
      .replace(/\\\n/g, "")
      .replace(/\n/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/error/i.test(cleaned)) {
      return {
        success: false,
        message: "Maxima devolvió un error",
        details: cleaned,
      };
    }

    /* ─── 2 · Parsear salida JSON-like ─── */
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        message: "No se pudo parsear la salida",
        details: cleaned,
      };
    }

    if (!Array.isArray(parsed) || parsed.length !== 18) {
      return {
        success: false,
        message: "Formato inesperado",
        details: cleaned,
      };
    }

    /* ─── 3 · Desestructurar ─── */
    const [
      c0,
      expr_cn,
      T,
      w0,
      series_exp_core_pos,
      series_exp_core_neg,
      coefficientList,
      amplitudePhaseList,
      seriesTerms,
      demoivreTerms,
      seriesTermsTeX,
      demoivreTermsTeX,
      c0TeX,
      cnTeX,
      TTeX,
      w0TeX,
      posTeX,
      negTeX,
    ] = parsed;

    /* ─── 4 · Responder ─── */
    return {
      success: true,
      simplified: {
        c0,
        cn: expr_cn,
        T,
        w0,
        series_exp_core_pos,
        series_exp_core_neg,
        coefficientList,
        amplitudePhaseList,
        seriesTerms,
        demoivreTerms,
      },
      latex: {
        c0: c0TeX,
        cn: cnTeX,
        T: TTeX,
        w0: w0TeX,
        series_exp_core_pos: posTeX,
        series_exp_core_neg: negTeX,
        terms: seriesTermsTeX,
        demoivreTerms: demoivreTermsTeX,
      },
    };
  } else {
    // ───── Series trigonométricas (regular y half-range) ─────
    const integralCoefficient = isHalfRange ? "(1 / (T/2))" : "(2/T)";
    const simplificationMethod = isHalfRange ? "ratsimp" : "fullratsimp";

    const maximaScript = `
      ${maximaBaseCode}
  
      /* Núcleos seno/coseno */
      cos_core : cos(n * w0 * ${intVar})$
      sin_core : sin(n * w0 * ${intVar})$
  
      /* Acumuladores */
      a0_acum : 0$
      an_acum : 0$
      bn_acum : 0$
  
      for i : 1 thru pieces do (
        trozo : func[i],
        f_i   : trozo[1],
        a     : trozo[2],
        b     : trozo[3],
  
        a0_acum : a0_acum + ${integralCoefficient} * integrate(      f_i , ${intVar}, a, b),
        an_acum : an_acum + ${integralCoefficient} * integrate(f_i * cos_core, ${intVar}, a, b),
        bn_acum : bn_acum + ${integralCoefficient} * integrate(f_i * sin_core, ${intVar}, a, b)
      )$
  
      /* Coeficientes simplificados */
      Coeff_A0 : factor(${simplificationMethod}(factor(a0_acum)))$
      Coeff_An : factor(${simplificationMethod}(factor(an_acum)))$
      Coeff_Bn : factor(${simplificationMethod}(factor(bn_acum)))$
  
      /* ---------- Salida única: 7 simplificados + 7 TeX ---------- */
      resultados : [
        string(Coeff_A0), string(Coeff_An), string(Coeff_Bn),
        string(T), string(w0), string(cos_core), string(sin_core),
        tex(Coeff_A0,false), tex(Coeff_An,false), tex(Coeff_Bn,false),
        tex(T,false), tex(w0,false), tex(cos_core,false), tex(sin_core,false)
      ]$
      string(resultados);
    `;

    /* Ejecución única */
    const raw = await execMaxima(buildMaximaCommand(maximaScript));
    const cleaned = raw
      .replace(/\\\n/g, "")
      .replace(/\n/g, "")
      .replace(/\s+/g, " ")
      .trim();

    /* Manejo de errores */
    if (/error/i.test(cleaned)) {
      return {
        success: false,
        message: "Maxima devolvió un error",
        details: cleaned,
      };
    }

    /* Parseo */
    let parsed;
    try {
      parsed = JSON.parse(cleaned); // ← convierto la lista Maxima a JSON
    } catch {
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
      an,
      bn,
      T,
      w0,
      series_cosine_core,
      series_sine_core,
      a0Tex,
      anTex,
      bnTex,
      TTex,
      w0Tex,
      cosineCoreTex,
      sineCoreTex,
    ] = parsed;

    /* Indeterminaciones (usa tus utilidades existentes) */
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

    /* Respuesta final */
    return {
      success: true,
      simplified: {
        a0,
        an,
        bn,
        T,
        w0,
        series_cosine_core,
        series_sine_core,
      },
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
      singularitiesResult.replace(/n\s*=\s*/g, "") // Ajuste en la expresión regular
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

module.exports = calculatePiecewiseSeries;
