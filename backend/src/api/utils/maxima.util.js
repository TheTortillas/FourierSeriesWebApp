const { exec } = require("child_process");

function execMaxima(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim()));
      else resolve(stdout.trim());
    });
  });
}

/**
 * Helper function to build Maxima commands
 * @param {string} maximaExpression - Maxima code to execute
 * @returns {string} Command to execute Maxima with the given expression
 */
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

module.exports = {
  execMaxima,
  buildMaximaCommand
};