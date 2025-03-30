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
 *             required:
 *              - funcion
 *              - periodo
 *              - intVar
 *             properties:
 *               funcion:
 *                 type: string
 *               periodo:
 *                 type: string
 *               intVar:
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
 *              - intVar
 *             properties:
 *               funcion:
 *                 type: string
 *               periodo:
 *                 type: string
 *               intVar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes
 *       500:
 *         description: Error en el servidor
 */
router.post("/complex", fourierSeriesController.calculateComplexSeries);

/**
 * @openapi
 * /fourier-series/trigonometric-piecewise:
 *   post:
 *     tags:
 *     - Fourier Series Controller
 *     summary: Calcula la serie trigonométrica para función a trozos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - funcionMatrix
 *             properties:
 *               funcionMatrix:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes
 *       500:
 *         description: Error en el servidor
 */
router.post(
  "/trigonometric-piecewise",
  fourierSeriesController.calculateTrigonometricSeriesPiecewise
);

/**
 * @openapi
 * /fourier-series/complex-piecewise:
 *   post:
 *     tags:
 *     - Fourier Series Controller
 *     summary: Calcula la serie compleja para función a trozos
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - funcionMatrix
 *             properties:
 *               funcionMatrix:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes complejos
 *       500:
 *         description: Error en el servidor
 */
router.post(
  "/complex-piecewise",
  fourierSeriesController.calculateComplexSeriesPiecewise
);

/**
 * @openapi
 * /fourier-series/half-range:
 *   post:
 *     tags:
 *     - Fourier Series Controller
 *     summary: Calcula la serie de Fourier de medio rango
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - funcionMatrix
 *             properties:
 *               funcionMatrix:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *     responses:
 *       200:
 *         description: Respuesta con coeficientes
 *       500:
 *         description: Error en el servidor
 */
router.post("/half-range", fourierSeriesController.calculateHalfRangeSeries);

module.exports = router;
