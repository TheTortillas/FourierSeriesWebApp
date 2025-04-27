const DFTService = require("../services/dft-maxima.service");

exports.calculateDFT = async (req, res) => {
  const { funcionMatrix, N, M, intVar } = req.body;

  try {
    const result = await DFTService.computeDFT(funcionMatrix, N, M, intVar || "x");

    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }

    res.json({ 
      success: true, 
      data: result.result,
      originalPoints: result.originalPoints,
      amplitudeSpectrum: result.amplitudeSpectrum,
      phaseSpectrum: result.phaseSpectrum
    });
  } catch (error) {
    console.error("Error en el controlador DFT:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};