const { exec } = require('child_process');

function execMaxima(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim()));
      else resolve(stdout.trim());
    });
  });
}

module.exports = execMaxima; 

