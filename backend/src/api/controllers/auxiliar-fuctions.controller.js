const AuxiliarFunctionsService = require("../services/auxiliar-functions-maxima.service");

exports.checkIntegrability = (req, res) => {
  const { funcion, intVar, start, end } = req.body;
  
  AuxiliarFunctionsService
    .checkIntegrability(funcion, intVar, start, end)
    .then((result) => res.json(result))
    .catch((err) => res.status(500).json({ error: err.message }));
};