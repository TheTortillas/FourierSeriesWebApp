const { execMaxima, buildMaximaCommand } = require("./maxima.util");
const getMaximaRules = require("./maxima-rules.util");

/**
 * Checks if a coefficient is zero according to Maxima
 * @param {string} coeff Coefficient to check
 * @returns {Promise<boolean>} True if the coefficient is zero
 */
async function isZeroCoefficient(coeff) {
  if (!coeff) return true;

  // Common simple zero patterns
  if (coeff === "0" || coeff === "0.0") return true;

  // Let Maxima evaluate if the coefficient is zero
  const checkCommand = `
    is_zero(expr) := block([simp:true], 
      ratsimp(expr) = 0 or fullratsimp(expr) = 0 or expand(expr) = 0
    )$
    string(is_zero(${coeff}));
  `;

  const result = await execMaxima(buildMaximaCommand(checkCommand));
  return result.includes("true");
}

/**
 * Finds indeterminate values in a coefficient expression
 * @param {string} expr The coefficient expression to analyze
 * @returns {Promise<Array>} Array of objects with indeterminate points and their limits
 */
async function findIndeterminateValues(expr) {
  if (!expr || expr === "0") return [];

  try {
    // Command to find indeterminate points and evaluate limits
    const indeterminateCommand = `
      buscar_indeterminaciones(expr) := block(
        [d, soluciones, limites],
        d: denom(expr),
        soluciones: solve(d = 0, n),
        limites: makelist([rhs(sol), limit(expr, n, rhs(sol))], sol, soluciones),
        return(limites)
      )$
      string(buscar_indeterminaciones(${expr}));
    `;

    const result = await execMaxima(buildMaximaCommand(indeterminateCommand));

    // Parse the result - result may be empty or a list of points
    if (!result || result === "[]") return [];

    // Extract the points from Maxima's output
    const points = await extractListItems(result);

    // Process each point and convert to structured objects
    return points
      .map((point) => {
        // Parse the [n-value, limit-value] pair
        if (!point.startsWith("[") || !point.endsWith("]")) {
          return null;
        }

        const content = point.substring(1, point.length - 1).trim();

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
          return null;
        }

        const nValue = content.substring(0, commaPos).trim();
        const limitValue = content.substring(commaPos + 1).trim();

        // Return as a structured object
        return {
          n: parseInt(nValue, 10),
          limit: limitValue,
        };
      })
      .filter(Boolean); // Remove any null entries
  } catch (error) {
    console.error("Error finding indeterminate values:", error);
    return [];
  }
}

/**
 * Expands a Fourier series to obtain individual terms
 * @param {Object} options Configuration options
 * @param {Object} options.coefficients The coefficients of the series (a0/c0, an/cn, bn)
 * @param {string} options.w0 Angular frequency
 * @param {string} options.intVar Integration variable
 * @param {string} options.seriesType Type of series: 'trigonometric', 'halfRange', or 'complex'
 * @param {number} options.terms Number of terms to generate
 * @param {boolean} options.demoivre Apply de Moivre's formula (for complex series)
 * @returns {Promise<Object>} Individual terms in string and LaTeX format
 */
