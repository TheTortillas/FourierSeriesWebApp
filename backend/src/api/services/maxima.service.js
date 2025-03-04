const { exec } = require('child_process');

function execMaxima(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout.trim());
    });
  });
}

exports.computeTrigonometricSeries = async (funcion, periodo) => {
    try {
      const command_a0 = `echo "declare(n, integer)$ string(ratsimp(((1/((${periodo})/2)) * integrate(${funcion}, x, -(${periodo}/2), ${periodo}/2))));" | maxima --very-quiet -`;
      const command_an = `echo "declare(n, integer)$ string(ratsimp(((1/((${periodo})/2)) * integrate(((${funcion}) * cos((n*%pi*x)/((${periodo}/2)))), x, -(${periodo}/2), ${periodo}/2))));" | maxima --very-quiet -`;
      const command_bn = `echo "declare(n, integer)$ string(ratsimp(((1/((${periodo})/2)) * integrate(((${funcion}) * sin((n*%pi*x)/((${periodo}/2)))), x, -(${periodo}/2), ${periodo}/2))));" | maxima --very-quiet -`;
  
      const [a0, an, bn] = await Promise.all([
        execMaxima(command_a0),
        execMaxima(command_an),
        execMaxima(command_bn)
      ]);
  
      return { a0, an, bn };
    } catch (error) {
      throw new Error(`Error computing trigonometric series: ${error.message}`);
    }
  };
  
  exports.computeComplexSeries = async (funcion, periodo) => {
    try {
      const command_c0 = `echo "declare(n, integer)$ tellsimpafter(exp(%i*%pi*n), (-1)**n)$ tellsimpafter(exp(%i*2*%pi*n),1)$ string(ratsimp((1/(${periodo})) * integrate((${funcion}), x ,-((${periodo})/2), ((${periodo})/2))));" | maxima --very-quiet -`;
      const command_cn = `echo "declare(n, integer)$ tellsimpafter(exp(%i*%pi*n), (-1)**n)$ tellsimpafter(exp(%i*2*%pi*n),1)$ string(ratsimp((1/(${periodo})) * integrate((${funcion}) * (exp(-(%i*n*%pi*x)/(((${periodo})/2)))), x ,-((${periodo})/2), ((${periodo})/2))));" | maxima --very-quiet -`;
  
      const [c0, cn] = await Promise.all([
        execMaxima(command_c0),
        execMaxima(command_cn)
      ]);
  
      return { c0, cn };
    } catch (error) {
      throw new Error(`Error computing complex series: ${error.message}`);
    }
  };