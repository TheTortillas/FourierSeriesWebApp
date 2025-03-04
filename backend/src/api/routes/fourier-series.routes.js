const express = require("express");
const router = express.Router();
const fourierSeriesController = require("../controllers/fourier-series.controller");

/**
 * @openapi
 * /fourier-series/trigonometric:
 *   post:
 *     tags:
 *     - Fourier Series Controller
 *     summary: Calcula la serie trigonométrica
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               funcion:
 *                 type: string
 *               periodo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes
 *       500:
 *         description: Error en el servidor
 */
router.post(
  "/trigonometric",
  fourierSeriesController.calculateTrigonometricSeries
);

/**
 * @openapi
 * /fourier-series/complex:
 *   post:
 *     tags:
 *     - Fourier Series Controller
 *     summary: Calcula la serie compleja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - funcion
 *              - periodo
 *             properties:
 *               funcion:
 *                 type: string
 *               periodo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes
 *       500:
 *         description: Error en el servidor
 */

router.post("/complex", fourierSeriesController.calculateComplexSeries);

module.exports = router;