async function expandSeries({
  coefficients,
  w0,
  intVar = "x",
  seriesType = "trigonometric",
  terms = 5,
  demoivre = false,
}) {
  const isComplex = seriesType === "complex";

  try {
    // Base Maxima code for setup
    let baseCode = `
      ${getMaximaRules({
        integer: true,
        trigRules: !isComplex,
        expRules: isComplex,
        assumptions: true,
        displayFlags: true,
      })}
      n1: 1$
      n2: ${terms}$
      w0: ${w0}$
      intVar: ${intVar}$
    `;

    // Different handling for complex vs trigonometric series
    if (isComplex) {
      // For complex series
      const { c0, cn } = coefficients;
      const isC0Zero = await isZeroCoefficient(c0);
      const isCnZero = await isZeroCoefficient(cn);

      // Find indeterminate values for cn coefficient
      const cnIndeterminateValues = !isCnZero
        ? await findIndeterminateValues(cn)
        : [];

      // If coefficient is zero, return empty arrays
      if (isCnZero) {
        return {
          string: {
            c0: isC0Zero ? "0" : c0,
            cnPositive: [],
            cnNegative: [],
          },
          latex: {
            c0: isC0Zero
              ? "0"
              : await execMaxima(buildMaximaCommand(`tex(${c0}, false);`)),
            cnPositive: [],
            cnNegative: [],
          },
          demoivreExpansion: demoivre
            ? {
                string: {
                  full: isC0Zero ? "0" : c0,
                  demoivre: isC0Zero ? "0" : c0,
                },
                latex: {
                  demoivre: isC0Zero
                    ? "0"
                    : await execMaxima(
                        buildMaximaCommand(`tex(${c0}, false);`)
                      ),
                },
              }
            : null,
        };
      }

      // Enhanced safe-substitution function for Maxima
      const safeCnSubstCode = `
        /* Safe substitution function that handles indeterminate points */
        safe_subst(expr, n_val) := block(
          [result, indet_points, i, limit_val],
          
          /* Get denominator and check if n_val makes it zero */
          d: denom(expr),
          if is(subst(n=n_val, d) = 0) then (
            /* Calculate limit at this point */
            result: limit(expr, n, n_val)
          ) else (
            /* Normal substitution */
            result: subst(n=n_val, expr)
          ),
          
          return(result)
        )$
      `;

      // Code to generate positive and negative series terms
      const seriesExpansionCode = `
        ${baseCode}
        ${safeCnSubstCode}
        c0: ${c0}$
        cn: ${cn}$
        
        /* Generate list of positive and negative terms using safe substitution */
        lista_positivos: makelist(safe_subst(cn, i) * exp(%i * i * w0 * ${intVar}), i, n1, n2)$
        lista_negativos: makelist(safe_subst(cn, -i) * exp(%i * (-i) * w0 * ${intVar}), i, n1, n2)$
       
        c0_term: c0$
        cn_pos_terms: lista_positivos$
        cn_neg_terms: lista_negativos$
      `;

      // Execute first batch to get string versions
      const strC0Term = await execMaxima(
        buildMaximaCommand(`
        ${seriesExpansionCode}
        string(c0_term);
      `)
      );

      const strPosTerms = await execMaxima(
        buildMaximaCommand(`
        ${seriesExpansionCode}
        string(cn_pos_terms);
      `)
      );

      const strNegTerms = await execMaxima(
        buildMaximaCommand(`
        ${seriesExpansionCode}
        string(cn_neg_terms);
      `)
      );

      // Convert terms to arrays
      const posTermsArray = await extractListItems(strPosTerms);
      const negTermsArray = await extractListItems(strNegTerms);

      // Now get LaTeX versions
      const texC0Term = await execMaxima(
        buildMaximaCommand(`
        ${seriesExpansionCode}
        tex(c0_term, false);
      `)
      );

      const texPosTerms = await Promise.all(
        posTermsArray.map((_, i) =>
          execMaxima(
            buildMaximaCommand(`
            ${seriesExpansionCode}
            tex(cn_pos_terms[${i + 1}], false);
          `)
          )
        )
      );

      const texNegTerms = await Promise.all(
        negTermsArray.map((_, i) =>
          execMaxima(
            buildMaximaCommand(`
            ${seriesExpansionCode}
            tex(cn_neg_terms[${i + 1}], false);
          `)
          )
        )
      );

      // If demoivre is requested, also get the expanded form
      let demoivreExpansion = null;
      if (demoivre) {
        const demoivreTerms = await Promise.all(
          posTermsArray.map(async (_, i) => {
            // Obtener el término n y -n correspondiente
            const posTermCode = `
            ${seriesExpansionCode}
            pos_term: cn_pos_terms[${i + 1}]$
            neg_term: cn_neg_terms[${i + 1}]$
            term_sum: pos_term + neg_term$
            demoivre_term: factor(ratsimp(demoivre(term_sum)))$
          `;

            // Obtener las versiones string y LaTeX
            const termString = await execMaxima(
              buildMaximaCommand(`
              ${posTermCode}
              string(demoivre_term);
            `)
            );

            const termTex = await execMaxima(
              buildMaximaCommand(`
              ${posTermCode}
              tex(demoivre_term, false);
            `)
            );

            return { string: termString, latex: termTex };
          })
        );

        demoivreExpansion = {
          string: {
            c0: strC0Term,
            terms: demoivreTerms.map((term) => term.string),
          },
          latex: {
            c0: texC0Term,
            terms: demoivreTerms.map((term) => term.latex),
          },
        };
      }

      return {
        string: {
          c0: strC0Term,
          cnPositive: posTermsArray,
          cnNegative: negTermsArray,
        },
        latex: {
          c0: texC0Term,
          cnPositive: texPosTerms,
          cnNegative: texNegTerms,
        },
        demoivreExpansion,
        indeterminateValues: {
          cn: cnIndeterminateValues,
        },
      };
    } else {
      const { a0, an, bn } = coefficients;

      const seriesExpansionCode = `
        ${getMaximaRules({
          integer: true,
          trigRules: true,
          assumptions: true,
          displayFlags: true,
        })}
    
        /* Parámetros generales */
        w0: ${w0}$
        n1: 1$
        n2: ${terms}$
        x: ${intVar}$
        a0 : ${a0}$
        an : ${an}$
        bn : ${bn}$
    
        /* Sustitución segura */
        safe_subst(expr, n_val) := block(
          [result, d],
          d: denom(expr),
          if is(subst(n=n_val, d) = 0)
            then result : limit(expr, n, n_val)
            else result : subst(n=n_val, expr),
          return(result)
        )$
    
        /* Generar términos individuales */
        an_terms_str : makelist(string(safe_subst(an, i) * cos(i * w0 * x)), i, n1, n2)$
        bn_terms_str : makelist(string(safe_subst(bn, i) * sin(i * w0 * x)), i, n1, n2)$
        an_terms_tex : makelist(tex(safe_subst(an, i) * cos(i * w0 * x), false), i, n1, n2)$
        bn_terms_tex : makelist(tex(safe_subst(bn, i) * sin(i * w0 * x), false), i, n1, n2)$
    
        a0_str  : string(a0)$
        a0_tex  : tex(a0, false)$
    
        /* Resultado completo */
        resultados : [
          a0_str,           /* 1 */
          a0_tex,           /* 2 */
          an_terms_str,     /* 3 */
          an_terms_tex,     /* 4 */
          bn_terms_str,     /* 5 */
          bn_terms_tex      /* 6 */
        ]$
        string(resultados);
      `;

      const raw = await execMaxima(buildMaximaCommand(seriesExpansionCode));
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

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return {
          success: false,
          message: "No se pudo parsear la salida de Maxima",
          details: cleaned,
        };
      }

      if (!Array.isArray(parsed) || parsed.length !== 6) {
        return {
          success: false,
          message: "La salida de Maxima no tiene el formato esperado",
          details: cleaned,
        };
      }

      const [a0Str, a0Tex, anStrList, anTexList, bnStrList, bnTexList] = parsed;

      return {
        string: {
          a0: a0Str,
          an: anStrList,
          bn: bnStrList,
        },
        latex: {
          a0: a0Tex,
          an: anTexList,
          bn: bnTexList,
        },
        // Solo si tienes implementado findIndeterminateValues para trig:
        indeterminateValues: {
          an: await findIndeterminateValues(an),
          bn: await findIndeterminateValues(bn),
        },
      };
    }
  } catch (error) {
    throw new Error(`Error expanding series: ${error.message}`);
  }
}

