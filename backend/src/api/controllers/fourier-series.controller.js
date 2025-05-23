const FourierSeriesService = require("../services/fourier-series-maxima.service");

exports.calculateTrigonometricSeries = (req, res) => {
  const { funcion, periodo, intVar } = req.body;
  FourierSeriesService.computeTrigonometricSeries(funcion, periodo, intVar)
    .then((result) => {
      if (!result.success) {
        // Si la validación falló, devolvemos un código 422 (Unprocessable Entity)
        return res.status(422).json({
          error: result.message,
          validationDetails: result.validationDetails,
        });
      }
      res.json(result);
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

exports.calculateComplexSeries = (req, res) => {
  const { funcion, periodo, intVar } = req.body;
  FourierSeriesService.computeComplexSeries(funcion, periodo, intVar)
    .then((result) => {
      if (!result.success) {
        return res.status(422).json({
          error: result.message,
          validationDetails: result.validationDetails,
        });
      }
      res.json(result);
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

exports.calculateTrigonometricSeriesPiecewise = (req, res) => {
  const { funcionMatrix, intVar } = req.body;
  FourierSeriesService.computeTrigonometricSeriesPiecewise(
    funcionMatrix,
    intVar
  )
    .then((result) => {
      if (!result.success) {
        return res.status(422).json({
          error: result.message,
          validationDetails: result.validationDetails,
        });
      }
      res.json(result);
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

exports.calculateComplexSeriesPiecewise = (req, res) => {
  const { funcionMatrix, intVar } = req.body;
  FourierSeriesService.computeComplexSeriesPiecewise(funcionMatrix, intVar)
    .then((result) => {
      if (!result.success) {
        return res.status(422).json({
          error: result.message,
          validationDetails: result.validationDetails,
        });
      }
      res.json(result);
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};

exports.calculateHalfRangeSeries = (req, res) => {
  const { funcionMatrix, intVar } = req.body;
  FourierSeriesService.computeHalfRangeSeries(funcionMatrix, intVar)
    .then((result) => {
      if (!result.success) {
        return res.status(422).json({
          error: result.message,
          validationDetails: result.validationDetails,
        });
      }
      res.json(result);
    })
    .catch((err) => res.status(500).json({ error: err.message }));
};
