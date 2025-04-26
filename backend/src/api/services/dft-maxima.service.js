const { execMaxima, buildMaximaCommand } = require("../utils/maxima.util");

/**
 * Limpia una cadena de salida de Maxima eliminando saltos de línea y caracteres de escape
 * @param {string} output - Salida cruda de Maxima
 * @returns {string} - Salida limpia
 */
function cleanMaximaOutput(output) {
  return output
    .replace(/\\\n/g, '') // Elimina saltos de línea escapados
    .replace(/\n/g, '')   // Elimina saltos de línea normales
    .replace(/\s+/g, ' ') // Normaliza espacios
    .trim();              // Elimina espacios al inicio y fin
}

/**
 * Verifica si la salida de Maxima contiene mensajes de error
 * @param {string} output - Salida de Maxima
 * @returns {boolean} - True si contiene errores
 */
function containsError(output) {
  const errorPatterns = [
    /error/i,
    /log: encountered log\(0\)/i,
    /división por cero/i,
    /division by zero/i,
    /no es de tipo/i, 
    /is not of type/i,
    /argument cannot be/i,
    /unexpected condition/i
  ];
  
  return errorPatterns.some(pattern => pattern.test(output));
}

/**
 * Extrae un mensaje de error significativo de la salida de Maxima
 * @param {string} output - Salida de Maxima
 * @returns {string} - Mensaje de error
 */
function extractErrorMessage(output) {
  // Busca frases comunes de error
  const errorMatches = [
    output.match(/log: encountered ([^.]+)/),
    output.match(/([^:]+: [^.]+\.)/),
    output.match(/(is not of type [^:]+)/),
    output.match(/(argument cannot be [^;]+)/),
  ];
  
  // Usa el primer match que encuentre
  for (const match of errorMatches) {
    if (match && match[1]) {
      return `Error matemático: ${match[1]}`;
    }
  }
  
  // Si no encuentra un patrón específico, devuelve un mensaje genérico
  return "Error matemático en la evaluación de la función";
}
exports.computeDFT = async (funcionMatrix, N = 32, M = 1, intVar = "x") => {
  try {
    // Convertimos la matriz de JavaScript a una representación válida en Maxima
    const maximaMatrix = `matrix(${funcionMatrix
      .map((row) => `[${row.join(", ")}]`)
      .join(", ")})`;

    // Construimos el script de Maxima
    const maximaScript = `
    /* 1. Función evaluadora por tramos con manejo de singularidades */
    evaluar_funcion_por_tramos(func, x_val) := block(
      [n, val : 0, tramo, f_expr, resultado],
      n : length(func),
      for i : 1 thru n do (
        tramo : func[i],
        if is(x_val >= float(tramo[2]) and x_val < float(tramo[3])) then (
          f_expr : tramo[1],
          resultado : errcatch(ev(f_expr, ${intVar} = x_val)),
          if length(resultado) = 0 then (
            resultado : errcatch(limit(f_expr, ${intVar}, x_val)),
            if length(resultado) = 0 or resultado[1] = 'und then (
              /* Si no hay límite definido, dejamos valor en 0 */
              val : 0
            )
            else (
              val : resultado[1]
            )
          )
          else (
            val : resultado[1]
          )
        )
      ),
      return(val)
    )$

      /* 2. Parámetros recibidos */
      func : ${maximaMatrix}$
      N : ${N}$
      M : ${M}$

      /* 3. Dominio y muestras */
      a : (func[1][2])$
      b : (func[length(func)][3])$
      T : b - a$
      dx : (T / N)$
      
      /* Creamos el arreglo de muestras */
      muestras : []$
      puntos_originales : []$
      for i:0 thru N-1 do (
        x_val : a + i*dx,
        y_val : evaluar_funcion_por_tramos(func, x_val),
        push(y_val, muestras),
        push([x_val, y_val], puntos_originales)
      )$
      muestras : reverse(muestras)$
      puntos_originales : reverse(puntos_originales)$

      /* 4. Cálculo de la DFT y señal reconstruida */
      load("fft")$
      dft_result : fft(muestras)$
      reconstruida : inverse_fft(dft_result)$

      /* 5. Repetir la señal hacia ambos lados */
      señal_extendida : []$
      for rep:1 thru 2*M+1 do (
        for i:1 thru length(reconstruida) do (
          push(reconstruida[i], señal_extendida)
        )
      )$
      señal_periodica : reverse(señal_extendida)$

      /* 6. Eje x real centrado */
      x_vals : []$
      for i:0 thru (2*M+1)*N-1 do (
        push(a + (i - M*N)*dx, x_vals)
      )$
      x_vals : reverse(x_vals)$

      /* 7. Pares reales [x, y] */
      puntos : []$
      for i:1 thru length(x_vals) do (
        if i <= length(señal_periodica) then (
          push([x_vals[i], realpart(señal_periodica[i])], puntos)
        )
      )$
      puntos : reverse(puntos)$

      /* 8. Resultado final */
      resultado : [string(puntos), string(puntos_originales)];
      string(resultado);
    `;

    // Ejecutar el script en Maxima
    const rawResult = await execMaxima(buildMaximaCommand(maximaScript));
    
    // Limpiamos la salida usando la función de limpieza
    const cleanedResult = cleanMaximaOutput(rawResult);
    
    // Verificamos si hay errores en la salida
    if (containsError(cleanedResult)) {
      const errorMessage = extractErrorMessage(cleanedResult);
      return { success: false, message: errorMessage, details: cleanedResult };
    }
    
    // Extraemos los dos arrays de puntos
    const match = cleanedResult.match(/\["(\[\[.*?\]\])",\s*"(\[\[.*?\]\])"\]/);
    
    if (!match || !match[1] || !match[2]) {
      return { 
        success: false, 
        message: "No se pudieron extraer los puntos", 
        details: cleanedResult 
      };
    }
    
    const dftPoints = match[1];
    const originalPoints = match[2];
    
    return { 
      success: true, 
      result: dftPoints, 
      originalPoints: originalPoints 
    };
  } catch (error) {
    console.error("Error al calcular la DFT:", error);
    return { success: false, message: error.message };
  }
};