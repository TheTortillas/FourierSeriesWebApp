const { exec } = require("child_process");

/**
 * Helper function to build Maxima commands
 * @param {string} maximaExpression - Maxima code to execute
 * @returns {string} Command to execute Maxima with the given expression
 */
function buildMaximaCommand(maximaExpression) {
  return `echo "${maximaExpression}" | maxima --very-quiet -`;
}

/**
 * Executes a Maxima command and returns the result
 * @param {string} command - Maxima command to execute
 * @returns {Promise<string>} - Promise resolving to the command output
 */
function execMaxima(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim()));
      else resolve(stdout.trim());
    });
  });
}

module.exports = {
  execMaxima,
  buildMaximaCommand
};