/**
 * Helper function to extract items from a Maxima list string
 * @param {string} listStr String representation of a Maxima list
 * @returns {Promise<Array>} Array of list items
 */
async function extractListItems(listStr) {
  // Remove brackets and split by commas, handling possible nested structures
  try {
    // This is a simplified approach - for complex nested structures,
    // you might need a more sophisticated parsing approach
    if (!listStr.startsWith("[") || !listStr.endsWith("]")) {
      throw new Error("Invalid list format");
    }

    const content = listStr.substring(1, listStr.length - 1).trim();

    // Handle empty list case
    if (!content) {
      return [];
    }

    // Split by commas not inside parentheses or brackets
    let result = [];
    let currentItem = "";
    let depth = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (
        (char === "(" || char === "[") &&
        (i === 0 || content[i - 1] !== "\\")
      ) {
        depth++;
      } else if (
        (char === ")" || char === "]") &&
        (i === 0 || content[i - 1] !== "\\")
      ) {
        depth--;
      }

      if (char === "," && depth === 0) {
        result.push(currentItem.trim());
        currentItem = "";
      } else {
        currentItem += char;
      }
    }

    if (currentItem) {
      result.push(currentItem.trim());
    }

    return result;
  } catch (error) {
    console.error("Error parsing list:", error);
    return [];
  }
}

module.exports = expandSeries;
