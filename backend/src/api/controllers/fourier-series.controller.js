const FourierSeriesService = require("../services/fourier-series-maxima.service");

exports.calculateTrigonometricSeries = (req, res) => {
  const { funcion, periodo, intVar } = req.body;
  FourierSeriesService
    .computeTrigonometricSeries(funcion, periodo, intVar)
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};

exports.calculateComplexSeries = (req, res) => {
  const { funcion, periodo, intVar } = req.body;
  FourierSeriesService
    .computeComplexSeries(funcion, periodo, intVar)
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};
