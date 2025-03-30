const execMaxima = require("../utils/maxima.util");

// Helper function to build Maxima commands
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

exports.checkIntegrability = async (funcion, intVar, start, end) => {
  try {
    // Define the Maxima expression to check if the function is integrable
    const checkIntegrabilityExpression = `

    has_special_functions(expr) := block(
    [funciones_especiales : ['erf, 'erfi, 'gamma, 'gamma_incomplete, 'bessel_j, 'bessel_y, 'airy_ai, 'airy_bi, 'hypergeometric, 'elliptic_e, 'elliptic_f, 'conjugate]],
    some(lambda([f], freeof(f, expr) = false), funciones_especiales)
)$

    check_integrability(f, x, a, b) := block(
        [resultado],
        
        
        if a = false or b = false then (
            resultado : integrate(f, x),
            if resultado = 'integrate(f, x) then
                return("-1")
            else if has_special_functions(resultado) then
                return("0")
            else
                return("1")
        )
        else (
            resultado : integrate(f, x, a, b),
            if resultado = 'integrate(f, x, a, b) then
                return("-1")
            else if has_special_functions(resultado) then
                return("0")
            else
                return("1")
        )
    )$

    string(check_integrability(${funcion}, ${intVar}, ${start}, ${end}));
    `;

    // Execute the Maxima command
    const result = await execMaxima(
      buildMaximaCommand(checkIntegrabilityExpression)
    );

    return result; // Return the result from Maxima (whether integrable or not)
  } catch (error) {
    throw new Error(`Error checking integrability: ${error.message}`);
  }
};
