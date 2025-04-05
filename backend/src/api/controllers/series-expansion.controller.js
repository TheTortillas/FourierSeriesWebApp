const SeriesExpansionService = require("../services/series-expansion.service");

/**
 * Expands a trigonometric Fourier series into individual terms
 */
exports.expandTrigonometricSeries = (req, res) => {
  const { coefficients, w0, intVar, terms } = req.body;
  SeriesExpansionService.expandTrigonometricSeries(
    coefficients,
    w0,
    intVar,
    terms
  )
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};

/**
 * Expands a half-range Fourier series into individual terms
 */
exports.expandHalfRangeSeries = (req, res) => {
  const { coefficients, w0, intVar, terms } = req.body;
  SeriesExpansionService.expandHalfRangeSeries(coefficients, w0, intVar, terms)
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};

/**
 * Expands a complex Fourier series into individual terms
 */
exports.expandComplexSeries = (req, res) => {
  const { coefficients, w0, intVar, terms, demoivre } = req.body;
  SeriesExpansionService.expandComplexSeries(
    coefficients,
    w0,
    intVar,
    terms,
    demoivre
  )
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};
