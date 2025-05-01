const expandSeries = require("../utils/series-expansion.util");

exports.expandTrigonometricSeries = async (
  coefficients,
  w0,
  intVar = "x",
  terms = 5
) => {
  try {
    return await expandSeries({
      coefficients,
      w0,
      intVar,
      seriesType: "trigonometric",
      terms,
    });
  } catch (error) {
    throw new Error(`Error expanding trigonometric series: ${error.message}`);
  }
};

exports.expandHalfRangeSeries = async (
  coefficients,
  w0,
  intVar = "x",
  terms = 5
) => {
  try {
    return await expandSeries({
      coefficients,
      w0,
      intVar,
      seriesType: "halfRange",
      terms,
    });
  } catch (error) {
    throw new Error(`Error expanding half-range series: ${error.message}`);
  }
};

exports.expandComplexSeries = async (
  coefficients,
  w0,
  intVar = "x",
  terms = 5,
  demoivre = false
) => {
  try {
    return await expandSeries({
      coefficients,
      w0,
      intVar,
      seriesType: "complex",
      terms,
      demoivre,
    });
  } catch (error) {
    throw new Error(`Error expanding complex series: ${error.message}`);
  }
};
