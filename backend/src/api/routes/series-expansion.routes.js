const express = require("express");
const router = express.Router();
const seriesExpansionController = require("../controllers/series-expansion.controller");

/**
 * @openapi
 * /series-expansion/trigonometric:
 *   post:
 *     tags:
 *     - Series Expansion Controller
 *     summary: Expande la serie de Fourier trigonométrica en términos individuales
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - coefficients
 *              - w0
 *             properties:
 *               coefficients:
 *                 type: object
 *                 properties:
 *                   a0:
 *                     type: string
 *                   an:
 *                     type: string
 *                   bn:
 *                     type: string
 *               w0:
 *                 type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *               terms:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       200:
 *         description: Términos de la serie expandidos
 *       500:
 *         description: Error en el servidor
 */
router.post(
  "/trigonometric",
  seriesExpansionController.expandTrigonometricSeries
);

/**
 * @openapi
 * /series-expansion/half-range:
 *   post:
 *     tags:
 *     - Series Expansion Controller
 *     summary: Expande la serie de Fourier de medio rango en términos individuales
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - coefficients
 *              - w0
 *             properties:
 *               coefficients:
 *                 type: object
 *                 properties:
 *                   a0:
 *                     type: string
 *                   an:
 *                     type: string
 *                   bn:
 *                     type: string
 *               w0:
 *                 type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *               terms:
 *                 type: integer
 *                 default: 5
 *     responses:
 *       200:
 *         description: Términos de la serie expandidos
 *       500:
 *         description: Error en el servidor
 */
router.post("/half-range", seriesExpansionController.expandHalfRangeSeries);

/**
 * @openapi
 * /series-expansion/complex:
 *   post:
 *     tags:
 *     - Series Expansion Controller
 *     summary: Expande la serie de Fourier compleja en términos individuales
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *              - coefficients
 *              - w0
 *             properties:
 *               coefficients:
 *                 type: object
 *                 properties:
 *                   c0:
 *                     type: string
 *                   cn:
 *                     type: string
 *               w0:
 *                 type: string
 *               intVar:
 *                 type: string
 *                 default: x
 *               terms:
 *                 type: integer
 *                 default: 5
 *               demoivre:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Términos de la serie expandidos
 *       500:
 *         description: Error en el servidor
 */
router.post("/complex", seriesExpansionController.expandComplexSeries);

module.exports = router;
