/**
 * Returns a string with common Maxima simplification rules for Fourier series calculations
 * @param {Object} options - Options to include specific rule blocks
 * @param {boolean} options.integer - Include integer declarations
 * @param {boolean} options.trigRules - Include trigonometric simplification rules
 * @param {boolean} options.expRules - Include exponential simplification rules
 * @param {boolean} options.assumptions - Include variable assumptions
 * @param {boolean} options.displayFlags - Include display flags
 * @returns {string} Maxima commands as a string
 */
function getMaximaRules(options = {}) {
  const {
    integer = true,
    trigRules = false,
    expRules = false,
    assumptions = false,
    displayFlags = false,
  } = options;

  let rules = [];

  if (integer) {
    rules.push("declare(n, integer)$");
  }

  if (trigRules) {
    rules.push(`
      matchdeclare(k, lambda([k], is(evenp(k))))$
      matchdeclare(j, lambda([j], is(evenp(j) = false)))$
      /* Si k es par, da 0 */
      tellsimpafter(sin(((2*n + k)*%pi)/2), 0)$
      /* Si k impar y k ≡ 1 mod 4 ⇒ (-1)^n */
      tellsimpafter(sin(((2*n + j)*%pi)/2), 
        if mod(j,4)=1 then (-1)^n else -(-1)^n)$
    `);
  }

  if (expRules) {
    rules.push(`
      tellsimpafter(exp(%i * %pi * n), (-1)^n)$
      tellsimpafter(exp(%i * 2 * %pi * n), 1)$
      tellsimpafter(exp((%i * %pi * n)/2), %i^n)$
      tellsimpafter(exp(-(%i * %pi * n)/2), %i^(-n))$
    `);
  }

  if (assumptions) {
    rules.push("assume(L > 0)$");
  }

  if (displayFlags) {
    rules.push("%edispflag:true$");
  }

  return rules.join("\n");
}

module.exports = getMaximaRules;
