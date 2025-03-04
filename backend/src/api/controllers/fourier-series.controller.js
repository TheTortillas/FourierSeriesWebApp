const maximaService = require('../services/maxima.service');

exports.calculateTrigonometricSeries = (req, res) => {
  const { funcion, periodo } = req.body;
  maximaService.computeTrigonometricSeries(funcion, periodo)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
};

exports.calculateComplexSeries = (req, res) => {
  const { funcion, periodo } = req.body;
  maximaService.computeComplexSeries(funcion, periodo)
    .then(result => res.json(result))
    .catch(err => res.status(500).json({ error: err.message }));
};