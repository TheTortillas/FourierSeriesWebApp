const execMaxima = require("./maxima.util");
const getMaximaRules = require("./maxima-rules.util");

/**
 * Helper function to build Maxima commands
 */
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

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

      // Code to generate positive and negative series terms
      const seriesExpansionCode = `
        ${baseCode}
        c0: ${c0}$
        cn: ${cn}$
        
        /* Generate list of positive and negative terms */
        lista_positivos: makelist(subst(n=i, cn * exp(%i * i * w0 * ${intVar})), i, n1, n2)$
        lista_negativos: makelist(subst(n=i, cn * exp(%i * i * w0 * ${intVar})), i, -n2, -n1)$
        lista_negativos: reverse(lista_negativos)$
        
        c0_term: c0$
        cn_pos_terms: lista_positivos$
        cn_neg_terms: lista_negativos$
      `;

      // Execute first batch to get string versions
      const strC0Term = await execMaxima(
        buildMaximaCommand(`
        ${seriesExpansionCode}
        string(c0_term/2);
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
        tex(c0_term/2, false);
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
      };
    } else {
      // For trigonometric series (normal or half-range)
      const { a0, an, bn } = coefficients;

      // Check which coefficients are zero
      const isA0Zero = await isZeroCoefficient(a0);
      const isAnZero = await isZeroCoefficient(an);
      const isBnZero = await isZeroCoefficient(bn);

      // Prepare empty results structures
      const result = {
        string: {
          a0: isA0Zero ? "0" : null,
          an: isAnZero ? [] : null,
          bn: isBnZero ? [] : null,
        },
        latex: {
          a0: isA0Zero ? "0" : null,
          an: isAnZero ? [] : null,
          bn: isBnZero ? [] : null,
        },
      };

      // Base code for the series expansion
      const seriesExpansionCode = `
        ${baseCode}
        a0: ${a0}$
        an: ${an}$
        bn: ${bn}$
      `;

      // Calculate a0 term if not zero
      if (!isA0Zero) {
        const a0Code = `
          ${seriesExpansionCode}
          a0_term: a0/2$
        `;

        result.string.a0 = await execMaxima(
          buildMaximaCommand(`${a0Code} string(a0_term/2);`)
        );

        result.latex.a0 = await execMaxima(
          buildMaximaCommand(`${a0Code} tex(a0_term, false);`)
        );
      }

      // Calculate an terms if not zero
      if (!isAnZero) {
        const anCode = `
          ${seriesExpansionCode}
          an_terms: makelist(subst(n=i, an * cos(i * w0 * ${intVar})), i, n1, n2)$
        `;

        const strAnTerms = await execMaxima(
          buildMaximaCommand(`${anCode} string(an_terms);`)
        );

        const anTermsArray = await extractListItems(strAnTerms);
        result.string.an = anTermsArray;

        result.latex.an = await Promise.all(
          anTermsArray.map((_, i) =>
            execMaxima(
              buildMaximaCommand(`${anCode} tex(an_terms[${i + 1}], false);`)
            )
          )
        );
      }

      // Calculate bn terms if not zero
      if (!isBnZero) {
        const bnCode = `
          ${seriesExpansionCode}
          bn_terms: makelist(subst(n=i, bn * sin(i * w0 * ${intVar})), i, n1, n2)$
        `;

        const strBnTerms = await execMaxima(
          buildMaximaCommand(`${bnCode} string(bn_terms);`)
        );

        const bnTermsArray = await extractListItems(strBnTerms);
        result.string.bn = bnTermsArray;

        result.latex.bn = await Promise.all(
          bnTermsArray.map((_, i) =>
            execMaxima(
              buildMaximaCommand(`${bnCode} tex(bn_terms[${i + 1}], false);`)
            )
          )
        );
      }

      return result;
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
